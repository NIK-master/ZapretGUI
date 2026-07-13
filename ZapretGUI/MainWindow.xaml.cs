using System;
using System.Diagnostics;
using System.IO;
using System.Windows;
using ZapretGUI.Core;

namespace ZapretGUI
{
    public partial class MainWindow : Window
    {
        private readonly ZapretManager _zapretManager;
        private System.Windows.Forms.NotifyIcon? _notifyIcon;

        public MainWindow()
        {
            InitializeComponent();
            MainContentContainer.Content = new Views.HomeView();
            _zapretManager = new ZapretManager();
            SetupTrayIcon();

            // ВРЕМЕННО ЗАКОММЕНТИРОВАЛИ ДО СОЗДАНИЯ НОВЫХ ВКЛАДОК:
            // LoadProfiles();
            // if (_zapretManager.IsRunning())
            // { ... }
        }


        private void TitleBar_MouseLeftButtonDown(object sender, System.Windows.Input.MouseButtonEventArgs e)
        {
            if (e.ChangedButton == System.Windows.Input.MouseButton.Left)
            {
                this.DragMove();
            }
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
            _notifyIcon.Icon = System.Drawing.SystemIcons.Shield;
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

        private void Window_Closing(object sender, System.ComponentModel.CancelEventArgs e)
        {
            e.Cancel = true;
            this.Hide();
        }

        private void BtnHome_Click(object sender, RoutedEventArgs e)
        { 
            MainContentContainer.Content = new Views.HomeView();
        }

        // =========================================================
        // ВРЕМЕННО ЗАКОММЕНТИРОВАННЫЙ СТАРЫЙ КОД (ПЕРЕНЕСЕМ ПОЗЖЕ)
        // =========================================================
        /*
        private void MainToggle_Click(object sender, RoutedEventArgs e)
        {
            // ... старый код запуска ...
        }

        private void UpdateUIState(bool isRunning)
        {
            // ... старый код смены цветов ...
        }

        private void BtnOpenFolder_Click(object sender, RoutedEventArgs e)
        {
            // ... старый код открытия папки ...
        }

        private void BtnService_Click(object sender, RoutedEventArgs e)
        {
            // ... старый код сервиса ...
        }

        private void LoadProfiles()
        {
            // ... загрузка батников ...
        }
        */
    }
}