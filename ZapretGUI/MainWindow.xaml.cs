using System;
using System.Diagnostics;
using System.IO;
using System.Windows;
using System.Windows.Media;
using ZapretGUI.Core;

namespace ZapretGUI
{
    public partial class MainWindow : Window
    {
        private readonly ZapretManager _zapretManager;
        private System.Windows.Forms.NotifyIcon? _notifyIcon;

        private Views.HomeView _homeView;
        private Views.SettingsView _settingsView;
        private Views.DiagnosticsView _diagnosticsView = new Views.DiagnosticsView();
        private Views.TrayMenuWindow _trayMenu = null!;

        public MainWindow()
        {
            InitializeComponent();

            SettingsManager.Load();

            _homeView = new Views.HomeView();
            _settingsView = new Views.SettingsView();

            MainContentContainer.Content = _homeView;

            _zapretManager = new ZapretManager();
            SetupTrayIcon();

            var configPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "config.json");
            if (!File.Exists(configPath))
            {
                var wizard = new Views.WizardWindow();
                wizard.ShowDialog();
            }

            _ = Core.UpdateManager.CheckForUpdatesAsync();

            Action stopServicesAction = () =>
            {
                if (_homeView.IsRunning)
                {
                    _homeView.ToggleFromTray();
                }
            };

            var updateProgress = new Progress<string>(status =>
            {
                _homeView.ShowUpdateProgress(status);
            });

            _ = Core.UpdateManager.CheckForZapretCoreUpdatesAsync(stopServicesAction, updateProgress);
            _ = Core.UpdateManager.CheckForTgProxyCoreUpdatesAsync(stopServicesAction, updateProgress);
        }

        private void BtnHome_Click(object sender, RoutedEventArgs e)
        {
            if (MainContentContainer.Content == _homeView)
                return;

            MainContentContainer.Content = _homeView;
            SetActiveTab(BtnHome);
        }

        private void BtnSettings_Click(object sender, RoutedEventArgs e)
        {
            if (MainContentContainer.Content == _settingsView)
                return;

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

            BtnSettings.Background = transparent;
            BtnSettings.BorderThickness = zeroThickness;

            activeBtn.Background = UIHelper.GetBrushFromHex("#2A2A2A");
            activeBtn.BorderBrush = UIHelper.GetBrushFromHex("#107C10");
            activeBtn.BorderThickness = new Thickness(3, 0, 0, 0);
        }

        public void UpdateIndicators(bool isZapretRunning, bool isProxyRunning)
        {
            ZapretDot.Fill = isZapretRunning ? GetSuccessColor() : GetErrorColor();
            TgProxyDot.Fill = isProxyRunning ? GetSuccessColor() : GetErrorColor();
        }

        public void UpdateNetworkIndicator(bool isOnline)
        {
            NetworkDot.Fill = isOnline ? GetSuccessColor() : GetErrorColor();
        }

        private void TitleBar_MouseLeftButtonDown(object sender, System.Windows.Input.MouseButtonEventArgs e)
        {
            if (e.ChangedButton == System.Windows.Input.MouseButton.Left)
                this.DragMove();
        }

        private void BtnMinimize_Click(object sender, RoutedEventArgs e)
        {
            this.WindowState = WindowState.Minimized;
        }

        private void BtnClose_Click(object sender, RoutedEventArgs e)
        {
            this.Hide();
        }

