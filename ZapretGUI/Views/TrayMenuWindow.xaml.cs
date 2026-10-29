using System;
using System.Diagnostics;
using System.IO;
using System.Windows;
using System.Windows.Media;
using System.Windows.Media.Animation;
using ZapretGUI.Core;

namespace ZapretGUI.Views
{
    public partial class TrayMenuWindow : Window
    {
        private bool _isRunning = false;

        public TrayMenuWindow()
        {
            InitializeComponent();
            TxtTrayVersion.Text = AppConstants.AppVersion;
            BypassController.Current.NetMonitor.StatsUpdated += OnNetStatsUpdated;
        }

        private void OnNetStatsUpdated(double rxMbps, double txMbps)
        {
            if (!IsVisible) return;

            Dispatcher.InvokeAsync(() =>
            {
                TxtDownloadSpeed.Text = $"{rxMbps:0.0} Мбит/с";
                TxtUploadSpeed.Text = $"{txMbps:0.0} Мбит/с";
                SyncStatus();
            });
        }

        public void PlayPopupAnimation()
        {
            var duration = new Duration(TimeSpan.FromMilliseconds(220));
            var ease = new CubicEase { EasingMode = EasingMode.EaseOut };

            MainBorder.BeginAnimation(UIElement.OpacityProperty, new DoubleAnimation(0.0, 1.0, duration) { EasingFunction = ease });
            MenuScale.BeginAnimation(ScaleTransform.ScaleYProperty, new DoubleAnimation(0.88, 1.0, duration) { EasingFunction = ease });
            MenuScale.BeginAnimation(ScaleTransform.ScaleXProperty, new DoubleAnimation(0.95, 1.0, duration) { EasingFunction = ease });
            MenuTranslate.BeginAnimation(TranslateTransform.YProperty, new DoubleAnimation(12.0, 0.0, duration) { EasingFunction = ease });
        }

        public void RefreshState()
        {
            SyncStatus();
            CheckPingAsync();
        }

        private void Window_Deactivated(object sender, EventArgs e)
        {
            this.Hide();
        }

