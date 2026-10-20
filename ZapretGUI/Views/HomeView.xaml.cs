using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Animation;
using ZapretGUI.Core;

namespace ZapretGUI.Views
{
    public class ConfigItem : INotifyPropertyChanged
    {
        public event PropertyChangedEventHandler? PropertyChanged;

        private string _fileName = "";
        public string FileName
        {
            get => _fileName;
            set { _fileName = value; OnPropertyChanged(nameof(FileName)); }
        }

        private string _metaInfo = "Пинг: — мс • Тесты: не проводились";
        public string MetaInfo
        {
            get => _metaInfo;
            set { _metaInfo = value; OnPropertyChanged(nameof(MetaInfo)); }
        }

        private bool _isActive;
        public bool IsActive
        {
            get => _isActive;
            set { _isActive = value; OnPropertyChanged(nameof(IsActive)); }
        }

        public int TopRank { get; set; } = int.MaxValue;
        public int PingMs { get; set; } = int.MaxValue;
        public int TestsOk { get; set; } = -1;
        public int TestsTotal { get; set; } = -1;

        public double SuccessRate => TestsTotal > 0 ? (double)TestsOk / TestsTotal : -1.0;

        public void RefreshMetaText()
        {
            string pingStr = PingMs < int.MaxValue && PingMs >= 0 ? $"{PingMs}" : "—";
            string testStr = TestsTotal > 0 ? $"{TestsOk}/{TestsTotal}" : "не проводились";
            MetaInfo = $"Пинг: {pingStr} мс • Тесты: {testStr}";
        }

        public override string ToString() => FileName;

        protected void OnPropertyChanged(string propertyName) =>
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
    }

    public class LogEntry
    {
        public string Text { get; set; } = "";
        public System.Windows.Media.Brush Color { get; set; } = System.Windows.Media.Brushes.White;
        public FontWeight Weight { get; set; } = FontWeights.Normal;
        public bool IsProgress { get; set; } = false;
    }

    public partial class HomeView : System.Windows.Controls.UserControl
    {
        private const int MaxLogBlocks = 250;

        private System.Windows.Documents.Run? _lastProgressRun = null;
        private bool _isUpdatingUI = false;

        private readonly Queue<LogEntry> _logQueue = new Queue<LogEntry>();
        private bool _isTyping = false;
        private System.Windows.Documents.Run? _cursorRun;

