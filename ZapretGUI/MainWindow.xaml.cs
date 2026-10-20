using System;
using System.Diagnostics;
using System.IO;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Interop;
using System.Windows.Media;
using ZapretGUI.Core;

namespace ZapretGUI
{
    public partial class MainWindow : Window
    {
        private readonly TrayIconManager _trayIconManager;

        private Views.HomeView _homeView;
        private Views.SettingsView? _settingsView;
        private Views.DiagnosticsView? _diagnosticsView;
        private Views.ModsView? _modsView;

        public MainWindow()
        {
            InitializeComponent();

            var configPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "config.json");
            var isFirstRun = !File.Exists(configPath);

            SettingsManager.Load();
            UIHelper.ApplyThemeColors();

            if (isFirstRun)
            {
                var wizard = new Views.WizardWindow();
                wizard.ShowDialog();
                SettingsManager.Save();
                UIHelper.ApplyThemeColors();
            }

            RenderOptions.ProcessRenderMode = SettingsManager.Current.HardwareAcceleration
                ? RenderMode.Default
                : RenderMode.SoftwareOnly;

            _ = InitializeModsAsync();

            _homeView = new Views.HomeView();
            MainContentContainer.Content = _homeView;

            _trayIconManager = new TrayIconManager(this);

            _ = CheckUpdatesOnStartupAsync();
        }

        private async Task InitializeModsAsync()
        {
            var modManager = new ModManager();
            modManager.InitializeFolders();
            await modManager.SyncActiveBatModsAsync();
            await modManager.ApplyListModsAsync();
        }

        private async Task CheckUpdatesOnStartupAsync()
        {
            var stopServicesAction = () => { if (IsBypassRunning()) ToggleBypass(); };
            var progress = new Progress<string>(status => _homeView.ShowUpdateProgress(status));
            await Core.UpdateManager.RunUpdateWorkflowAsync(isManualCheck: false, stopServicesAction, progress);
            _homeView.RefreshProfilesLive();
        }

        private void BtnHome_Click(object sender, RoutedEventArgs e)
        {
            if (MainContentContainer.Content == _homeView) return;
            MainContentContainer.Content = _homeView;
            SetActiveTab(BtnHome);
        }

        private void BtnMods_Click(object sender, RoutedEventArgs e)
        {
            if (_modsView == null) _modsView = new Views.ModsView();
            if (MainContentContainer.Content == _modsView) return;
            MainContentContainer.Content = _modsView;
            SetActiveTab(BtnMods);
        }

        private void BtnDiagnostics_Click(object sender, RoutedEventArgs e)
        {
            if (_diagnosticsView == null) _diagnosticsView = new Views.DiagnosticsView();
            if (MainContentContainer.Content == _diagnosticsView) return;
            MainContentContainer.Content = _diagnosticsView;
            SetActiveTab(BtnDiagnostics);
        }

        private void BtnSettings_Click(object sender, RoutedEventArgs e)
        {
            if (_settingsView == null) _settingsView = new Views.SettingsView();
            if (MainContentContainer.Content == _settingsView) return;
            MainContentContainer.Content = _settingsView;
            SetActiveTab(BtnSettings);
        }

        private void SetActiveTab(System.Windows.Controls.Button activeBtn)
        {
            var transparent = new SolidColorBrush(System.Windows.Media.Colors.Transparent);
            var zeroThickness = new Thickness(0);

            BtnHome.Background = transparent;
            BtnHome.BorderThickness = zeroThickness;
            BtnDiagnostics.Background = transparent;
            BtnDiagnostics.BorderThickness = zeroThickness;
            BtnMods.Background = transparent;
            BtnMods.BorderThickness = zeroThickness;
            BtnSettings.Background = transparent;
            BtnSettings.BorderThickness = zeroThickness;

            activeBtn.Background = UIHelper.GetBrushFromHex("#2A2A2A");
            activeBtn.BorderBrush = UIHelper.GetSuccessBrush();
            activeBtn.BorderThickness = new Thickness(3, 0, 0, 0);

            if (MainContentContainer.Content is FrameworkElement element)
            {
                element.RenderTransform = new System.Windows.Media.TranslateTransform();

                var fadeIn = new System.Windows.Media.Animation.DoubleAnimation(0, 1, TimeSpan.FromMilliseconds(300))
                {
                    EasingFunction = new System.Windows.Media.Animation.CubicEase
                    { EasingMode = System.Windows.Media.Animation.EasingMode.EaseOut }
                };
                var slideUp = new System.Windows.Media.Animation.DoubleAnimation(15, 0, TimeSpan.FromMilliseconds(300))
                {
                    EasingFunction = new System.Windows.Media.Animation.CubicEase
                    { EasingMode = System.Windows.Media.Animation.EasingMode.EaseOut }
                };

                element.BeginAnimation(UIElement.OpacityProperty, fadeIn);
                element.RenderTransform.BeginAnimation(System.Windows.Media.TranslateTransform.YProperty, slideUp);
            }
        }

