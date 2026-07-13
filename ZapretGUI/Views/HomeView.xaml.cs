using System;
using System.Diagnostics;
using System.IO;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Text.Json;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Effects;
using System.Windows.Threading;
using ZapretGUI.Core;

namespace ZapretGUI.Views
{
    public partial class HomeView : System.Windows.Controls.UserControl
    {
        private readonly ZapretManager _zapretManager;
        private readonly TgProxyManager _tgProxyManager;

        private DispatcherTimer? _networkTimer;
        private long _lastBytesReceived = 0;
        private long _lastBytesSent = 0;

        public HomeView()
        {
            InitializeComponent();
            _zapretManager = new ZapretManager();
            _tgProxyManager = new TgProxyManager();

            LoadProfiles();
            LoadSettings();

            StartNetworkMonitor();
            _ = PingNetworkAsync();

            var isZapretRunning = _zapretManager.IsRunning();
            var isProxyRunning = _tgProxyManager.IsRunning();

            if (isZapretRunning || isProxyRunning)
            {
                MainToggle.IsChecked = true;
                UpdateUIState(true);
                SyncMainWindowIndicators();
                Log("Интерфейс загружен. Найдены активные процессы в фоне.");
            }
            else
            {
                Log("Интерфейс загружен. Ожидание команд...");
            }
        }

        private void StartNetworkMonitor()
        {
            _networkTimer = new DispatcherTimer
            {
                Interval = TimeSpan.FromSeconds(1)
            };
            _networkTimer.Tick += NetworkTimer_Tick;
            _networkTimer.Start();
        }

        private void NetworkTimer_Tick(object? sender, EventArgs e)
        {
            long currentReceived = 0;
            long currentSent = 0;

            var interfaces = NetworkInterface.GetAllNetworkInterfaces();
            foreach (var netInterface in interfaces)
            {
                if (netInterface.OperationalStatus == OperationalStatus.Up &&
                    netInterface.NetworkInterfaceType != NetworkInterfaceType.Loopback)
                {
                    var stats = netInterface.GetIPv4Statistics();
                    currentReceived += stats.BytesReceived;
                    currentSent += stats.BytesSent;
                }
            }

            if (_lastBytesReceived != 0 && _lastBytesSent != 0)
            {
                var diffReceived = currentReceived - _lastBytesReceived;
                var diffSent = currentSent - _lastBytesSent;

                var mbpsReceived = (diffReceived * 8.0) / 1000000.0;
                var mbpsSent = (diffSent * 8.0) / 1000000.0;

                DownloadText.Text = mbpsReceived.ToString("0.0");
                UploadText.Text = mbpsSent.ToString("0.0");
            }

            _lastBytesReceived = currentReceived;
            _lastBytesSent = currentSent;
        }

        private async void BtnRefreshPing_Click(object sender, RoutedEventArgs e)
        {
            await PingNetworkAsync();
        }

        private async Task PingNetworkAsync()
        {
            try
            {
                BtnRefreshPing.IsEnabled = false;
                PingText.Text = "...";

                var rotateAnim = new System.Windows.Media.Animation.DoubleAnimation(0, 360, TimeSpan.FromSeconds(1))
                {
                    RepeatBehavior = System.Windows.Media.Animation.RepeatBehavior.Forever
                };
                PingIconTransform.BeginAnimation(System.Windows.Media.RotateTransform.AngleProperty, rotateAnim);

                var pingMs = await TcpPingAsync("gateway.discord.gg", 443);

                if (pingMs >= 0)
                {
                    PingText.Text = pingMs.ToString();
                    SyncNetworkIndicator(true);
                }
                else
                {
                    PingText.Text = "—";
                    SyncNetworkIndicator(false);
                }
            }
            catch
            {
                PingText.Text = "—";
                SyncNetworkIndicator(false);
            }
            finally
            {
                PingIconTransform.BeginAnimation(System.Windows.Media.RotateTransform.AngleProperty, null);
                PingIconTransform.Angle = 0;
                BtnRefreshPing.IsEnabled = true;
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
            catch
            {
                return -1;
            }
        }

        private void SyncMainWindowIndicators()
        {
            if (System.Windows.Application.Current.MainWindow is MainWindow mainWindow)
                mainWindow.UpdateIndicators(_zapretManager.IsRunning(), _tgProxyManager.IsRunning());
        }

        private void SyncNetworkIndicator(bool isOnline)
        {
            if (System.Windows.Application.Current.MainWindow is MainWindow mainWindow)
                mainWindow.UpdateNetworkIndicator(isOnline);
        }

        private async void MainToggle_Click(object sender, RoutedEventArgs e)
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
                        Log("⚠ ОШИБКА: Нет выбранных модулей для запуска!");
                        TriggerErrorGlitch();
                        MainToggle.IsChecked = false;
                        return;
                    }