        public HomeView()
        {
            InitializeComponent();

            BypassController.Current.OnLog += ProcessLogMessage;
            BypassController.Current.NetMonitor.StatsUpdated += NetworkMonitor_StatsUpdated;
            BypassController.Current.NetMonitor.StatusChanged += NetworkMonitor_StatusChanged;

            BypassController.Current.Scanner.ScanCompleted += ZapretScanner_ScanCompleted;
            BypassController.Current.Scanner.ScanFailed += ZapretScanner_ScanFailed;

            System.Windows.Application.Current.Exit += (s, e) => BypassController.Current.Scanner.CancelScan();

            LoadProfiles();
            LoadSettings();

            SettingsManager.SettingsSaved += ApplyVisualSettings;
            SettingsManager.SettingsSaved += RefreshProfilesLive;
            ApplyVisualSettings();

            BypassController.Current.NetMonitor.Start();
            _ = PingNetworkAsync();

            if (BypassController.Current.IsRunning)
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

        public void RefreshProfilesLive()
        {
            Dispatcher.Invoke(() =>
            {
                _isUpdatingUI = true;
                LoadProfiles();
                _isUpdatingUI = false;
            });
        }

        private void NetworkMonitor_StatsUpdated(double mbpsReceived, double mbpsSent)
        {
            Dispatcher.Invoke(() =>
            {
                DownloadText.Text = mbpsReceived.ToString("0.0");
                UploadText.Text = mbpsSent.ToString("0.0");
            });
        }

        private void NetworkMonitor_StatusChanged(bool isAvailable)
        {
            Dispatcher.Invoke(async () =>
            {
                if (!isAvailable)
                {
                    Log("⚠ Обнаружен обрыв сетевого подключения!");
                    SyncNetworkIndicator(false);
                }
                else
                {
                    Log("🌐 Сетевое подключение восстановлено.");
                    SyncNetworkIndicator(true);

                    if (SettingsManager.Current.AutoRestartServices && MainToggle.IsChecked == true)
                    {
                        Log("🔄 Автоматический перезапуск служб...");
                        await BypassController.Current.RestartServicesAsync(TxtMainProfile.Text);
                    }
                }
            });
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

                var rotateAnim = new DoubleAnimation(0, 360, TimeSpan.FromSeconds(1))
                {
                    RepeatBehavior = RepeatBehavior.Forever
                };
                PingIconTransform.BeginAnimation(RotateTransform.AngleProperty, rotateAnim);

                var pingTask = BypassController.Current.CheckPingAsync();
                var delayTask = Task.Delay(600);

                await Task.WhenAll(pingTask, delayTask);

                var pingMs = pingTask.Result;

                if (pingMs >= 0)
                {
                    PingText.Text = pingMs.ToString();
                    SyncNetworkIndicator(true);
                    UpdateAllConfigsPing((int)pingMs);
                }
                else
                {
                    PingText.Text = "—";
                    SyncNetworkIndicator(false);
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Ошибка при пинге: {ex.Message}");
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
                mainWindow.UpdateIndicators(BypassController.Current.Zapret.IsRunning, BypassController.Current.TgProxy.IsRunning);
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

                    if (isZapretSelected && !SettingsManager.Current.FirstTimeScanPrompted)
                    {
                        SettingsManager.Current.FirstTimeScanPrompted = true;
                        SettingsManager.Save();

                        var runScan = UIHelper.ShowConfirm(
                            "Первый запуск Zapret",
                            "Перед первым включением рекомендуется протестировать стратегии обхода, чтобы выбрать самую быструю и стабильную для вашего провайдера.\n\nЗапустить автоматическое тестирование конфигураций сейчас?",
                            confirmText: "Запустить тест");

                        if (runScan)
                        {
                            MainToggle.IsChecked = false;
                            BtnOpenConfigMenu_MouseDown(this, null!);
                            BtnStartScan_Click(this, new RoutedEventArgs());
                            return;
                        }
                    }

                    MainToggle.IsEnabled = false;
                    LaunchProgressBar.Visibility = Visibility.Visible;
                    LaunchProgressBar.Value = 0;

                    Log("Инициализация запуска...");
                    AnimateProgressBar(30);

                    await BypassController.Current.StartServicesAsync(TxtMainProfile.Text, isZapretSelected, isTgProxySelected);

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
                    BypassController.Current.StopServices();

                    UpdateUIState(false);
                    SyncMainWindowIndicators();

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
                foreach (var errLine in ex.Message.Split('\n'))
                {
                    if (!string.IsNullOrWhiteSpace(errLine))
                        Log($"❌ ОШИБКА: {errLine.Trim()}");
                }

                TriggerErrorGlitch();

                if (System.Windows.Application.Current.MainWindow is MainWindow mainWindowErr)
                {
                    mainWindowErr.ShowNotification(
                        "Ошибка конфигурации Zapret",
                        ex.Message,
                        System.Windows.Forms.ToolTipIcon.Error);
                }

                BypassController.Current.StopServices();
                MainToggle.IsChecked = false;
                UpdateUIState(false);
                SyncMainWindowIndicators();
                LaunchProgressBar.Visibility = Visibility.Collapsed;
                MainToggle.IsEnabled = true;
            }
        }

        private void AnimateProgressBar(double targetValue)
        {
            var animation = new DoubleAnimation
            {
                To = targetValue,
                Duration = TimeSpan.FromMilliseconds(400),
                EasingFunction = new QuadraticEase { EasingMode = EasingMode.EaseOut }
            };

            LaunchProgressBar.BeginAnimation(System.Windows.Controls.ProgressBar.ValueProperty, animation);
        }

        private void UpdateUIState(bool isRunning)
        {
            if (isRunning)
            {
                StatusText.Text = "Работает";
                StatusText.Foreground = UIHelper.GetSuccessBrush();
                BtnOpenConfigMenu.IsEnabled = false;
                BtnOpenConfigMenu.Opacity = 0.5;
                BtnOpenGameFilterMenu.IsEnabled = false;
                BtnOpenGameFilterMenu.Opacity = 0.5;
            }
            else
            {
                StatusText.Text = "Остановлен";
                StatusText.Foreground = UIHelper.GetErrorBrush();
                BtnOpenConfigMenu.IsEnabled = true;
                BtnOpenConfigMenu.Opacity = 1.0;
                BtnOpenGameFilterMenu.IsEnabled = true;
                BtnOpenGameFilterMenu.Opacity = 1.0;
            }
        }

        private void LoadProfiles()
        {
            var folderPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, AppConstants.CoreFilesDirectory);
            if (!Directory.Exists(folderPath)) return;

            var batFiles = Directory.GetFiles(folderPath, "*.bat")
                .Where(f =>
                {
                    var name = Path.GetFileName(f);
                    return name.StartsWith("general", StringComparison.OrdinalIgnoreCase) ||
                           name.StartsWith("mod_", StringComparison.OrdinalIgnoreCase);
                })
                .Select(f => Path.GetFileName(f))
                .ToList();

            var existingItems = OverlayProfileListBox.Items.OfType<ConfigItem>().ToList();
            var newItems = new List<ConfigItem>();

            foreach (var fileName in batFiles)
            {
                var existing = existingItems.FirstOrDefault(i => i.FileName.Equals(fileName, StringComparison.OrdinalIgnoreCase));
                newItems.Add(existing ?? new ConfigItem
                {
                    FileName = fileName,
                    IsActive = false
                });
            }

            SortAndSetProfiles(newItems);
        }

