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

            // Запуск фоновых асинхронных проверок обновлений
            _ = Core.UpdateManager.CheckForUpdatesAsync();

            // Коллбек, который корректно остановит обход через UI-триггер в случае обновления ядер
            Action stopServicesAction = () =>
            {
                if (_homeView.IsRunning)
                {
                    _homeView.ToggleFromTray();
                }
            };

            _ = Core.UpdateManager.CheckForZapretCoreUpdatesAsync(stopServicesAction);
            _ = Core.UpdateManager.CheckForTgProxyCoreUpdatesAsync(stopServicesAction);
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
            BtnMods.Background = transparent;
            BtnMods.BorderThickness = zeroThickness;
            BtnSettings.Background = transparent;
            BtnSettings.BorderThickness = zeroThickness;

            activeBtn.Background = new SolidColorBrush((System.Windows.Media.Color)System.Windows.Media.ColorConverter.ConvertFromString("#2A2A2A"));
            activeBtn.BorderBrush = new SolidColorBrush((System.Windows.Media.Color)System.Windows.Media.ColorConverter.ConvertFromString("#107C10"));
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
            _notifyIcon = new System.Windows.Forms.NotifyIcon();
            try
            {
                var iconUri = new Uri("pack://application:,,,/Assets/freepik__толстая,_сплошная,_монолитная_буква_z_белого.png");
                var stream = System.Windows.Application.GetResourceStream(iconUri).Stream;
                var bitmap = new System.Drawing.Bitmap(stream);

                _notifyIcon.Icon = System.Drawing.Icon.FromHandle(bitmap.GetHicon());
            }
            catch
            {
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

                var trayMenu = new Views.TrayMenuWindow();

                trayMenu.WindowStartupLocation = WindowStartupLocation.Manual;
                trayMenu.Show();

                var mousePos = System.Windows.Forms.Control.MousePosition;

                trayMenu.Left = mousePos.X - trayMenu.ActualWidth;
                trayMenu.Top = mousePos.Y - trayMenu.ActualHeight - 20;

                trayMenu.Activate();
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
            return new SolidColorBrush((System.Windows.Media.Color)System.Windows.Media.ColorConverter.ConvertFromString(hex));
        }

        private SolidColorBrush GetErrorColor()
        {
            var hex = SettingsManager.Current.ColorblindMode ? "#FF8C00" : "#D13438";
            return new SolidColorBrush((System.Windows.Media.Color)System.Windows.Media.ColorConverter.ConvertFromString(hex));
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
    }
}