                    MainToggle.IsEnabled = false;
                    LaunchProgressBar.Visibility = Visibility.Visible;

                    LaunchProgressBar.BeginAnimation(System.Windows.Controls.ProgressBar.ValueProperty, null);
                    LaunchProgressBar.Value = 0;
                    Log("Инициализация запуска...");

                    await Task.Delay(200);
                    AnimateProgressBar(20);

                    if (isZapretSelected)
                    {
                        var selectedProfile = ProfileComboBox.Text;
                        Log($"[Zapret] Подготовка профиля {selectedProfile}...");
                        await Task.Delay(400);
                        Log($"[Zapret] Запуск службы...");
                        _zapretManager.Start(selectedProfile);
                        AnimateProgressBar(60);
                    }

                    if (isTgProxySelected)
                    {
                        Log("[TgWsProxy] Настройка маршрутов...");
                        await Task.Delay(300);
                        Log("[TgWsProxy] Запуск прокси...");
                        _tgProxyManager.Start();
                        AnimateProgressBar(90);
                    }

                    await Task.Delay(300);
                    AnimateProgressBar(100);

                    UpdateUIState(true);
                    SyncMainWindowIndicators();
                    Log("✅ Выбранные модули успешно запущены.");

                    await Task.Delay(500);
                    LaunchProgressBar.Visibility = Visibility.Collapsed;
                    MainToggle.IsEnabled = true;