        private void SortAndSetProfiles(List<ConfigItem> items)
        {
            var sortedList = items
                .OrderBy(item => item.TopRank)
                .ThenByDescending(item => item.SuccessRate)
                .ThenBy(item => item.PingMs)
                .ThenBy(item => item.FileName)
                .ToList();

            bool prevUpdating = _isUpdatingUI;
            _isUpdatingUI = true;

            string targetProfile = !string.IsNullOrWhiteSpace(TxtMainProfile?.Text)
                ? TxtMainProfile.Text
                : SettingsManager.Current.SelectedProfileName;

            OverlayProfileListBox.ItemsSource = null;
            OverlayProfileListBox.Items.Clear();

            int activeIdx = -1;
            for (int i = 0; i < sortedList.Count; i++)
            {
                var item = sortedList[i];
                bool isMatch = string.Equals(item.FileName, targetProfile, StringComparison.OrdinalIgnoreCase);
                item.IsActive = isMatch;
                if (isMatch) activeIdx = i;
                OverlayProfileListBox.Items.Add(item);
            }

            if (activeIdx >= 0)
            {
                OverlayProfileListBox.SelectedIndex = activeIdx;
            }
            else if (OverlayProfileListBox.Items.Count > 0)
            {
                OverlayProfileListBox.SelectedIndex = 0;
                if (OverlayProfileListBox.Items[0] is ConfigItem first)
                {
                    first.IsActive = true;
                    if (TxtMainProfile != null) TxtMainProfile.Text = first.FileName;
                    if (OverlayTxtProfile != null) OverlayTxtProfile.Text = first.FileName;
                }
            }

            if (TxtConfigsCount != null)
                TxtConfigsCount.Text = $"{sortedList.Count} конфигов";

            _isUpdatingUI = prevUpdating;
        }

