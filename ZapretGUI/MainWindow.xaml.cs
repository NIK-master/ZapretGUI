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

            _homeView = new Views.HomeView();
            _settingsView = new Views.SettingsView();

            MainContentContainer.Content = _homeView;

            _zapretManager = new ZapretManager();
            SetupTrayIcon();
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
            BtnServices.Background = transparent;
            BtnServices.BorderThickness = zeroThickness;
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
            var green = new SolidColorBrush((System.Windows.Media.Color)System.Windows.Media.ColorConverter.ConvertFromString("#107C10"));
            var red = new SolidColorBrush((System.Windows.Media.Color)System.Windows.Media.ColorConverter.ConvertFromString("#D13438"));

            ZapretDot.Fill = isZapretRunning ? green : red;
            TgProxyDot.Fill = isProxyRunning ? green : red;
        }

        public void UpdateNetworkIndicator(bool isOnline)
        {
            var green = new SolidColorBrush((System.Windows.Media.Color)System.Windows.Media.ColorConverter.ConvertFromString("#107C10"));
            var red = new SolidColorBrush((System.Windows.Media.Color)System.Windows.Media.ColorConverter.ConvertFromString("#D13438"));

            NetworkDot.Fill = isOnline ? green : red;
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

            var contextMenu = new System.Windows.Forms.ContextMenuStrip();
            var openItem = contextMenu.Items.Add("Развернуть");
            openItem.Click += (s, e) => { this.Show(); this.WindowState = WindowState.Normal; };

            var closeItem = contextMenu.Items.Add("Выход");
            closeItem.Click += (s, e) =>
            {
                if (_zapretManager.IsRunning())
                {
                    _zapretManager.Stop();
                }
                _notifyIcon.Dispose();
                System.Windows.Application.Current.Shutdown();
            };

            _notifyIcon.ContextMenuStrip = contextMenu;
        }

        public void ShowNotification(string title, string message, System.Windows.Forms.ToolTipIcon icon = System.Windows.Forms.ToolTipIcon.Info)
        {
            var showNotifs = true;

            try
            {
                string configPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "config.json");
                if (File.Exists(configPath))
                {
                    using (var doc = System.Text.Json.JsonDocument.Parse(File.ReadAllText(configPath)))
                    {
                        if (doc.RootElement.TryGetProperty("NotificationsEnabled", out var prop))
                            showNotifs = prop.GetBoolean();
                    }
                }
            }
            catch { }

            if (showNotifs && _notifyIcon != null && _notifyIcon.Visible)
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
    }
}