        private async void CheckPingAsync()
        {
            PingText.Text = "...";
            PingText.Foreground = UIHelper.GetBrushFromHex("#888888");

            try
            {
                var pingMs = await BypassController.Current.CheckPingAsync();

                if (pingMs >= 0)
                {
                    PingText.Text = $"{pingMs} мс";

                    if (pingMs < 80)
                        PingText.Foreground = UIHelper.GetSuccessBrush();
                    else if (pingMs < 150)
                        PingText.Foreground = UIHelper.GetBrushFromHex("#FF8C00");
                    else
                        PingText.Foreground = UIHelper.GetErrorBrush();
                }
                else
                {
                    PingText.Text = "недоступен";
                    PingText.Foreground = UIHelper.GetErrorBrush();
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Ошибка проверки пинга из трея: {ex.Message}");
                PingText.Text = "ошибка";
                PingText.Foreground = UIHelper.GetErrorBrush();
            }
        }

        private void SyncStatus()
        {
            bool zapretRun = BypassController.Current.Zapret.IsRunning;
            bool proxyRun = BypassController.Current.TgProxy.IsRunning;
            _isRunning = zapretRun || proxyRun;

            var onlineBrush = UIHelper.GetSuccessBrush();
            var offlineBrush = UIHelper.GetErrorBrush();

            DotZapret.Fill = zapretRun ? onlineBrush : offlineBrush;
            DotProxy.Fill = proxyRun ? onlineBrush : offlineBrush;

            TxtActiveProfile.Text = string.IsNullOrWhiteSpace(SettingsManager.Current.SelectedProfileName)
                ? "general.bat"
                : SettingsManager.Current.SelectedProfileName;

            if (zapretRun && proxyRun)
                TxtSubStatus.Text = "Zapret + TgWsProxy активны";
            else if (zapretRun)
                TxtSubStatus.Text = "Обход Zapret активен";
            else if (proxyRun)
                TxtSubStatus.Text = "Прокси Telegram активен";
            else
                TxtSubStatus.Text = "Службы остановлены";

            TxtSubStatus.Foreground = _isRunning
                ? UIHelper.GetBrushFromHex("#4CAF50")
                : UIHelper.GetBrushFromHex("#888888");

            UpdateToggleButtonVisuals();
        }

        private void BtnTogglePower_Click(object sender, RoutedEventArgs e)
        {
            AudioHelper.PlayClick();
            _isRunning = !_isRunning;
            UpdateToggleButtonVisuals();

            if (System.Windows.Application.Current.MainWindow is MainWindow mainWindow)
                mainWindow.ToggleBypass();

            Dispatcher.InvokeAsync(async () =>
            {
                await System.Threading.Tasks.Task.Delay(450);
                SyncStatus();
            });
        }

        private void BtnRefreshPing_Click(object sender, RoutedEventArgs e)
        {
            AudioHelper.PlayClick();
            CheckPingAsync();
        }

        private async void BtnRestartBypass_Click(object sender, RoutedEventArgs e)
        {
            AudioHelper.PlayClick();
            TxtSubStatus.Text = "Перезапуск служб...";
            TxtSubStatus.Foreground = UIHelper.GetBrushFromHex("#FF8C00");

            if (System.Windows.Application.Current.MainWindow is MainWindow mainWindow)
            {
                await mainWindow.RestartBypassAsync();
            }
            SyncStatus();
        }

        private void UpdateToggleButtonVisuals()
        {
            BtnTogglePower.ApplyTemplate();

            var powerIcon = (System.Windows.Controls.TextBlock)BtnTogglePower.Template.FindName("PowerIcon", BtnTogglePower);
            var powerText = (System.Windows.Controls.TextBlock)BtnTogglePower.Template.FindName("PowerText", BtnTogglePower);

            if (_isRunning)
            {
                BtnTogglePower.Background = UIHelper.GetBrushFromHex("#2A1215");
                BtnTogglePower.BorderBrush = UIHelper.GetBrushFromHex("#D13438");

                if (powerIcon != null)
                {
                    powerIcon.Foreground = UIHelper.GetBrushFromHex("#F44336");
                    powerIcon.Text = "\xE71A";
                }
                if (powerText != null)
                    powerText.Text = "Остановить обход";
            }
            else
            {
                BtnTogglePower.Background = UIHelper.GetBrushFromHex("#132615");
                BtnTogglePower.BorderBrush = UIHelper.GetBrushFromHex("#107C10");

                if (powerIcon != null)
                {
                    powerIcon.Foreground = UIHelper.GetBrushFromHex("#4CAF50");
                    powerIcon.Text = "\xE7E8";
                }
                if (powerText != null)
                    powerText.Text = "Включить обход";
            }
        }

        private void BtnOpenApp_Click(object sender, RoutedEventArgs e)
        {
            AudioHelper.PlayClick();
            if (System.Windows.Application.Current.MainWindow != null)
            {
                System.Windows.Application.Current.MainWindow.Show();
                System.Windows.Application.Current.MainWindow.WindowState = WindowState.Normal;
                System.Windows.Application.Current.MainWindow.Activate();
            }
            this.Hide();
        }

        private void BtnExit_Click(object sender, RoutedEventArgs e)
        {
            AudioHelper.PlayClick();
            BypassController.Current.NetMonitor.StatsUpdated -= OnNetStatsUpdated;
            System.Windows.Application.Current.Shutdown();
        }
        private void BtnPrevProfile_Click(object sender, RoutedEventArgs e)
        {
            _ = CycleProfileAsync(-1);
        }

        private void BtnNextProfile_Click(object sender, RoutedEventArgs e)
        {
            _ = CycleProfileAsync(1);
        }

        private async System.Threading.Tasks.Task CycleProfileAsync(int dir)
        {
            AudioHelper.PlayClick();
            var profiles = BypassController.Current.Zapret.GetAvailableProfiles();
            if (profiles.Count == 0) return;

            var current = SettingsManager.Current.SelectedProfileName ?? "general.bat";
            var idx = profiles.FindIndex(p => string.Equals(p, current, StringComparison.OrdinalIgnoreCase));
            var nextIdx = idx < 0 ? 0 : (idx + dir + profiles.Count) % profiles.Count;
            var nextProfile = profiles[nextIdx];

            TxtActiveProfile.Text = nextProfile;

            if (System.Windows.Application.Current.MainWindow is MainWindow mainWindow)
            {
                if (BypassController.Current.Zapret.IsRunning)
                {
                    TxtSubStatus.Text = $"Запуск {nextProfile}...";
                    TxtSubStatus.Foreground = UIHelper.GetBrushFromHex("#FF8C00");
                }
                await mainWindow.SelectProfileFromTrayAsync(nextProfile);
            }
            SyncStatus();
        }
    }
}