        private void SetupTrayIcon()
        {
            _trayMenu = new Views.TrayMenuWindow();
            _trayMenu.WindowStartupLocation = WindowStartupLocation.Manual;

            _notifyIcon = new System.Windows.Forms.NotifyIcon();
            try
            {
                var iconUri = new Uri("pack://application:,,,/Assets/freepik__толстая,_сплошная,_монолитная_буква_z_белого.png");
                var stream = System.Windows.Application.GetResourceStream(iconUri).Stream;
                var bitmap = new System.Drawing.Bitmap(stream);

                _notifyIcon.Icon = System.Drawing.Icon.FromHandle(bitmap.GetHicon());
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Ошибка загрузки иконки в трей: {ex.Message}");
                _notifyIcon.Icon = System.Drawing.SystemIcons.Shield;
            }
            _notifyIcon.Text = "Zapret for ADHD";
            _notifyIcon.Visible = true;

            _notifyIcon.DoubleClick += (s, e) =>
            {
                this.Show();
                this.WindowState = WindowState.Normal;
            };

            _notifyIcon.MouseClick += (s, e) =>
            {
                if (e.Button != System.Windows.Forms.MouseButtons.Left && e.Button != System.Windows.Forms.MouseButtons.Right)
                    return;

                _trayMenu.Show();
                _trayMenu.UpdateLayout();

                var mousePos = System.Windows.Forms.Control.MousePosition;

                var source = PresentationSource.FromVisual(this);
                double dpiX = 1.0, dpiY = 1.0;
                if (source?.CompositionTarget != null)
                {
                    dpiX = source.CompositionTarget.TransformFromDevice.M11;
                    dpiY = source.CompositionTarget.TransformFromDevice.M22;
                }

                _trayMenu.Left = (mousePos.X * dpiX) - _trayMenu.ActualWidth;
                _trayMenu.Top = (mousePos.Y * dpiY) - _trayMenu.ActualHeight - 20;

                _trayMenu.Activate();
                _trayMenu.RefreshState();
            };
        }

        public void ShowNotification(string title, string message, System.Windows.Forms.ToolTipIcon icon = System.Windows.Forms.ToolTipIcon.Info)
        {
            if (SettingsManager.Current.NotificationsEnabled && _notifyIcon != null && _notifyIcon.Visible)
                _notifyIcon.ShowBalloonTip(3000, title, message, icon);
        }

        private void Window_Closing(object sender, System.ComponentModel.CancelEventArgs e)
        {
            e.Cancel = true;
            this.Hide();

            ShowNotification(
                "Программа работает в фоне",
                "Zapret свернут в системный трей. Дважды кликните по иконке щита, чтобы открыть окно.",
                System.Windows.Forms.ToolTipIcon.Info);
        }

        public bool IsBypassRunning()
        {
            return _homeView.IsRunning;
        }

        public void ToggleBypass()
        {
            _homeView.ToggleFromTray();
        }

        private SolidColorBrush GetSuccessColor()
        {
            var hex = SettingsManager.Current.ColorblindMode ? "#0078D7" : "#107C10";
            return UIHelper.GetBrushFromHex(hex);
        }

        private SolidColorBrush GetErrorColor()
        {
            var hex = SettingsManager.Current.ColorblindMode ? "#FF8C00" : "#D13438";
            return UIHelper.GetBrushFromHex(hex);
        }

        public void AnimateWindowSize(bool isCompact)
        {
            double normalWidth = 1100;
            double normalHeight = 760;

            double compactWidth = 850;
            double compactHeight = 490;

            var widthAnim = new System.Windows.Media.Animation.DoubleAnimation
            {
                To = isCompact ? compactWidth : normalWidth,
                Duration = TimeSpan.FromSeconds(0.4),
                EasingFunction = new System.Windows.Media.Animation.CubicEase { EasingMode = System.Windows.Media.Animation.EasingMode.EaseOut }
            };

            var heightAnim = new System.Windows.Media.Animation.DoubleAnimation
            {
                To = isCompact ? compactHeight : normalHeight,
                Duration = TimeSpan.FromSeconds(0.4),
                EasingFunction = new System.Windows.Media.Animation.CubicEase { EasingMode = System.Windows.Media.Animation.EasingMode.EaseOut }
            };

            RootBorder.BeginAnimation(FrameworkElement.WidthProperty, widthAnim);
            RootBorder.BeginAnimation(FrameworkElement.HeightProperty, heightAnim);
        }

        private void BtnDiagnostics_Click(object sender, RoutedEventArgs e)
        {
            if (MainContentContainer.Content == _diagnosticsView)
                return;

            MainContentContainer.Content = _diagnosticsView;
            SetActiveTab(BtnDiagnostics);
        }

        protected override void OnClosed(EventArgs e)
        {
            _notifyIcon?.Dispose();
            base.OnClosed(e);
        }
    }
}