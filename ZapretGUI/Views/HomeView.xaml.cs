using System;
using System.IO;
using System.Windows;
using System.Windows.Media;
using ZapretGUI.Core; // Подключаем ядро обхода

namespace ZapretGUI.Views
{
    public partial class HomeView : System.Windows.Controls.UserControl
    {
        private readonly ZapretManager _zapretManager;
        private readonly TgProxyManager _tgProxyManager;

        public HomeView()
        {
            InitializeComponent();
            _zapretManager = new ZapretManager();
            _tgProxyManager = new TgProxyManager();

            LoadProfiles();

            var isZapretRunning = _zapretManager.IsRunning();
            var isProxyRunning = _tgProxyManager.IsRunning();

            if (isZapretRunning || isProxyRunning)
            {
                MainToggle.IsChecked = true;
                ZapretToggle.IsChecked = isZapretRunning;
                TgProxyToggle.IsChecked = isProxyRunning;
                UpdateUIState(true);
                Log("Интерфейс загружен. Найдены активные процессы в фоне.");
            }
        }

        private void MainToggle_Click(object sender, RoutedEventArgs e)
        {
            var isEnabled = MainToggle.IsChecked ?? false;

            try
            {
                if (isEnabled)
                {
                    var isZapretSelected = ZapretToggle.IsChecked ?? false;
                    var isTgProxySelected = TgProxyToggle.IsChecked ?? false;

                    if (!isZapretSelected && !isTgProxySelected)
                    {
                        Log("⚠ Нет выбранных модулей для запуска! Включите тумблеры справа.");
                        MainToggle.IsChecked = false;
                        return;
                    }

                    Log("Инициализация запуска...");

                    if (isZapretSelected)
                    {
                        var selectedProfile = ProfileComboBox.Text;
                        Log($"[Zapret] Запуск профиля: {selectedProfile}...");
                        _zapretManager.Start(selectedProfile);
                        UpdateUIState(true);
                    }

                    if (isTgProxySelected)
                    {
                        Log("[TgWsProxy] Запуск прокси...");
                        _tgProxyManager.Start();
                    }

                    Log("✅ Выбранные модули успешно запущены.");
                }
                else
                {
                    Log("Остановка всех процессов...");

                    _zapretManager.Stop();
                    UpdateUIState(false);

                    _tgProxyManager.Stop();

                    Log("🛑 Все модули остановлены.");
                }
            }
            catch (Exception ex)
            {
                Log($"ОШИБКА: {ex.Message}");
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
                MainToggle.Content = "Остановить";
                ProfileComboBox.IsEnabled = false;
            }
            else
            {
                StatusText.Text = "Остановлен";
                StatusText.Foreground = new SolidColorBrush((System.Windows.Media.Color)System.Windows.Media.ColorConverter.ConvertFromString("#D13438"));
                MainToggle.Content = "Запустить";
                ProfileComboBox.IsEnabled = true;
            }
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

        private void Log(string message)
        {
            LogTextBox.Text += $"\n[{DateTime.Now:HH:mm:ss}] {message}";
        }
    }
}