        private void LoadSettings()
        {
            _isUpdatingUI = true;

            ZapretToggle.IsChecked = SettingsManager.Current.ZapretEnabled;
            TgProxyToggle.IsChecked = SettingsManager.Current.TgProxyEnabled;

            string savedProfile = SettingsManager.Current.SelectedProfileName;
            int foundIdx = -1;

            for (int i = 0; i < OverlayProfileListBox.Items.Count; i++)
            {
                if (OverlayProfileListBox.Items[i] is ConfigItem item &&
                    string.Equals(item.FileName, savedProfile, StringComparison.OrdinalIgnoreCase))
                {
                    foundIdx = i;
                    break;
                }
            }

            if (foundIdx == -1 &&
                SettingsManager.Current.SelectedProfileIndex >= 0 &&
                SettingsManager.Current.SelectedProfileIndex < OverlayProfileListBox.Items.Count)
            {
                foundIdx = SettingsManager.Current.SelectedProfileIndex;
            }

            if (foundIdx >= 0 && OverlayProfileListBox.Items[foundIdx] is ConfigItem currentItem)
            {
                OverlayProfileListBox.SelectedIndex = foundIdx;
                TxtMainProfile.Text = currentItem.FileName;
                OverlayTxtProfile.Text = currentItem.FileName;
            }

            RefreshListActiveStates(TxtMainProfile.Text);
            UpdateGameFilterBadge();
            _isUpdatingUI = false;
        }

        private void RefreshListActiveStates(string activeFileName)
        {
            foreach (var item in OverlayProfileListBox.Items)
            {
                if (item is ConfigItem configItem)
                    configItem.IsActive = string.Equals(configItem.FileName, activeFileName, StringComparison.OrdinalIgnoreCase);
            }
        }

        private void SaveSettings()
        {
            SettingsManager.Current.ZapretEnabled = ZapretToggle.IsChecked ?? true;
            SettingsManager.Current.TgProxyEnabled = TgProxyToggle.IsChecked ?? true;
            SettingsManager.Current.SelectedProfileIndex = Math.Max(0, OverlayProfileListBox.SelectedIndex);
            SettingsManager.Current.SelectedProfileName = TxtMainProfile.Text;

            SettingsManager.Save();
        }

        private void Settings_Changed(object sender, RoutedEventArgs e)
        {
            if (IsLoaded && !_isUpdatingUI)
                SaveSettings();
        }

        private void TriggerErrorGlitch()
        {
            if (SettingsManager.Current.FocusMode)
                return;

            AnimationHelper.PlayGlitchEffect(MainGrid, MainGridTranslate, MainGridSkew, MainGridGlitchShadow);
        }

        private void ProcessLogMessage(string message)
        {
            Dispatcher.Invoke(() =>
            {
                Log(message);

                var match = Regex.Match(message, @"([a-zA-Z0-9_\-\(\)\s]+\.bat).*?Успешно:\s*(\d+)(?:,\s*Ошибок:\s*(\d+))?");
                if (match.Success)
                {
                    var batName = match.Groups[1].Value.Trim();
                    int okCount = int.Parse(match.Groups[2].Value);
                    int errCount = match.Groups[3].Success ? int.Parse(match.Groups[3].Value) : 0;

                    UpdateConfigTests(batName, okCount, okCount + errCount);
                }
            });
        }

        private void Log(string message)
        {
            var isProgress = message.Contains("Скачивание:") || message.Contains("Скачано:");
            var text = $"[{DateTime.Now:HH:mm:ss}] {message}";

            System.Windows.Media.Brush color = UIHelper.GetBrushFromHex("#888888");
            FontWeight weight = FontWeights.Normal;

            if (message.Contains("ОШИБКА") || message.Contains("⚠") || message.Contains("🛑") || message.Contains("❌"))
            {
                color = UIHelper.GetErrorBrush();
                weight = FontWeights.Bold;
            }
            else if (message.Contains("✅") || message.Contains("✨") || message.Contains("🏆"))
                color = UIHelper.GetSuccessBrush();
            else if (message.Contains("🔍"))
                color = UIHelper.GetBrushFromHex("#55AAFF");

            _logQueue.Enqueue(new LogEntry { Text = text, Color = color, Weight = weight, IsProgress = isProgress });

            if (!_isTyping)
                _ = ProcessLogQueueAsync();
        }

