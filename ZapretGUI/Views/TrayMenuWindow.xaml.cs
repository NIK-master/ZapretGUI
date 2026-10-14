using System;
using System.Diagnostics;
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
                var pingMs = await BypassController.Current.CheckPingAsync();

                if (pingMs >= 0)
                {
                    PingText.Text = $"{pingMs} мс";

                    if (pingMs < 80)
                        PingText.Foreground = UIHelper.GetSuccessBrush();
                    else if (pingMs < 150)
                        PingText.Foreground = new SolidColorBrush(System.Windows.Media.Colors.Orange);
                    else
                        PingText.Foreground = UIHelper.GetErrorBrush();
                }
                else
                {
                    PingText.Text = "ошибка";
                    PingText.Foreground = UIHelper.GetErrorBrush();
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Ошибка проверки пинга из трея: {ex.Message}");
                PingText.Text = "нет сети";
                PingText.Foreground = UIHelper.GetErrorBrush();
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