using System;
using System.Diagnostics;
using System.IO;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Media;
using ZapretGUI.Core;

namespace ZapretGUI
{
    public partial class MainWindow : Window
    {
        private readonly ZapretManager _zapretManager;
        private readonly TrayIconManager _trayIconManager;

        private Views.HomeView _homeView;
        private Views.SettingsView _settingsView;
        private Views.DiagnosticsView _diagnosticsView = new Views.DiagnosticsView();

        public MainWindow()
        {
            InitializeComponent();
            SettingsManager.Load();

            var modManager = new ModManager();
            modManager.InitializeFolders();
            modManager.SyncActiveBatMods();
            modManager.ApplyListMods();

            _homeView = new Views.HomeView();
            _settingsView = new Views.SettingsView();
            MainContentContainer.Content = _homeView;

            _zapretManager = new ZapretManager();
            _trayIconManager = new TrayIconManager(this);

            var configPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "config.json");
            if (!File.Exists(configPath))
            {
                var wizard = new Views.WizardWindow();
                wizard.ShowDialog();
            }

            _ = CheckUpdatesOnStartupAsync();
        }

        private async Task CheckUpdatesOnStartupAsync()
        {
            var appUpdate = await Core.UpdateManager.CheckForAppUpdateAsync();
            if (appUpdate.UpdateAvailable)
            {
                var prompt = new Views.UpdateWindow("Обновление программы", $"Доступна новая версия панели управления {appUpdate.Version}!\n\nПрограмма будет закрыта для установки обновления. Продолжить?");
                prompt.ShowDialog();

                if (prompt.Result)
                {
                    if (!string.IsNullOrEmpty(appUpdate.DownloadUrl))
                    {
                        try { await Core.UpdateManager.ApplyAppUpdateAsync(appUpdate.DownloadUrl, () => System.Windows.Application.Current.Shutdown()); }
                        catch (Exception ex) { new Views.UpdateWindow("Ошибка обновления", $"Не удалось обновить программу: {ex.Message}", "ОК").ShowDialog(); }
                    }
                    else if (!string.IsNullOrEmpty(appUpdate.ReleaseUrl))
                    {
                        Process.Start(new ProcessStartInfo(appUpdate.ReleaseUrl) { UseShellExecute = true });
                    }
                }
            }

            Action stopServicesAction = () => { if (IsBypassRunning()) ToggleBypass(); };
            var progress = new Progress<string>(status => _homeView.ShowUpdateProgress(status));

            var zapretUpdate = await Core.UpdateManager.CheckForCoreUpdateAsync("https://api.github.com/repos/flowseal/zapret-discord-youtube/releases/latest", SettingsManager.Current.ZapretCoreVersion, "Zapret", true);
            if (zapretUpdate.UpdateAvailable)
            {
                var prompt = new Views.UpdateWindow("Обновление ядра Zapret", $"Найдено обновление обхода Zapret от flowseal ({zapretUpdate.Version})!\n\nТекущая версия: {zapretUpdate.CurrentVersion}\nОбновить автоматически?");
                prompt.ShowDialog();
                if (prompt.Result)
                {
                    try
                    {
                        await Core.UpdateManager.InstallCoreAsync(zapretUpdate, stopServicesAction, progress);
                        SettingsManager.Current.ZapretCoreVersion = zapretUpdate.Version;
                        SettingsManager.Save();
                        new Views.UpdateWindow("Успех", $"Модуль Zapret успешно обновлен до версии {zapretUpdate.Version}!", "ОК").ShowDialog();
                    }
                    catch (Exception ex) { new Views.UpdateWindow("Ошибка", $"Ошибка при установке обновления Zapret: {ex.Message}", "ОК").ShowDialog(); }
                }
            }

            var proxyUpdate = await Core.UpdateManager.CheckForCoreUpdateAsync("https://api.github.com/repos/flowseal/tg-ws-proxy/releases/latest", SettingsManager.Current.TgProxyCoreVersion, "TgWsProxy", false);
            if (proxyUpdate.UpdateAvailable)
            {
                var prompt = new Views.UpdateWindow("Обновление ядра TgWsProxy", $"Найдено обновление прокси Telegram от flowseal ({proxyUpdate.Version})!\n\nТекущая версия: {proxyUpdate.CurrentVersion}\nОбновить автоматически?");
                prompt.ShowDialog();
                if (prompt.Result)
                {
                    try
                    {
                        await Core.UpdateManager.InstallCoreAsync(proxyUpdate, stopServicesAction, progress);
                        SettingsManager.Current.TgProxyCoreVersion = proxyUpdate.Version;
                        SettingsManager.Save();
                        new Views.UpdateWindow("Успех", $"Модуль TgWsProxy успешно обновлен до версии {proxyUpdate.Version}!", "ОК").ShowDialog();
                    }
                    catch (Exception ex) { new Views.UpdateWindow("Ошибка", $"Ошибка при установке обновления TgWsProxy: {ex.Message}", "ОК").ShowDialog(); }
                }
            }
        }

        private void BtnHome_Click(object sender, RoutedEventArgs e)
        {
            if (MainContentContainer.Content == _homeView) return;
            MainContentContainer.Content = _homeView;
            SetActiveTab(BtnHome);
        }

        private void BtnSettings_Click(object sender, RoutedEventArgs e)
        {
            if (MainContentContainer.Content == _settingsView) return;
            MainContentContainer.Content = _settingsView;
            SetActiveTab(BtnSettings);
        }

        private void BtnDiagnostics_Click(object sender, RoutedEventArgs e)
        {
            if (MainContentContainer.Content == _diagnosticsView) return;
            MainContentContainer.Content = _diagnosticsView;
            SetActiveTab(BtnDiagnostics);
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

        private void BtnMinimize_Click(object sender, RoutedEventArgs e) => this.WindowState = WindowState.Minimized;

        private void BtnClose_Click(object sender, RoutedEventArgs e) => this.Hide();

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
                ShowNotification("Программа работает в фоне", "Zapret свернут в системный трей. Дважды кликните по иконке щита, чтобы открыть окно.");
            }
        }

        public bool IsBypassRunning() => _homeView.IsRunning;

        public void ToggleBypass() => _homeView.ToggleFromTray();

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
            var widthAnim = new System.Windows.Media.Animation.DoubleAnimation
            {
                To = isCompact ? 850 : 1100,
                Duration = TimeSpan.FromSeconds(0.4),
                EasingFunction = new System.Windows.Media.Animation.CubicEase { EasingMode = System.Windows.Media.Animation.EasingMode.EaseOut }
            };
            var heightAnim = new System.Windows.Media.Animation.DoubleAnimation
            {
                To = isCompact ? 490 : 760,
                Duration = TimeSpan.FromSeconds(0.4),
                EasingFunction = new System.Windows.Media.Animation.CubicEase { EasingMode = System.Windows.Media.Animation.EasingMode.EaseOut }
            };

            RootBorder.BeginAnimation(FrameworkElement.WidthProperty, widthAnim);
            RootBorder.BeginAnimation(FrameworkElement.HeightProperty, heightAnim);
        }

        protected override void OnClosed(EventArgs e)
        {
            _trayIconManager.Dispose();
            base.OnClosed(e);
        }
    }
}