        public void UpdateIndicators(bool isZapretRunning, bool isProxyRunning)
        {
            var zColor = isZapretRunning ? UIHelper.GetSuccessBrush() : UIHelper.GetErrorBrush();
            ZapretDot.Fill = zColor;
            if (ZapretDot.Effect is System.Windows.Media.Effects.DropShadowEffect zShadow)
                zShadow.Color = zColor.Color;

            var pColor = isProxyRunning ? UIHelper.GetSuccessBrush() : UIHelper.GetErrorBrush();
            TgProxyDot.Fill = pColor;
            if (TgProxyDot.Effect is System.Windows.Media.Effects.DropShadowEffect pShadow)
                pShadow.Color = pColor.Color;
        }

        public void UpdateNetworkIndicator(bool isOnline)
        {
            var nColor = isOnline ? UIHelper.GetSuccessBrush() : UIHelper.GetErrorBrush();
            NetworkDot.Fill = nColor;
            if (NetworkDot.Effect is System.Windows.Media.Effects.DropShadowEffect nShadow)
                nShadow.Color = nColor.Color;
        }

        private void TitleBar_MouseLeftButtonDown(object sender, System.Windows.Input.MouseButtonEventArgs e)
        {
            if (e.ChangedButton == System.Windows.Input.MouseButton.Left)
                this.DragMove();
        }

        private void BtnMinimize_Click(object sender, RoutedEventArgs e) => this.WindowState = WindowState.Minimized;

        private void BtnClose_Click(object sender, RoutedEventArgs e) => this.Close();

        public void ShowNotification(string title, string message, System.Windows.Forms.ToolTipIcon icon = System.Windows.Forms.ToolTipIcon.Info)
        {
            _trayIconManager.ShowNotification(title, message, icon);
        }

        private void Window_Closing(object sender, System.ComponentModel.CancelEventArgs e)
        {
            if (SettingsManager.Current.MinimizeOnClose)
            {
                e.Cancel = true;
                this.Hide();
                ShowNotification("Программа работает в фоне", "Zapret свернут в системный трей. Дважды кликните по иконке в трее, чтобы открыть окно.");
            }
        }

        public bool IsBypassRunning() => BypassController.Current.IsRunning;

        public void ToggleBypass() => _homeView.ToggleFromTray();

        public async Task RestartBypassAsync()
        {
            var profile = _homeView.TxtMainProfile.Text;
            await BypassController.Current.RestartServicesAsync(profile);
            UpdateIndicators(BypassController.Current.Zapret.IsRunning(), BypassController.Current.TgProxy.IsRunning());
        }

        public void AnimateWindowSize(bool isCompact)
        {
            var widthAnim = new System.Windows.Media.Animation.DoubleAnimation
            {
                To = isCompact ? 850 : 1100,
                Duration = TimeSpan.FromSeconds(0.4),
                EasingFunction = new System.Windows.Media.Animation.CubicEase { EasingMode = System.Windows.Media.Animation.EasingMode.EaseOut }
            };
            var heightAnim = new System.Windows.Media.Animation.DoubleAnimation
            {
                To = isCompact ? 520 : 760,
                Duration = TimeSpan.FromSeconds(0.4),
                EasingFunction = new System.Windows.Media.Animation.CubicEase { EasingMode = System.Windows.Media.Animation.EasingMode.EaseOut }
            };

            RootBorder.BeginAnimation(FrameworkElement.WidthProperty, widthAnim);
            RootBorder.BeginAnimation(FrameworkElement.HeightProperty, heightAnim);
        }

        protected override void OnClosed(EventArgs e)
        {
            BypassController.Current.NetMonitor.Stop();
            _trayIconManager.Dispose();
            base.OnClosed(e);
        }
    }
}