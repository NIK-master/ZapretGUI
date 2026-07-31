using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Effects;
using System.ComponentModel;
using System.Text.RegularExpressions;
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

        public override string ToString() => FileName;

        protected void OnPropertyChanged(string propertyName) =>
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
    }

    public partial class HomeView : System.Windows.Controls.UserControl
    {
        private readonly ZapretManager _zapretManager;
        private readonly TgProxyManager _tgProxyManager;
        private readonly NetworkMonitor _networkMonitor;
        private readonly ZapretScanner _zapretScanner;

        private System.Windows.Documents.Run? _lastProgressRun = null;

        public HomeView()
        {
            InitializeComponent();
            _zapretManager = new ZapretManager();
            _tgProxyManager = new TgProxyManager();
            _networkMonitor = new NetworkMonitor();
            _zapretScanner = new ZapretScanner();

            _zapretManager.LogMessage += ProcessLogMessage;
            _tgProxyManager.LogMessage += ProcessLogMessage;

            _networkMonitor.StatsUpdated += NetworkMonitor_StatsUpdated;
            _networkMonitor.StatusChanged += NetworkMonitor_StatusChanged;

            _zapretScanner.LogMessage += ProcessLogMessage;
            _zapretScanner.ScanCompleted += ZapretScanner_ScanCompleted;
            _zapretScanner.ScanFailed += ZapretScanner_ScanFailed;

            System.Windows.Application.Current.Exit += (s, e) => _zapretScanner.CancelScan();

            LoadProfiles();
            LoadSettings();

            SettingsManager.SettingsSaved += ApplyVisualSettings;
            ApplyVisualSettings();

            _networkMonitor.Start();
            _ = PingNetworkAsync();

            if (_zapretManager.IsRunning() || _tgProxyManager.IsRunning())
            {
                MainToggle.IsChecked = true;
                UpdateUIState(true);
                SyncMainWindowIndicators();
                Log("Интерфейс загружен. Найдены активные процессы в фоне.");
            }
            else
                Log("Интерфейс загружен. Ожидание команд...");
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
            Dispatcher.Invoke(() =>
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
                        RestartServices();
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

                var rotateAnim = new System.Windows.Media.Animation.DoubleAnimation(0, 360, TimeSpan.FromSeconds(1))
                {
                    RepeatBehavior = System.Windows.Media.Animation.RepeatBehavior.Forever
                };
                PingIconTransform.BeginAnimation(RotateTransform.AngleProperty, rotateAnim);

                var pingTask = Core.NetworkHelper.TcpPingAsync(AppConstants.AwsPingHost, AppConstants.AwsPingPort);
                var delayTask = Task.Delay(600);

                await Task.WhenAll(pingTask, delayTask);

                var pingMs = pingTask.Result;

                if (pingMs >= 0)
                {
                    PingText.Text = pingMs.ToString();
                    SyncNetworkIndicator(true);
                    UpdateAllConfigsPing(pingMs.ToString());
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
                {
                    var fileName = Path.GetFileName(file);
                    OverlayProfileListBox.Items.Add(new ConfigItem
                    {
                        FileName = fileName,
                        MetaInfo = "Пинг: — мс • Тесты: не проводились",
                        IsActive = false
                    });
                }

                if (TxtConfigsCount != null)
                    TxtConfigsCount.Text = $"{batFiles.Length} конфигов";

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
                if (OverlayProfileListBox.Items[SettingsManager.Current.SelectedProfileIndex] is ConfigItem currentItem)
                {
                    TxtMainProfile.Text = currentItem.FileName;
                    OverlayTxtProfile.Text = currentItem.FileName;
                }
            }

            RefreshListActiveStates(TxtMainProfile.Text);
        }

        private void RefreshListActiveStates(string activeFileName)
        {
            foreach (var item in OverlayProfileListBox.Items)
            {
                if (item is ConfigItem configItem)
                {
                    configItem.IsActive = (configItem.FileName == activeFileName);
                }
            }
            OverlayProfileListBox.Items.Refresh();
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
            var isProgress = message.Contains("Скачивание:") || message.Contains("Скачано:");

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
                run.Foreground = GetSuccessColor();
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

                var match = Regex.Match(message, @"([a-zA-Z0-9_\-\(\)\s]+\.bat).*?Успешно:\s*(\d+)(?:,\s*Ошибок:\s*(\d+))?");
                if (match.Success)
                {
                    string batName = match.Groups[1].Value.Trim();
                    string okCount = match.Groups[2].Value;
                    string errCount = match.Groups[3].Success ? match.Groups[3].Value : "0";

                    int total = int.Parse(okCount) + int.Parse(errCount);
                    UpdateConfigTests(batName, okCount, total.ToString());
                }
            });
        }

        public void ShowUpdateProgress(string message)
        {
            Dispatcher.Invoke(() => Log($"[Updater] {message}"));
        }

        private void BtnOpenConfigMenu_MouseDown(object sender, System.Windows.Input.MouseButtonEventArgs e)
        {
            AudioHelper.PlayClick();

            OverlayProfileListBox.Visibility = Visibility.Visible;

            ConfigOverlay.Visibility = Visibility.Visible;
            ConfigOverlay.Opacity = 0;

            var fadeIn = new System.Windows.Media.Animation.DoubleAnimation(0, 1, TimeSpan.FromSeconds(0.2));
            var scaleUp = new System.Windows.Media.Animation.DoubleAnimation(0.95, 1, TimeSpan.FromSeconds(0.2)) { EasingFunction = new System.Windows.Media.Animation.CubicEase { EasingMode = System.Windows.Media.Animation.EasingMode.EaseOut } };
            var slideUp = new System.Windows.Media.Animation.DoubleAnimation(10, 0, TimeSpan.FromSeconds(0.2)) { EasingFunction = new System.Windows.Media.Animation.CubicEase { EasingMode = System.Windows.Media.Animation.EasingMode.EaseOut } };

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
            var scaleDown = new System.Windows.Media.Animation.DoubleAnimation(1, 0.95, TimeSpan.FromSeconds(0.15)) { EasingFunction = new System.Windows.Media.Animation.CubicEase { EasingMode = System.Windows.Media.Animation.EasingMode.EaseIn } };
            var slideDown = new System.Windows.Media.Animation.DoubleAnimation(0, 10, TimeSpan.FromSeconds(0.15)) { EasingFunction = new System.Windows.Media.Animation.CubicEase { EasingMode = System.Windows.Media.Animation.EasingMode.EaseIn } };

            fadeOut.Completed += (s, ev) => { ConfigOverlay.Visibility = Visibility.Collapsed; };

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

        private void BtnCloseOverlay_Click(object sender, RoutedEventArgs e) => CloseOverlay();
        private void OverlayBackground_MouseDown(object sender, System.Windows.Input.MouseButtonEventArgs e) => CloseOverlay();
        private void OverlayContent_MouseDown(object sender, System.Windows.Input.MouseButtonEventArgs e) => e.Handled = true;

        private void BtnShowConfigList_Click(object sender, RoutedEventArgs e)
        {
            AudioHelper.PlayClick();
            OverlayProfileListBox.Visibility = OverlayProfileListBox.Visibility == Visibility.Visible ? Visibility.Collapsed : Visibility.Visible;
        }

        private void OverlayProfileListBox_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (OverlayProfileListBox.SelectedItem is ConfigItem selectedItem && IsLoaded)
            {
                TxtMainProfile.Text = selectedItem.FileName;
                OverlayTxtProfile.Text = selectedItem.FileName;

                RefreshListActiveStates(selectedItem.FileName);
                SaveSettings();
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
                UpdateUIState(IsRunning);
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

                    string? bestConfig = topConfigs[0];
                    Log($"⭐ Применяем лучшую: {bestConfig}");

                    for (int i = 0; i < OverlayProfileListBox.Items.Count; i++)
                    {
                        if (OverlayProfileListBox.Items[i] is ConfigItem item && item.FileName == bestConfig)
                        {
                            OverlayProfileListBox.SelectedIndex = i;
                            TxtMainProfile.Text = bestConfig;
                            OverlayTxtProfile.Text = bestConfig;
                            SaveSettings();
                            break;
                        }
                    }

                    if (_zapretManager.IsRunning() && ZapretToggle.IsChecked == true)
                    {
                        Log("🔄 Перезапуск служб с новой конфигурацией...");
                        _zapretManager.Start(bestConfig);
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

            if (_zapretScanner.IsScanning)
            {
                _zapretScanner.CancelScan();
                return;
            }

            MainToggle.IsEnabled = false;

            ScanIcon.Text = "\xE71A";
            ScanIcon.Foreground = UIHelper.GetBrushFromHex("#F44336");
            ScanText.Text = "Остановить тесты";

            Log("🚀 Инициализация умного сканирования конфигурации...");
            Log("Мы скрыли всплывающие окна консоли, чтобы они не мешали. Процесс займет пару минут...");

            await _zapretScanner.StartScanAsync();
        }

        private void UpdateAllConfigsPing(string currentPing)
        {
            foreach (var item in OverlayProfileListBox.Items)
            {
                if (item is ConfigItem config)
                {
                    var parts = config.MetaInfo.Split('•');
                    string testsPart = parts.Length > 1 ? parts[1].Trim() : "Тесты: не проводились";
                    config.MetaInfo = $"Пинг: {currentPing} мс • {testsPart}";
                }
            }
        }

        private void UpdateConfigTests(string fileName, string okCount, string totalCount)
        {
            string currentPing = PingText.Text == "..." || PingText.Text == "—" ? "—" : PingText.Text;

            foreach (var item in OverlayProfileListBox.Items)
            {
                if (item is ConfigItem config && config.FileName == fileName)
                {
                    config.MetaInfo = $"Пинг: {currentPing} мс • Тесты: {okCount}/{totalCount}";
                    break;
                }
            }
        }
    }
}