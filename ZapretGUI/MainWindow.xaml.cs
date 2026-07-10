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

        public MainWindow()
        {
            InitializeComponent();
            SetupTrayIcon();
            LoadProfiles();
            _zapretManager = new ZapretManager();

            if (_zapretManager.IsRunning())
            {
                MainToggle.IsChecked = true;
                UpdateUIState(true);
                LogTextBox.Text = $"[{DateTime.Now:HH:mm:ss}] Программа запущена. Обход уже работает.\n";
            }
        }

        private void MainToggle_Click(object sender, RoutedEventArgs e)
        {
            var isEnabled = MainToggle.IsChecked ?? false;

            try
            {
                if (isEnabled)
                {
                    var selectedProfile = ProfileComboBox.Text;

                    LogTextBox.AppendText($"\n[{DateTime.Now:HH:mm:ss}] Запуск профиля: {selectedProfile}...\n");

                    _zapretManager.Start(selectedProfile);

                    UpdateUIState(true);
                    LogTextBox.AppendText($"[{DateTime.Now:HH:mm:ss}] Успешно запущено. Трафик фильтруется.\n");
                }
                else
                {
                    LogTextBox.AppendText($"\n[{DateTime.Now:HH:mm:ss}] Остановка процессов winws...\n");

                    _zapretManager.Stop();

                    UpdateUIState(false);
                    LogTextBox.AppendText($"[{DateTime.Now:HH:mm:ss}] Остановлено.\n");
                }

                LogTextBox.ScrollToEnd();
            }
            catch (Exception ex)
            {
                LogTextBox.AppendText($"\n[{DateTime.Now:HH:mm:ss}] ОШИБКА: {ex.Message}\n");
                MainToggle.IsChecked = false;
                UpdateUIState(false);
            }
        }

        private void UpdateUIState(bool isRunning)
        {
            if (isRunning)
            {
                StatusText.Text = "Работает";
                StatusText.Foreground = new SolidColorBrush((System.Windows.Media.Color)System.Windows.Media.ColorConverter.ConvertFromString("#107C10"));
                MainToggle.Content = "On";
            }
            else
            {
                StatusText.Text = "Остановлен";
                StatusText.Foreground = new SolidColorBrush((System.Windows.Media.Color)System.Windows.Media.ColorConverter.ConvertFromString("#D13438"));
                MainToggle.Content = "Off";
            }
        }

        private void BtnOpenFolder_Click(object sender, RoutedEventArgs e)
        {
            var folderPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "ZapretFiles");

            if (Directory.Exists(folderPath))
                Process.Start("explorer.exe", folderPath);
            else
            {
                System.Windows.MessageBox.Show("Папка ZapretFiles не найдена рядом с исполняемым файлом!",
                                "Ошибка", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private void BtnService_Click(object sender, RoutedEventArgs e)
        {
            System.Windows.MessageBox.Show("Функционал работы со службами Windows будет добавлен в следующих версиях.",
                            "В разработке", MessageBoxButton.OK, MessageBoxImage.Information);
        }

        private void LoadProfiles()
        {
            ProfileComboBox.Items.Clear();
            var folderPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "ZapretFiles");

            if (Directory.Exists(folderPath))
            {
                var batFiles = Directory.GetFiles(folderPath, "general*.bat");
                foreach (var file in batFiles)
                    ProfileComboBox.Items.Add(Path.GetFileName(file));

                if (ProfileComboBox.Items.Count > 0)
                    ProfileComboBox.SelectedIndex = 0;
            }
        }

        private void SetupTrayIcon()
        {
            _notifyIcon = new System.Windows.Forms.NotifyIcon();

            _notifyIcon.Icon = System.Drawing.SystemIcons.Shield;
            _notifyIcon.Text = "Запрет для СДВГ";
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
                    _zapretManager.Stop();

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
    }
}