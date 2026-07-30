using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net.NetworkInformation;
using System.Runtime.InteropServices;
using System.Threading;
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
        [DllImport("user32.dll")]
        private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
        private const int SW_HIDE = 0;

        private readonly ZapretManager _zapretManager;
        private readonly TgProxyManager _tgProxyManager;

        private DispatcherTimer? _networkTimer;
        private long _lastBytesReceived = 0;
        private long _lastBytesSent = 0;
        private bool _wasNetworkAvailable = true;
        private System.Windows.Documents.Run? _lastProgressRun = null;

        private Process? _scanProcess;
        private CancellationTokenSource? _scanCts;
        private List<string> _topConfigs = new List<string>();

        private int _currentTestNumber = 0;
        private string _currentStrategy = "";
        private bool _isCurrentTestLogged = false;

        public HomeView()
        {
            InitializeComponent();
            _zapretManager = new ZapretManager();
            _tgProxyManager = new TgProxyManager();

            _zapretManager.LogMessage += ProcessLogMessage;
            _tgProxyManager.LogMessage += ProcessLogMessage;

            System.Windows.Application.Current.Exit += (s, e) => CancelScan();

            LoadProfiles();
            LoadSettings();

            SettingsManager.SettingsSaved += ApplyVisualSettings;
            ApplyVisualSettings();

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
                Log("Интерфейс загружен. Ожидание команд...");
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
            var isAvailable = NetworkInterface.GetIsNetworkAvailable();

            if (!isAvailable && _wasNetworkAvailable)
            {
                _wasNetworkAvailable = false;
                Log("⚠ Обнаружен обрыв сетевого подключения!");
                SyncNetworkIndicator(false);
            }
            else if (isAvailable && !_wasNetworkAvailable)
            {
                _wasNetworkAvailable = true;
                Log("🌐 Сетевое подключение восстановлено.");
                SyncNetworkIndicator(true);

                if (SettingsManager.Current.AutoRestartServices && MainToggle.IsChecked == true)
                {
                    Log("🔄 Автоматический перезапуск служб...");
                    RestartServices();
                }
            }

            var currentReceived = 0L;
            var currentSent = 0L;

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
                PingIconTransform.BeginAnimation(RotateTransform.AngleProperty, rotateAnim);

                var pingTask = Core.NetworkHelper.TcpPingAsync("ec2.eu-central-1.amazonaws.com", 443);
                var delayTask = Task.Delay(600);

                await Task.WhenAll(pingTask, delayTask);

                var pingMs = pingTask.Result;

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
            catch (Exception ex)
            {
                Debug.WriteLine($"Ошибка при пинге: {ex.Message}");
                PingText.Text = "—";
                SyncNetworkIndicator(false);
            }
            finally
            {
                PingIconTransform.BeginAnimation(RotateTransform.AngleProperty, null);
                PingIconTransform.Angle = 0;
                BtnRefreshPing.IsEnabled = true;
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
                        var selectedProfile = TxtMainProfile.Text;
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

                    if (System.Windows.Application.Current.MainWindow is MainWindow mainWindowStart)
                    {
                        mainWindowStart.ShowNotification(
                            "Службы запущены",
                            "Zapret и TgProxy успешно стартовали и работают в фоне.",
                            System.Windows.Forms.ToolTipIcon.Info);
                    }

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

                    if (System.Windows.Application.Current.MainWindow is MainWindow mainWindowStop)
                    {
                        mainWindowStop.ShowNotification(
                            "Службы остановлены",
                            "Маршрутизация отключена. Трафик идет напрямую.",
                            System.Windows.Forms.ToolTipIcon.Warning);
                    }

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
                StatusText.Foreground = GetSuccessColor();
                BtnOpenConfigMenu.IsEnabled = false;
                BtnOpenConfigMenu.Opacity = 0.5;
            }
            else
            {
                StatusText.Text = "Остановлен";
                StatusText.Foreground = GetErrorColor();
                BtnOpenConfigMenu.IsEnabled = true;
                BtnOpenConfigMenu.Opacity = 1.0;
            }
        }

        private void LoadProfiles()
        {
            OverlayProfileListBox.Items.Clear();
            var folderPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, AppConstants.CoreFilesDirectory);

            if (Directory.Exists(folderPath))
            {
                var batFiles = Directory.GetFiles(folderPath, "general*.bat");
                foreach (var file in batFiles)
                    OverlayProfileListBox.Items.Add(Path.GetFileName(file));

                if (OverlayProfileListBox.Items.Count > 0)
                    OverlayProfileListBox.SelectedIndex = 0;
            }
        }

        private void LoadSettings()
        {
            ZapretToggle.IsChecked = SettingsManager.Current.ZapretEnabled;
            TgProxyToggle.IsChecked = SettingsManager.Current.TgProxyEnabled;

            if (SettingsManager.Current.SelectedProfileIndex >= 0 && SettingsManager.Current.SelectedProfileIndex < OverlayProfileListBox.Items.Count)
            {
                OverlayProfileListBox.SelectedIndex = SettingsManager.Current.SelectedProfileIndex;
                string? current = OverlayProfileListBox.Items[SettingsManager.Current.SelectedProfileIndex]?.ToString();

                if (current != null)
                {
                    TxtMainProfile.Text = current;
                    OverlayTxtProfile.Text = current;
                }
            }
        }

        private void SaveSettings()
        {
            SettingsManager.Current.ZapretEnabled = ZapretToggle.IsChecked ?? true;
            SettingsManager.Current.TgProxyEnabled = TgProxyToggle.IsChecked ?? true;
            SettingsManager.Current.SelectedProfileIndex = OverlayProfileListBox.SelectedIndex;

            SettingsManager.Save();
        }

        private void Settings_Changed(object sender, RoutedEventArgs e)
        {
            if (IsLoaded)
                SaveSettings();
        }

        private void TriggerErrorGlitch()
        {
            if (SettingsManager.Current.FocusMode)
                return;

            var shakeAnim = new System.Windows.Media.Animation.DoubleAnimation(0, 10, TimeSpan.FromMilliseconds(40))
            {
                AutoReverse = true,
                RepeatBehavior = new System.Windows.Media.Animation.RepeatBehavior(4)
            };
            MainGridTranslate.BeginAnimation(TranslateTransform.XProperty, shakeAnim);

            var skewAnim = new System.Windows.Media.Animation.DoubleAnimation(0, -3, TimeSpan.FromMilliseconds(30))
            {
                AutoReverse = true,
                RepeatBehavior = new System.Windows.Media.Animation.RepeatBehavior(5)
            };
            MainGridSkew.BeginAnimation(SkewTransform.AngleXProperty, skewAnim);

            var opacityAnim = new System.Windows.Media.Animation.DoubleAnimation(1, 0.6, TimeSpan.FromMilliseconds(50))
            {
                AutoReverse = true,
                RepeatBehavior = new System.Windows.Media.Animation.RepeatBehavior(4)
            };
            MainGrid.BeginAnimation(UIElement.OpacityProperty, opacityAnim);

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
            bool isProgress = message.Contains("Скачивание:") || message.Contains("Скачано:");

            if (isProgress && _lastProgressRun != null)
            {
                _lastProgressRun.Text = $"[{DateTime.Now:HH:mm:ss}] {message}";
                return;
            }

            var run = new System.Windows.Documents.Run($"[{DateTime.Now:HH:mm:ss}] {message}");

            if (message.Contains("ОШИБКА") || message.Contains("⚠") || message.Contains("🛑") || message.Contains("❌"))
            {
                run.Foreground = GetErrorColor();
                run.FontWeight = FontWeights.Bold;
            }
            else if (message.Contains("✅") || message.Contains("✨") || message.Contains("🏆"))
            {
                run.Foreground = GetSuccessColor();
            }
            else if (message.Contains("🔍"))
                run.Foreground = UIHelper.GetBrushFromHex("#55AAFF");
            else
                run.Foreground = UIHelper.GetBrushFromHex("#888888");

            var paragraph = new System.Windows.Documents.Paragraph(run)
            {
                Margin = new Thickness(0, 0, 0, 2)
            };

            LogDocument.Blocks.Add(paragraph);
            LogRichTextBox.ScrollToEnd();

            _lastProgressRun = isProgress ? run : null;
        }

        private void BtnClearLogs_Click(object sender, RoutedEventArgs e)
        {
            LogDocument.Blocks.Clear();
            _lastProgressRun = null;
        }

        private void BtnExportLogs_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                var fileName = $"Zapret_Log_{DateTime.Now:yyyyMMdd_HHmmss}.txt";

                var saveFileDialog = new Microsoft.Win32.SaveFileDialog
                {
                    Filter = "Текстовые файлы (*.txt)|*.txt|Все файлы (*.*)|*.*",
                    DefaultExt = ".txt",
                    FileName = fileName
                };

                if (saveFileDialog.ShowDialog() == true)
                {
                    var textRange = new System.Windows.Documents.TextRange(LogDocument.ContentStart, LogDocument.ContentEnd);
                    File.WriteAllText(saveFileDialog.FileName, textRange.Text);

                    System.Windows.MessageBox.Show("Лог успешно сохранен!", "Экспорт", System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Information);
                }
            }
            catch (Exception ex)
            {
                System.Windows.MessageBox.Show($"Ошибка при экспорте лога: {ex.Message}", "Ошибка", System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Error);
            }
        }

        public bool IsRunning => _zapretManager.IsRunning() || _tgProxyManager.IsRunning();

        public void ToggleFromTray()
        {
            MainToggle.IsChecked = !IsRunning;
            MainToggle_Click(this, new RoutedEventArgs());
        }

        private void ApplyVisualSettings()
        {
            var isCompact = SettingsManager.Current.CompactMode;

            if (NetworkStatsPanel != null)
                NetworkStatsPanel.Visibility = isCompact ? Visibility.Collapsed : Visibility.Visible;

            if (LogsPanel != null)
            {
                var opacityAnim = new System.Windows.Media.Animation.DoubleAnimation { To = isCompact ? 0 : 1, Duration = TimeSpan.FromSeconds(0.3) };
                var heightAnim = new System.Windows.Media.Animation.DoubleAnimation { To = isCompact ? 0 : 250, Duration = TimeSpan.FromSeconds(0.4), EasingFunction = new System.Windows.Media.Animation.CubicEase { EasingMode = System.Windows.Media.Animation.EasingMode.EaseOut } };
                var marginAnim = new System.Windows.Media.Animation.ThicknessAnimation { To = isCompact ? new Thickness(0) : new Thickness(0, 20, 0, 0), Duration = TimeSpan.FromSeconds(0.4), EasingFunction = new System.Windows.Media.Animation.CubicEase { EasingMode = System.Windows.Media.Animation.EasingMode.EaseOut } };

                LogsPanel.BeginAnimation(UIElement.OpacityProperty, opacityAnim);
                LogsPanel.BeginAnimation(FrameworkElement.HeightProperty, heightAnim);
                LogsPanel.BeginAnimation(FrameworkElement.MarginProperty, marginAnim);

                LogsPanel.IsHitTestVisible = !isCompact;
            }

            var isZapret = _zapretManager != null && _zapretManager.IsRunning();
            var isProxy = _tgProxyManager != null && _tgProxyManager.IsRunning();

            UpdateUIState(isZapret || isProxy);

            this.Resources["MainBtnColor"] = GetSuccessColor().Color;

            if (System.Windows.Application.Current.MainWindow is MainWindow mainWindow)
            {
                mainWindow.UpdateIndicators(isZapret, isProxy);

                var isNetworkOnline = PingText.Text != "—" && PingText.Text != "..." && PingText.Text != "ошибка";
                mainWindow.UpdateNetworkIndicator(isNetworkOnline);

                mainWindow.AnimateWindowSize(isCompact);
            }
        }

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

        private async void RestartServices()
        {
            try
            {
                _zapretManager.Stop();
                _tgProxyManager.Stop();

                await Task.Delay(1000);

                if (SettingsManager.Current.ZapretEnabled)
                    _zapretManager.Start(TxtMainProfile.Text);

                if (SettingsManager.Current.TgProxyEnabled)
                    _tgProxyManager.Start();

                Log("✅ Службы успешно перезапущены.");
            }
            catch (Exception ex)
            {
                Log($"ОШИБКА ПРИ ПЕРЕЗАПУСКЕ: {ex.Message}");
            }
        }

        private void ProcessLogMessage(string message)
        {
            Dispatcher.Invoke(() =>
            {
                Log(message);
            });
        }

        public void ShowUpdateProgress(string message)
        {
            Dispatcher.Invoke(() =>
            {
                Log($"[Updater] {message}");
            });
        }

        private void BtnOpenConfigMenu_MouseDown(object sender, System.Windows.Input.MouseButtonEventArgs e)
        {
            AudioHelper.PlayClick();
            OverlayProfileListBox.Visibility = Visibility.Collapsed;

            ConfigOverlay.Visibility = Visibility.Visible;
            ConfigOverlay.Opacity = 0;

            var fadeIn = new System.Windows.Media.Animation.DoubleAnimation(0, 1, TimeSpan.FromSeconds(0.2));
            var scaleUp = new System.Windows.Media.Animation.DoubleAnimation(0.95, 1, TimeSpan.FromSeconds(0.2))
            {
                EasingFunction = new System.Windows.Media.Animation.CubicEase { EasingMode = System.Windows.Media.Animation.EasingMode.EaseOut }
            };
            var slideUp = new System.Windows.Media.Animation.DoubleAnimation(10, 0, TimeSpan.FromSeconds(0.2))
            {
                EasingFunction = new System.Windows.Media.Animation.CubicEase { EasingMode = System.Windows.Media.Animation.EasingMode.EaseOut }
            };

            ConfigOverlay.BeginAnimation(UIElement.OpacityProperty, fadeIn);

            if (OverlayContentBorder.RenderTransform as System.Windows.Media.TransformGroup is System.Windows.Media.TransformGroup transformGroup)
            {
                var scale = transformGroup.Children[0] as System.Windows.Media.ScaleTransform;
                var translate = transformGroup.Children[1] as System.Windows.Media.TranslateTransform;

                scale?.BeginAnimation(System.Windows.Media.ScaleTransform.ScaleXProperty, scaleUp);
                scale?.BeginAnimation(System.Windows.Media.ScaleTransform.ScaleYProperty, scaleUp);
                translate?.BeginAnimation(System.Windows.Media.TranslateTransform.YProperty, slideUp);
            }
        }

        private void CloseOverlay()
        {
            var fadeOut = new System.Windows.Media.Animation.DoubleAnimation(1, 0, TimeSpan.FromSeconds(0.15));
            var scaleDown = new System.Windows.Media.Animation.DoubleAnimation(1, 0.95, TimeSpan.FromSeconds(0.15))
            {
                EasingFunction = new System.Windows.Media.Animation.CubicEase { EasingMode = System.Windows.Media.Animation.EasingMode.EaseIn }
            };
            var slideDown = new System.Windows.Media.Animation.DoubleAnimation(0, 10, TimeSpan.FromSeconds(0.15))
            {
                EasingFunction = new System.Windows.Media.Animation.CubicEase { EasingMode = System.Windows.Media.Animation.EasingMode.EaseIn }
            };

            fadeOut.Completed += (s, ev) =>
            {
                ConfigOverlay.Visibility = Visibility.Collapsed;
            };

            ConfigOverlay.BeginAnimation(UIElement.OpacityProperty, fadeOut);

            if (OverlayContentBorder.RenderTransform as System.Windows.Media.TransformGroup is System.Windows.Media.TransformGroup transformGroup)
            {
                var scale = transformGroup.Children[0] as System.Windows.Media.ScaleTransform;
                var translate = transformGroup.Children[1] as System.Windows.Media.TranslateTransform;

                scale?.BeginAnimation(System.Windows.Media.ScaleTransform.ScaleXProperty, scaleDown);
                scale?.BeginAnimation(System.Windows.Media.ScaleTransform.ScaleYProperty, scaleDown);
                translate?.BeginAnimation(System.Windows.Media.TranslateTransform.YProperty, slideDown);
            }
        }

        private void BtnCloseOverlay_Click(object sender, RoutedEventArgs e)
        {
            CloseOverlay();
        }

        private void OverlayBackground_MouseDown(object sender, System.Windows.Input.MouseButtonEventArgs e)
        {
            CloseOverlay();
        }

        private void OverlayContent_MouseDown(object sender, System.Windows.Input.MouseButtonEventArgs e)
        {
            e.Handled = true;
        }

        private void BtnShowConfigList_Click(object sender, RoutedEventArgs e)
        {
            AudioHelper.PlayClick();
            OverlayProfileListBox.Visibility = OverlayProfileListBox.Visibility == Visibility.Visible ? Visibility.Collapsed : Visibility.Visible;
        }

        private void OverlayProfileListBox_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (OverlayProfileListBox.SelectedItem != null && IsLoaded)
            {
                string? selected = OverlayProfileListBox.SelectedItem?.ToString();

                if (selected != null)
                {
                    TxtMainProfile.Text = selected;
                    OverlayTxtProfile.Text = selected;
                    SaveSettings();
                }

                OverlayProfileListBox.Visibility = Visibility.Collapsed;
            }
        }

        private void CancelScan()
        {
            _scanCts?.Cancel();
            try
            {
                if (_scanProcess != null && !_scanProcess.HasExited)
                {
                    _scanProcess.Kill();
                }
            }
            catch { }

            ProcessHelper.KillProcessesByName("powershell");
            ProcessHelper.KillProcessesByName(AppConstants.ZapretProcessName);
        }

        private void ResetScanButton()
        {
            MainToggle.IsEnabled = true;
            ScanIcon.Text = "\xE721";
            ScanIcon.Foreground = UIHelper.GetBrushFromHex("#A0A0A0");
            ScanText.Text = "Начать сканирование";
        }

        private string? SimplifyLogLine(string line)
        {
            if (string.IsNullOrWhiteSpace(line))
                return null;

            var progressMatch = System.Text.RegularExpressions.Regex.Match(line, @"\[(\d+/\d+)\]\s+([a-zA-Z0-9_\-\(\)\s]+\.bat)", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            if (progressMatch.Success)
            {
                var progress = progressMatch.Groups[1].Value;
                var configName = progressMatch.Groups[2].Value.Trim();
                return $"[{progress}] 🔍 Анализ профиля: {configName}...";
            }

            if (line.Contains("=== ANALYTICS ==="))
                return "📊 Сводка результатов тестирования:";

            var statsMatch = System.Text.RegularExpressions.Regex.Match(line, @"([a-zA-Z0-9_\-\(\)\s]+\.bat)\s*:\s*(?:HTTP\s*)?OK:\s*(\d+).*?(?:ERR|FAIL):\s*(\d+)", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            if (statsMatch.Success)
            {
                var batName = statsMatch.Groups[1].Value.Trim();
                var okCount = statsMatch.Groups[2].Value;
                var errCount = statsMatch.Groups[3].Value;

                if (errCount == "0" && okCount != "0")
                {
                    if (!_topConfigs.Contains(batName))
                        _topConfigs.Add(batName);

                    return $"      ✨ {batName} -> Работает идеально (Успешно: {okCount})";
                }
                else
                {
                    return $"      ⚠️ {batName} -> Есть блокировки (Успешно: {okCount}, Ошибок: {errCount})";
                }
            }

            if (line.Contains("Best config:"))
            {
                var bestMatch = System.Text.RegularExpressions.Regex.Match(line, @"Best config:\s*([a-zA-Z0-9_\-\(\)\s]+\.bat)", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                if (bestMatch.Success)
                {
                    string best = bestMatch.Groups[1].Value.Trim();

                    if (_topConfigs.Contains(best))
                        _topConfigs.Remove(best);

                    _topConfigs.Insert(0, best);
                }
                return null;
            }

            return null;
        }

        private async void BtnStartScan_Click(object sender, RoutedEventArgs e)
        {
            AudioHelper.PlayClick();

            if (_scanProcess != null && !_scanProcess.HasExited)
            {
                CancelScan();
                return;
            }

            bool wasRunning = _zapretManager.IsRunning();

            CloseOverlay();
            MainToggle.IsEnabled = false;

            ScanIcon.Text = "\xE71A";
            ScanIcon.Foreground = UIHelper.GetBrushFromHex("#F44336");
            ScanText.Text = "Остановить тесты";

            _currentTestNumber = 0;
            _currentStrategy = "";
            _isCurrentTestLogged = false;

            Log("🚀 Инициализация умного сканирования конфигурации...");
            Log("Мы скрыли всплывающие окна консоли, чтобы они не мешали. Процесс займет пару минут...");

            _topConfigs.Clear();
            _scanCts = new CancellationTokenSource();

            var hideTimer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(100) };
            hideTimer.Tick += (s, ev) =>
            {
                foreach (var p in Process.GetProcessesByName(AppConstants.ZapretProcessName))
                {
                    if (p.MainWindowHandle != IntPtr.Zero)
                        ShowWindow(p.MainWindowHandle, SW_HIDE);
                }
            };
            hideTimer.Start();

            try
            {
                string scriptPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, AppConstants.CoreFilesDirectory, "utils", "test zapret.ps1");

                if (!File.Exists(scriptPath))
                {
                    Log("⚠ ОШИБКА: Скрипт тестирования не найден по пути: " + scriptPath);
                    ResetScanButton();
                    return;
                }

                var startInfo = new ProcessStartInfo
                {
                    FileName = "powershell.exe",
                    Arguments = $"-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File \"{scriptPath}\"",
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    RedirectStandardInput = true,
                    RedirectStandardError = true,
                    CreateNoWindow = true,
                    StandardOutputEncoding = System.Text.Encoding.UTF8
                };

                _scanProcess = new Process { StartInfo = startInfo };
                _scanProcess.Start();

                await _scanProcess.StandardInput.WriteLineAsync("1");
                await _scanProcess.StandardInput.WriteLineAsync("1");
                _scanProcess.StandardInput.Close();

                await Task.Run(async () =>
                {
                    while (!_scanProcess.StandardOutput.EndOfStream)
                    {
                        if (_scanCts.Token.IsCancellationRequested) break;

                        var line = await _scanProcess.StandardOutput.ReadLineAsync();
                        if (string.IsNullOrWhiteSpace(line)) continue;

                        line = System.Text.RegularExpressions.Regex.Replace(line, @"\x1B\[[0-9;]*[a-zA-Z]", "");

                        string? simpleLog = SimplifyLogLine(line);
                        if (simpleLog != null)
                        {
                            Dispatcher.Invoke(() => Log($"[Auto] {simpleLog}"));
                        }
                    }

                    if (!_scanProcess.HasExited)
                        _scanProcess.WaitForExit();

                }, _scanCts.Token);

                if (_scanCts.Token.IsCancellationRequested)
                {
                    Log("🛑 Сканирование было прервано пользователем.");
                }
                else
                {
                    if (_topConfigs.Count > 0)
                    {
                        Log("🏆 Сканирование завершено! Топ рабочих стратегий:");
                        for (int i = 0; i < Math.Min(3, _topConfigs.Count); i++)
                        {
                            Log($"  {i + 1}. {_topConfigs[i]}");
                        }

                        string? bestConfig = _topConfigs[0];
                        Log($"⭐ Применяем лучшую: {bestConfig}");

                        for (int i = 0; i < OverlayProfileListBox.Items.Count; i++)
                        {
                            if (OverlayProfileListBox.Items[i].ToString() == bestConfig)
                            {
                                OverlayProfileListBox.SelectedIndex = i;
                                TxtMainProfile.Text = bestConfig;
                                OverlayTxtProfile.Text = bestConfig;
                                SaveSettings();
                                break;
                            }
                        }

                        if (wasRunning && ZapretToggle.IsChecked == true)
                        {
                            Log("🔄 Перезапуск служб с новой конфигурацией...");
                            _zapretManager.Start(bestConfig);
                        }
                    }
                    else
                    {
                        Log("⚠ Сканирование завершено, но ни одна стратегия не сработала. Возможно провайдер блокирует слишком жестко.");
                    }
                }
            }
            catch (Exception ex)
            {
                if (_scanCts != null && !_scanCts.Token.IsCancellationRequested)
                    Log($"ОШИБКА СКАНИРОВАНИЯ: {ex.Message}");
            }
            finally
            {
                hideTimer.Stop();
                ResetScanButton();
                UpdateUIState(IsRunning);
            }
        }
    }
}