        private async Task ProcessLogQueueAsync()
        {
            _isTyping = true;

            if (_cursorRun == null)
            {
                var cursorColor = (System.Windows.Media.Color)System.Windows.Media.ColorConverter.ConvertFromString("#A0A0A0");
                var cursorBrush = new SolidColorBrush(cursorColor);
                _cursorRun = new System.Windows.Documents.Run(" █") { Foreground = cursorBrush };

                var blink = new DoubleAnimation(1, 0, TimeSpan.FromMilliseconds(400))
                {
                    AutoReverse = true,
                    RepeatBehavior = RepeatBehavior.Forever
                };
                cursorBrush.BeginAnimation(SolidColorBrush.OpacityProperty, blink);
            }

            while (_logQueue.Count > 0)
            {
                var entry = _logQueue.Dequeue();

                if (entry.IsProgress && _lastProgressRun != null)
                {
                    _lastProgressRun.Text = entry.Text;
                    continue;
                }

                while (LogDocument.Blocks.Count >= MaxLogBlocks && LogDocument.Blocks.FirstBlock != null)
                    LogDocument.Blocks.Remove(LogDocument.Blocks.FirstBlock);

                var run = new System.Windows.Documents.Run("") { Foreground = entry.Color, FontWeight = entry.Weight };
                var paragraph = new System.Windows.Documents.Paragraph(run) { Margin = new Thickness(0, 0, 0, 2) };

                if (_cursorRun.Parent is System.Windows.Documents.Paragraph parent)
                    parent.Inlines.Remove(_cursorRun);

                paragraph.Inlines.Add(_cursorRun);
                LogDocument.Blocks.Add(paragraph);
                LogRichTextBox.ScrollToEnd();

                _lastProgressRun = entry.IsProgress ? run : null;

                if (SettingsManager.Current.FocusMode)
                    run.Text = entry.Text;
                else
                {
                    var chunkSize = entry.Text.Length > 40 ? 3 : 2;
                    for (var i = 0; i < entry.Text.Length; i += chunkSize)
                    {
                        var length = Math.Min(chunkSize, entry.Text.Length - i);
                        run.Text += entry.Text.Substring(i, length);
                        LogRichTextBox.ScrollToEnd();
                        await Task.Delay(15);
                    }
                }
            }

            _isTyping = false;
        }

