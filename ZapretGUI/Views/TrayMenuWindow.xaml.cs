using System;
using System.Diagnostics;
using System.Net.Sockets;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Media;
using ZapretGUI.Core;

namespace ZapretGUI.Views
{
    public partial class TrayMenuWindow : Window
    {
        private bool _isRunning = false;

        public TrayMenuWindow()
        {
            InitializeComponent();
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
            PingText.Text = "измерение...";
            PingText.Foreground = new SolidColorBrush(System.Windows.Media.Colors.Gray);

            try
            {
                var hostToPing = "ec2.eu-central-1.amazonaws.com";
                var portToPing = 443;

                var fullUrl = Core.SettingsManager.Current.PingUrl;
                if (!string.IsNullOrWhiteSpace(fullUrl))
                {
                    if (Uri.TryCreate(fullUrl, UriKind.Absolute, out Uri? uri))
                    {
                        hostToPing = uri.Host;
                        portToPing = uri.Port > 0 ? uri.Port : 443;
                    }
                    else
                        hostToPing = fullUrl;
                }

                var pingMs = await TcpPingAsync(hostToPing, portToPing);

                if (pingMs >= 0)
                {
                    PingText.Text = $"{pingMs} мс";

                    if (pingMs < 80)
                        PingText.Foreground = UIHelper.GetBrushFromHex("#4CAF50");
                    else if (pingMs < 150)
                        PingText.Foreground = new SolidColorBrush(System.Windows.Media.Colors.Orange);
                    else
                        PingText.Foreground = UIHelper.GetBrushFromHex("#F44336");
                }
                else
                {
                    PingText.Text = "ошибка";
                    PingText.Foreground = UIHelper.GetBrushFromHex("#F44336");
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Ошибка проверки пинга из трея: {ex.Message}");
                PingText.Text = "нет сети";
                PingText.Foreground = UIHelper.GetBrushFromHex("#F44336");
            }
        }

        private async Task<long> TcpPingAsync(string host, int port)
        {
            try
            {
                using var client = new TcpClient();
                var stopwatch = new Stopwatch();

                stopwatch.Start();
                var connectTask = client.ConnectAsync(host, port);

                if (await Task.WhenAny(connectTask, Task.Delay(2000)) == connectTask)
                {
                    stopwatch.Stop();
                    return client.Connected ? stopwatch.ElapsedMilliseconds : -1;
                }

                return -1;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"TCP Ping Failed: {ex.Message}");
                return -1;
            }
        }

        private void SyncStatus()
        {
            if (System.Windows.Application.Current.MainWindow is MainWindow mainWindow)
                _isRunning = mainWindow.IsBypassRunning();

            UpdateToggleButtonVisuals();
        }

        private void BtnTogglePower_Click(object sender, RoutedEventArgs e)
        {
            _isRunning = !_isRunning;
            UpdateToggleButtonVisuals();

            if (System.Windows.Application.Current.MainWindow is MainWindow mainWindow)
                mainWindow.ToggleBypass();
        }

        private void UpdateToggleButtonVisuals()
        {
            BtnTogglePower.ApplyTemplate();

            var powerIcon = (System.Windows.Controls.TextBlock)BtnTogglePower.Template.FindName("PowerIcon", BtnTogglePower);
            var powerText = (System.Windows.Controls.TextBlock)BtnTogglePower.Template.FindName("PowerText", BtnTogglePower);

            if (_isRunning)
            {
                BtnTogglePower.Background = UIHelper.GetBrushFromHex("#331A1A");
                BtnTogglePower.BorderBrush = UIHelper.GetBrushFromHex("#5C2E2E");

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
                BtnTogglePower.Background = UIHelper.GetBrushFromHex("#1B3320");
                BtnTogglePower.BorderBrush = UIHelper.GetBrushFromHex("#2E5C37");

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
            System.Windows.Application.Current.Shutdown();
        }


    }
}