                    _ = PingNetworkAsync();
                }
                else
                {
                    Log("Остановка всех процессов...");
                    _zapretManager.Stop();
                    _tgProxyManager.Stop();

                    UpdateUIState(false);
                    SyncMainWindowIndicators();
                    Log("🛑 Все модули остановлены.");

                    _ = PingNetworkAsync();
                }
            }
            catch (Exception ex)
            {
                Log($"ОШИБКА: {ex.Message}");
                TriggerErrorGlitch();

                MainToggle.IsChecked = false;
                UpdateUIState(false);
                LaunchProgressBar.Visibility = Visibility.Collapsed;
                MainToggle.IsEnabled = true;
            }
        }

        private void AnimateProgressBar(double targetValue)
        {
            var animation = new System.Windows.Media.Animation.DoubleAnimation
            {
                To = targetValue,
                Duration = TimeSpan.FromMilliseconds(400),
                EasingFunction = new System.Windows.Media.Animation.QuadraticEase { EasingMode = System.Windows.Media.Animation.EasingMode.EaseOut }
            };

            LaunchProgressBar.BeginAnimation(System.Windows.Controls.ProgressBar.ValueProperty, animation);
        }

        private void UpdateUIState(bool isRunning)
        {
            if (isRunning)
            {
                StatusText.Text = "Работает";
                StatusText.Foreground = new SolidColorBrush((System.Windows.Media.Color)System.Windows.Media.ColorConverter.ConvertFromString("#107C10"));
                ProfileComboBox.IsEnabled = false;
            }
            else
            {
                StatusText.Text = "Остановлен";
                StatusText.Foreground = new SolidColorBrush((System.Windows.Media.Color)System.Windows.Media.ColorConverter.ConvertFromString("#D13438"));
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

        private class AppSettings
        {
            public bool ZapretEnabled { get; set; } = true;
            public bool TgProxyEnabled { get; set; } = true;
            public int SelectedProfileIndex { get; set; } = 0;
        }

        private readonly string _settingsPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "config.json");

        private void LoadSettings()
        {
            try
            {
                if (File.Exists(_settingsPath))
                {
                    string json = File.ReadAllText(_settingsPath);
                    var settings = JsonSerializer.Deserialize<AppSettings>(json);

                    if (settings != null)
                    {
                        ZapretToggle.IsChecked = settings.ZapretEnabled;
                        TgProxyToggle.IsChecked = settings.TgProxyEnabled;

                        if (settings.SelectedProfileIndex >= 0 && settings.SelectedProfileIndex < ProfileComboBox.Items.Count)
                        {
                            ProfileComboBox.SelectedIndex = settings.SelectedProfileIndex;
                        }
                    }
                }
            }
            catch {  }
        }

        private void SaveSettings()
        {
            try
            {
                var settings = new AppSettings
                {
                    ZapretEnabled = ZapretToggle.IsChecked ?? true,
                    TgProxyEnabled = TgProxyToggle.IsChecked ?? true,
                    SelectedProfileIndex = ProfileComboBox.SelectedIndex
                };

                string json = JsonSerializer.Serialize(settings, new JsonSerializerOptions { WriteIndented = true });
                File.WriteAllText(_settingsPath, json);
            }
            catch { Log("ОШИБКА: Не удалось сохранить конфигурацию."); TriggerErrorGlitch(); }
        }

        private void Settings_Changed(object sender, RoutedEventArgs e)
        {
            if (IsLoaded)
                SaveSettings();
        }

        private void TriggerErrorGlitch()
        {
            // 1. Тряска всего интерфейса по оси X (Screen Shake)
            var shakeAnim = new System.Windows.Media.Animation.DoubleAnimation(0, 10, TimeSpan.FromMilliseconds(40))
            {
                AutoReverse = true,
                RepeatBehavior = new System.Windows.Media.Animation.RepeatBehavior(4)
            };
            MainGridTranslate.BeginAnimation(TranslateTransform.XProperty, shakeAnim);

            // 2. Искажение (наклон всего экрана, делаем 3 градуса, иначе будет слишком сильно)
            var skewAnim = new System.Windows.Media.Animation.DoubleAnimation(0, -3, TimeSpan.FromMilliseconds(30))
            {
                AutoReverse = true,
                RepeatBehavior = new System.Windows.Media.Animation.RepeatBehavior(5)
            };
            MainGridSkew.BeginAnimation(SkewTransform.AngleXProperty, skewAnim);

            // 3. Мерцание прозрачности всей рабочей зоны (как сбой питания)
            var opacityAnim = new System.Windows.Media.Animation.DoubleAnimation(1, 0.6, TimeSpan.FromMilliseconds(50))
            {
                AutoReverse = true,
                RepeatBehavior = new System.Windows.Media.Animation.RepeatBehavior(4)
            };
            MainGrid.BeginAnimation(UIElement.OpacityProperty, opacityAnim);

            // 4. Расслоение цвета (выстреливаем огромную неоновую тень от всех элементов)
            MainGridGlitchShadow.Opacity = 1;
            var shadowAnim = new System.Windows.Media.Animation.DoubleAnimation(0, -15, TimeSpan.FromMilliseconds(40))
            {
                AutoReverse = true,
                RepeatBehavior = new System.Windows.Media.Animation.RepeatBehavior(4)
            };

            shadowAnim.Completed += (s, e) => MainGridGlitchShadow.Opacity = 0;
            MainGridGlitchShadow.BeginAnimation(DropShadowEffect.ShadowDepthProperty, shadowAnim);
        }

        private void Log(string message)
        {
            var run = new System.Windows.Documents.Run($"[{DateTime.Now:HH:mm:ss}] {message}");

            if (message.Contains("ОШИБКА") || message.Contains("⚠") || message.Contains("🛑"))
            {
                run.Foreground = new SolidColorBrush((System.Windows.Media.Color)System.Windows.Media.ColorConverter.ConvertFromString("#FF5555"));
                run.FontWeight = FontWeights.Bold;
            }
            else if (message.Contains("✅") || message.Contains("[OK]"))
            {
                run.Foreground = new SolidColorBrush((System.Windows.Media.Color)System.Windows.Media.ColorConverter.ConvertFromString("#55FF55"));
            }
            else if (message.Contains("[Zapret]") || message.Contains("[TgWsProxy]"))
            {
                run.Foreground = new SolidColorBrush((System.Windows.Media.Color)System.Windows.Media.ColorConverter.ConvertFromString("#55AAFF"));
            }
            else
            {
                run.Foreground = new SolidColorBrush((System.Windows.Media.Color)System.Windows.Media.ColorConverter.ConvertFromString("#888888"));
            }

            var paragraph = new System.Windows.Documents.Paragraph(run)
            {
                Margin = new Thickness(0, 0, 0, 2)
            };

            LogDocument.Blocks.Add(paragraph);
            LogRichTextBox.ScrollToEnd();
        }
    }
}