        private void BtnClearLogs_Click(object sender, RoutedEventArgs e)
        {
            LogDocument.Blocks.Clear();
            _lastProgressRun = null;
            _logQueue.Clear();

            if (_cursorRun != null)
            {
                var paragraph = new System.Windows.Documents.Paragraph(_cursorRun) { Margin = new Thickness(0, 0, 0, 2) };
                LogDocument.Blocks.Add(paragraph);
            }
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

                    UIHelper.ShowAlert("Экспорт завершен", "Лог событий успешно сохранен в файл!");
                }
            }
            catch (Exception ex)
            {
                UIHelper.ShowAlert("Ошибка экспорта", $"Ошибка при экспорте лога: {ex.Message}", isError: true);
            }
        }

        public bool IsRunning => BypassController.Current.IsRunning;

        public void ToggleFromTray()
        {
            MainToggle.IsChecked = !IsRunning;
            MainToggle_Click(this, new RoutedEventArgs());
        }

        private void ApplyVisualSettings()
        {
            var isCompact = SettingsManager.Current.CompactMode;

            MainGrid.Margin = isCompact ? new Thickness(16, 10, 16, 10) : new Thickness(20, 14, 20, 16);
            HeaderStack.Margin = isCompact ? new Thickness(0, 0, 0, 10) : new Thickness(0, 4, 0, 16);
            TxtHeaderTitle.FontSize = isCompact ? 22 : 26;
            TxtHeaderSub.FontSize = isCompact ? 12 : 14;

            MainToggle.Width = isCompact ? 170 : 190;
            MainToggle.Height = isCompact ? 170 : 190;

            ZapretCardPanel.Margin = isCompact ? new Thickness(14, 12, 14, 12) : new Thickness(16, 14, 16, 14);
            ProxyCardPanel.Margin = isCompact ? new Thickness(14, 10, 14, 10) : new Thickness(16, 12, 16, 12);
            OverlayProfileListBox.MaxHeight = isCompact ? 180 : 290;

            if (NetworkStatsPanel != null)
                NetworkStatsPanel.Visibility = isCompact ? Visibility.Collapsed : Visibility.Visible;

            if (LogsPanel != null)
            {
                var opacityAnim = new DoubleAnimation { To = isCompact ? 0 : 1, Duration = TimeSpan.FromSeconds(0.3) };
                var heightAnim = new DoubleAnimation { To = isCompact ? 0 : 235, Duration = TimeSpan.FromSeconds(0.4), EasingFunction = new CubicEase { EasingMode = EasingMode.EaseOut } };
                var marginAnim = new ThicknessAnimation { To = isCompact ? new Thickness(0) : new Thickness(0, 14, 0, 0), Duration = TimeSpan.FromSeconds(0.4), EasingFunction = new CubicEase { EasingMode = EasingMode.EaseOut } };

                LogsPanel.BeginAnimation(UIElement.OpacityProperty, opacityAnim);
                LogsPanel.BeginAnimation(FrameworkElement.HeightProperty, heightAnim);
                LogsPanel.BeginAnimation(FrameworkElement.MarginProperty, marginAnim);

                LogsPanel.IsHitTestVisible = !isCompact;
            }

            var isZapret = BypassController.Current.Zapret.IsRunning;
            var isProxy = BypassController.Current.TgProxy.IsRunning;

            UpdateUIState(isZapret || isProxy);

            this.Resources["MainBtnColor"] = UIHelper.GetSuccessBrush().Color;

            if (System.Windows.Application.Current.MainWindow is MainWindow mainWindow)
            {
                mainWindow.UpdateIndicators(isZapret, isProxy);

                var isNetworkOnline = PingText.Text != "—" && PingText.Text != "..." && PingText.Text != "ошибка";
                mainWindow.UpdateNetworkIndicator(isNetworkOnline);

                mainWindow.AnimateWindowSize(isCompact);
            }
        }

        public void ShowUpdateProgress(string message)
        {
            Dispatcher.Invoke(() => Log($"[Updater] {message}"));
        }

        private void BtnOpenConfigMenu_MouseDown(object sender, System.Windows.Input.MouseButtonEventArgs e)
        {
            AudioHelper.PlayClick();
            OverlayProfileListBox.Visibility = Visibility.Visible;
            AnimationHelper.ShowOverlay(ConfigOverlay, OverlayContentBorder, ContentGrid);
        }

        private void CloseOverlay()
        {
            AnimationHelper.HideOverlay(ConfigOverlay, OverlayContentBorder, ContentGrid);
        }

        private void BtnCloseOverlay_Click(object sender, RoutedEventArgs e)
            => CloseOverlay();
        private void OverlayBackground_MouseDown(object sender, System.Windows.Input.MouseButtonEventArgs e)
            => CloseOverlay();
        private void OverlayContent_MouseDown(object sender, System.Windows.Input.MouseButtonEventArgs e)
            => e.Handled = true;

        private void OverlayProfileListBox_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (_isUpdatingUI) return;

            if (OverlayProfileListBox.SelectedItem is ConfigItem selectedItem && IsLoaded)
            {
                TxtMainProfile.Text = selectedItem.FileName;
                OverlayTxtProfile.Text = selectedItem.FileName;

                RefreshListActiveStates(selectedItem.FileName);

                _isUpdatingUI = true;
                SaveSettings();
                _isUpdatingUI = false;
            }
        }

        private void ResetScanButton()
        {
            Dispatcher.Invoke(() =>
            {
                MainToggle.IsEnabled = true;
                ScanIcon.Text = "\xE721";
                ScanIcon.Foreground = UIHelper.GetBrushFromHex("#A0A0A0");
                ScanText.Text = "Запустить авто-подбор (Smart DPI Scan)";
                UpdateUIState(BypassController.Current.IsRunning);
            });
        }

        private void ZapretScanner_ScanCompleted(List<string> topConfigs)
        {
            Dispatcher.Invoke(() =>
            {
                if (topConfigs.Count > 0)
                {
                    Log("🏆 Сканирование завершено! Топ рабочих стратегий:");
                    for (int i = 0; i < Math.Min(3, topConfigs.Count); i++)
                    {
                        Log($"  {i + 1}. {topConfigs[i]}");
                    }

                    string bestConfig = topConfigs[0];
                    Log($"⭐ Применяем лучшую: {bestConfig}");

                    var currentList = OverlayProfileListBox.Items.OfType<ConfigItem>().ToList();
                    foreach (var item in currentList)
                        item.TopRank = int.MaxValue;

                    for (int i = 0; i < topConfigs.Count; i++)
                    {
                        var cfg = currentList.FirstOrDefault(c => c.FileName.Equals(topConfigs[i], StringComparison.OrdinalIgnoreCase));
                        if (cfg != null)
                            cfg.TopRank = i;
                    }

                    TxtMainProfile.Text = bestConfig;
                    OverlayTxtProfile.Text = bestConfig;

                    SortAndSetProfiles(currentList);

                    _isUpdatingUI = true;
                    SaveSettings();
                    _isUpdatingUI = false;

                    if (BypassController.Current.Zapret.IsRunning && ZapretToggle.IsChecked == true)
                    {
                        Log("🔄 Перезапуск служб с новой конфигурацией...");
                        BypassController.Current.Zapret.Start(bestConfig);
                    }
                }
                else
                {
                    Log("⚠ Сканирование завершено, но ни одна стратегия не сработала.");
                }

                ResetScanButton();
            });
        }

        private void ZapretScanner_ScanFailed(Exception ex)
        {
            Dispatcher.Invoke(() =>
            {
                Log($"ОШИБКА СКАНИРОВАНИЯ: {ex.Message}");
                ResetScanButton();
            });
        }

        private async void BtnStartScan_Click(object sender, RoutedEventArgs e)
        {
            AudioHelper.PlayClick();

            if (BypassController.Current.Scanner.IsScanning)
            {
                BypassController.Current.Scanner.CancelScan();
                return;
            }

            SettingsManager.Current.FirstTimeScanPrompted = true;
            SettingsManager.Save();

            MainToggle.IsEnabled = false;

            ScanIcon.Text = "\xE71A";
            ScanIcon.Foreground = UIHelper.GetBrushFromHex("#F44336");
            ScanText.Text = "Остановить тесты";

            Log("🚀 Инициализация умного сканирования конфигурации...");
            Log("Мы скрыли всплывающие окна консоли, чтобы они не мешали. Процесс займет пару минут...");

            await BypassController.Current.Scanner.StartScanAsync();
        }

        private void UpdateAllConfigsPing(int pingMs)
        {
            var currentList = OverlayProfileListBox.Items.OfType<ConfigItem>().ToList();
            foreach (var config in currentList)
            {
                config.PingMs = pingMs > 0 ? pingMs : int.MaxValue;
                config.RefreshMetaText();
            }

            SortAndSetProfiles(currentList);
        }

        private void UpdateConfigTests(string fileName, int okCount, int totalCount)
        {
            int.TryParse(PingText.Text, out int pingVal);
            if (pingVal <= 0) pingVal = int.MaxValue;

            var currentList = OverlayProfileListBox.Items.OfType<ConfigItem>().ToList();

            foreach (var item in currentList)
            {
                if (item.FileName.Equals(fileName, StringComparison.OrdinalIgnoreCase))
                {
                    item.TestsOk = okCount;
                    item.TestsTotal = totalCount;
                    item.PingMs = pingVal;
                    item.RefreshMetaText();
                    break;
                }
            }

            SortAndSetProfiles(currentList);
        }


        private void UpdateGameFilterBadge()
        {
            if (TxtGameFilterStatus == null) return;
            TxtGameFilterStatus.Text = ServiceToolsManager.GetGameFilterDisplayStatus();

            bool isEnabled = !string.Equals(SettingsManager.Current.GameFilterMode, "disabled", StringComparison.OrdinalIgnoreCase);
            TxtGameFilterStatus.Foreground = isEnabled ? UIHelper.GetSuccessBrush() : UIHelper.GetBrushFromHex("#A0A0A0");
        }

        private void BtnOpenGameFilterMenu_MouseDown(object sender, System.Windows.Input.MouseButtonEventArgs e)
        {
            AudioHelper.PlayClick();

            string mode = (SettingsManager.Current.GameFilterMode ?? "disabled").ToLowerInvariant();
            ListGameFilterMode.SelectedIndex = mode switch
            {
                "all" => 1,
                "tcp" => 2,
                "udp" => 3,
                _ => 0
            };

            TxtGameFilterTcp.Text = string.IsNullOrWhiteSpace(SettingsManager.Current.GameFilterTcpRange) ? "1024-65535" : SettingsManager.Current.GameFilterTcpRange;
            TxtGameFilterUdp.Text = string.IsNullOrWhiteSpace(SettingsManager.Current.GameFilterUdpRange) ? "1024-65535" : SettingsManager.Current.GameFilterUdpRange;

            AnimationHelper.ShowOverlay(GameFilterOverlay, GameFilterContentBorder, ContentGrid);
        }

        private void CloseGameFilterOverlay()
        {
            AnimationHelper.HideOverlay(GameFilterOverlay, GameFilterContentBorder, ContentGrid);
        }

        private void BtnCloseGameFilter_Click(object sender, RoutedEventArgs e) => CloseGameFilterOverlay();
        private void GameFilterOverlay_MouseDown(object sender, System.Windows.Input.MouseButtonEventArgs e) => CloseGameFilterOverlay();

        private void ComboGameFilterMode_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (!IsLoaded) return;
            AudioHelper.PlayClick();
        }

        private void BtnResetGameFilterPorts_Click(object sender, RoutedEventArgs e)
        {
            AudioHelper.PlayClick();
            TxtGameFilterTcp.Text = "1024-65535";
            TxtGameFilterUdp.Text = "1024-65535";
        }

        private async void BtnSaveGameFilter_Click(object sender, RoutedEventArgs e)
        {
            AudioHelper.PlayClick();

            if (!ServiceToolsManager.ValidatePortRange(TxtGameFilterTcp.Text, out string validTcp))
            {
                UIHelper.ShowAlert("Ошибка портов TCP", "Указан некорректный диапазон портов TCP!\nПример правильного формата: 1024-65535 или 1024-1934,1936-65535", isError: true);
                return;
            }

            if (!ServiceToolsManager.ValidatePortRange(TxtGameFilterUdp.Text, out string validUdp))
            {
                UIHelper.ShowAlert("Ошибка портов UDP", "Указан некорректный диапазон портов UDP!\nПример правильного формата: 1024-65535", isError: true);
                return;
            }

            SettingsManager.Current.GameFilterMode = ListGameFilterMode.SelectedIndex switch
            {
                1 => "all",
                2 => "tcp",
                3 => "udp",
                _ => "disabled"
            };
            SettingsManager.Current.GameFilterTcpRange = validTcp;
            SettingsManager.Current.GameFilterUdpRange = validUdp;

            ServiceToolsManager.SyncGameFilterFile();
            SettingsManager.Save();
            UpdateGameFilterBadge();

            CloseGameFilterOverlay();
            Log($"🎮 Игровой фильтр обновлен: {ServiceToolsManager.GetGameFilterDisplayStatus()}");

            if (BypassController.Current.Zapret.IsRunning)
            {
                bool restart = UIHelper.ShowConfirm(
                    "Перезапустить Zapret?",
                    "Настройки Игрового фильтра сохранены. Чтобы новые диапазоны портов вступили в силу в работающем обходе, требуется перезапуск. Перезапустить сейчас?",
                    confirmText: "Перезапустить");

                if (restart)
                {
                    await BypassController.Current.RestartServicesAsync(TxtMainProfile.Text);
                    SyncMainWindowIndicators();
                }
            }
        }
    }
}