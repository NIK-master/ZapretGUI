using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Interop;
using ZapretGUI.Core;

namespace ZapretGUI.Views
{
    public class SettingOptionItem
    {
        public string Title { get; set; } = "";
        public string Description { get; set; } = "";
        public bool IsSelected { get; set; }
    }

    public partial class SettingsView : System.Windows.Controls.UserControl
    {
        private bool _isLoadingSettings = false;
        private int _selectedIntervalIndex = 0;
        private int _selectedIpSetModeIndex = 0;
        private int _selectedHostsSourceIndex = 2;

        private Action<int>? _onOptionSelectedCallback;

        private static readonly (string title, string desc)[] IntervalOptions =
        [
            ("1 секунда", "Максимальная плавность графиков и мгновенный отклик монитора скорости"),
            ("3 секунды", "Сбалансированный режим опроса сетевого интерфейса"),
            ("5 секунд", "Экономичный режим с минимальной нагрузкой на систему")
        ];

        private static readonly (string title, string desc)[] IpSetModeOptions =
        [
            ("По списку (Loaded)", "Использовать полную базу заблокированных подсетей из файла ipset-all.txt"),
            ("Отключен (None)", "Подставить адрес-заглушку 203.0.113.113/32 и отключить фильтрацию по IP"),
            ("Весь трафик (Any)", "Очистить ipset-all.txt, чтобы правила применялись ко всем IP-адресам")
        ];

        private static readonly (string title, string desc)[] HostsSourceOptions =
        [
            ("Flowseal (Базовый)", "Официальный список доменов из репозитория zapret-discord-youtube (Telegram, Discord и др.)"),
            ("V3nilla (ChatGPT, AI, Сервисы)", "Разблокировка ChatGPT, OpenAI, Claude, Gemini, Spotify, Instagram, Notion и GitHub без рекламы"),
            ("Flowseal + V3nilla (Рекомендуется)", "Объединяет оба списка без дубликатов для максимальной доступности всех сервисов"),
            ("V3nilla Full (+ AdBlock 0.0.0.0)", "Полный файл V3nilla, включая тысячи правил блокировки рекламы и телеметрии (0.0.0.0)")
        ];

        public SettingsView()
        {
            InitializeComponent();
            LoadSettings();
        }

        private void LoadSettings()
        {
            try
            {
                _isLoadingSettings = true;

                ToggleAutoStart.IsChecked = StartupHelper.IsAutoStartEnabled();

                var settings = SettingsManager.Current;

                ToggleStartMinimized.IsChecked = settings.StartMinimized;
                ToggleMinimizeOnClose.IsChecked = settings.MinimizeOnClose;
                ToggleNotifications.IsChecked = settings.NotificationsEnabled;

                ToggleFocusMode.IsChecked = settings.FocusMode;
                ToggleCompactMode.IsChecked = settings.CompactMode;
                ToggleHardwareAccel.IsChecked = settings.HardwareAcceleration;
                ToggleColorblind.IsChecked = settings.ColorblindMode;

                TxtPingUrl.Text = settings.PingUrl ?? AppConstants.DefaultPingUrl;
                ToggleAutoRestart.IsChecked = settings.AutoRestartServices;

                _selectedIntervalIndex = settings.StatsUpdateInterval switch
                {
                    3 => 1,
                    5 => 2,
                    _ => 0
                };
                TxtSelectedInterval.Text = IntervalOptions[_selectedIntervalIndex].title;

                _selectedHostsSourceIndex = Math.Clamp(settings.HostsSourceIndex, 0, 3);
                TxtSelectedHostsSource.Text = HostsSourceOptions[_selectedHostsSourceIndex].title;

                RefreshIpSetAndHostsUI();
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Ошибка при загрузке настроек в UI: {ex.Message}");
            }
            finally
            {
                _isLoadingSettings = false;
            }
        }

        private void RefreshIpSetAndHostsUI()
        {
            _isLoadingSettings = true;
            try
            {
                var (ipMode, _, ipStatusText) = ServiceToolsManager.GetIpSetStatus();
                TxtIpSetStatusBadge.Text = ipStatusText;

                _selectedIpSetModeIndex = ipMode switch
                {
                    "loaded" => 0,
                    "none" => 1,
                    "any" => 2,
                    _ => 0
                };
                TxtSelectedIpSetMode.Text = IpSetModeOptions[_selectedIpSetModeIndex].title;

                var (hostsApplied, hostsCount) = ServiceToolsManager.GetHostsStatus();
                TxtHostsStatusBadge.Text = hostsApplied ? $"Активен ({hostsCount} домен.)" : "Не применен";
                TxtHostsStatusBadge.Foreground = hostsApplied ? UIHelper.GetBrushFromHex("#4ADE80") : UIHelper.GetBrushFromHex("#A0A0A0");
            }
            finally
            {
                _isLoadingSettings = false;
            }
        }

        // --- ФИРМЕННОЕ МОДАЛЬНОЕ МЕНЮ ВЫБОРА ОПЦИЙ ---

        private void OpenSelectionMenu(string title, string subTitle, (string title, string desc)[] options, int currentIndex, Action<int> onSelected)
        {
            AudioHelper.PlayClick();

            TxtSelectionTitle.Text = title;
            TxtSelectionSubTitle.Text = subTitle;
            _onOptionSelectedCallback = null;

            var items = new List<SettingOptionItem>();
            for (int i = 0; i < options.Length; i++)
            {
                items.Add(new SettingOptionItem
                {
                    Title = options[i].title,
                    Description = options[i].desc,
                    IsSelected = (i == currentIndex)
                });
            }

            SelectionListBox.ItemsSource = items;
            _onOptionSelectedCallback = onSelected;

            AnimationHelper.ShowOverlay(SelectionOverlay, SelectionContentBorder, ContentGrid);
        }

        private void CloseSelectionOverlay()
        {
            _onOptionSelectedCallback = null;
            AnimationHelper.HideOverlay(SelectionOverlay, SelectionContentBorder, ContentGrid);
        }

        private void BtnCloseSelectionOverlay_Click(object sender, RoutedEventArgs e) => CloseSelectionOverlay();
        private void SelectionOverlay_MouseDown(object sender, MouseButtonEventArgs e) => CloseSelectionOverlay();
        private void SelectionContent_MouseDown(object sender, MouseButtonEventArgs e) => e.Handled = true;

        private void SelectionListBox_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (_onOptionSelectedCallback == null || SelectionListBox.SelectedIndex < 0) return;

            int chosenIdx = SelectionListBox.SelectedIndex;
            var callback = _onOptionSelectedCallback;

            AudioHelper.PlayClick();
            CloseSelectionOverlay();
            callback.Invoke(chosenIdx);
        }

        private void BtnSelectInterval_MouseDown(object sender, MouseButtonEventArgs e)
        {
            OpenSelectionMenu(
                "Интервал обновления статистики",
                "Сеть и диагностика",
                IntervalOptions,
                _selectedIntervalIndex,
                idx =>
                {
                    _selectedIntervalIndex = idx;
                    TxtSelectedInterval.Text = IntervalOptions[idx].title;
                    SaveAllSettings();
                });
        }

        private void BtnSelectIpSetMode_MouseDown(object sender, MouseButtonEventArgs e)
        {
            OpenSelectionMenu(
                "Режим фильтрации IPSet",
                "База подсетей ipset-all.txt",
                IpSetModeOptions,
                _selectedIpSetModeIndex,
                idx =>
                {
                    string targetMode = idx switch
                    {
                        1 => "none",
                        2 => "any",
                        _ => "loaded"
                    };

                    try
                    {
                        ServiceToolsManager.SetIpSetMode(targetMode);
                        RefreshIpSetAndHostsUI();
                    }
                    catch (Exception ex)
                    {
                        UIHelper.ShowAlert("Режим IPSet", ex.Message, isError: true);
                        RefreshIpSetAndHostsUI();
                    }
                });
        }

        private void BtnSelectHostsSource_MouseDown(object sender, MouseButtonEventArgs e)
        {
            OpenSelectionMenu(
                "Источник списка Hosts",
                "Системный файл C:\\Windows\\System32\\drivers\\etc\\hosts",
                HostsSourceOptions,
                _selectedHostsSourceIndex,
                idx =>
                {
                    _selectedHostsSourceIndex = idx;
                    TxtSelectedHostsSource.Text = HostsSourceOptions[idx].title;
                    SaveAllSettings();
                });
        }

        // --- СОХРАНЕНИЕ НАСТРОЕК И ДЕЙСТВИЯ ---

        private void Setting_Changed(object sender, RoutedEventArgs e)
        {
            if (_isLoadingSettings) return;
            AudioHelper.PlayClick();
            SaveAllSettings();
        }

        private void TextInput_LostFocus(object sender, RoutedEventArgs e)
        {
            if (_isLoadingSettings) return;
            SaveAllSettings();
        }

        private void SaveAllSettings()
        {
            if (!IsLoaded || _isLoadingSettings) return;

            try
            {
                StartupHelper.SetAutoStart(ToggleAutoStart.IsChecked ?? true);

                var useGpu = ToggleHardwareAccel.IsChecked ?? true;
                System.Windows.Media.RenderOptions.ProcessRenderMode = useGpu ? RenderMode.Default : RenderMode.SoftwareOnly;

                var settings = SettingsManager.Current;
                settings.StartMinimized = ToggleStartMinimized.IsChecked ?? false;
                settings.MinimizeOnClose = ToggleMinimizeOnClose.IsChecked ?? true;
                settings.NotificationsEnabled = ToggleNotifications.IsChecked ?? true;

                settings.FocusMode = ToggleFocusMode.IsChecked ?? false;
                settings.CompactMode = ToggleCompactMode.IsChecked ?? false;
                settings.HardwareAcceleration = useGpu;
                settings.ColorblindMode = ToggleColorblind.IsChecked ?? false;

                UIHelper.ApplyThemeColors();

                settings.PingUrl = string.IsNullOrWhiteSpace(TxtPingUrl.Text) ? AppConstants.DefaultPingUrl : TxtPingUrl.Text;
                settings.AutoRestartServices = ToggleAutoRestart.IsChecked ?? false;

                settings.StatsUpdateInterval = _selectedIntervalIndex switch { 1 => 3, 2 => 5, _ => 1 };
                settings.HostsSourceIndex = Math.Clamp(_selectedHostsSourceIndex, 0, 3);

                SettingsManager.Save();
            }
            catch (Exception ex)
            {
                UIHelper.ShowAlert("Ошибка сохранения", $"Не удалось сохранить настройки: {ex.Message}", isError: true);
            }
        }

        private async void BtnUpdateIpSet_Click(object sender, RoutedEventArgs e)
        {
            AudioHelper.PlayClick();
            BtnUpdateIpSet.IsEnabled = false;
            BtnUpdateIpSet.Content = "Загрузка...";

            try
            {
                int count = await ServiceToolsManager.UpdateIpSetFromWebAsync();
                RefreshIpSetAndHostsUI();
                UIHelper.ShowAlert("База IPSet обновлена", $"Список ipset-all.txt успешно загружен из репозитория Flowseal!\nВсего подсетей в базе: {count}");
            }
            catch (Exception ex)
            {
                UIHelper.ShowAlert("Ошибка обновления IPSet", $"Не удалось обновить список IPSet:\n{ex.Message}", isError: true);
            }
            finally
            {
                BtnUpdateIpSet.Content = "🔄 Обновить базу IP";
                BtnUpdateIpSet.IsEnabled = true;
            }
        }

        private async void BtnUpdateHosts_Click(object sender, RoutedEventArgs e)
        {
            AudioHelper.PlayClick();
            BtnUpdateHosts.IsEnabled = false;
            BtnUpdateHosts.Content = "Загрузка...";

            try
            {
                int sourceIdx = Math.Clamp(_selectedHostsSourceIndex, 0, 3);
                int count = await ServiceToolsManager.UpdateSystemHostsAsync(sourceIdx);
                RefreshIpSetAndHostsUI();

                UIHelper.ShowAlert("Файл Hosts обновлен", $"В системный файл hosts успешно записано {count} актуальных правил маршрутизации, а DNS-кэш Windows очищен!\n\nВаши личные записи в файле hosts были бережно сохранены.");
            }
            catch (UnauthorizedAccessException)
            {
                UIHelper.ShowAlert("Требуются права администратора", "Для изменения системного файла C:\\Windows\\System32\\drivers\\etc\\hosts перезапустите программу от имени Администратора!", isError: true);
            }
            catch (Exception ex)
            {
                UIHelper.ShowAlert("Ошибка обновления Hosts", $"Не удалось обновить системный файл hosts:\n{ex.Message}", isError: true);
            }
            finally
            {
                BtnUpdateHosts.Content = "⚡ Обновить";
                BtnUpdateHosts.IsEnabled = true;
            }
        }

        private void BtnClearHosts_Click(object sender, RoutedEventArgs e)
        {
            AudioHelper.PlayClick();

            bool confirm = UIHelper.ShowConfirm(
                "Очистка записей Zapret из Hosts",
                "Удалить все добавленные программой обходные записи из системного файла hosts?\nВаши собственные записи затронуты не будут.",
                confirmText: "Очистить",
                isDanger: true);

            if (!confirm) return;

            try
            {
                ServiceToolsManager.ClearZapretHosts();
                RefreshIpSetAndHostsUI();
                UIHelper.ShowAlert("Готово", "Записи Zapret успешно удалены из системного файла hosts, DNS-кэш сброшен.");
            }
            catch (UnauthorizedAccessException)
            {
                UIHelper.ShowAlert("Требуются права администратора", "Для изменения системного файла hosts запустите программу от имени Администратора!", isError: true);
            }
            catch (Exception ex)
            {
                UIHelper.ShowAlert("Ошибка", $"Не удалось очистить файл hosts:\n{ex.Message}", isError: true);
            }
        }

        private void BtnOpenZapretFolder_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                var zapretFolder = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, AppConstants.CoreFilesDirectory);
                if (!Directory.Exists(zapretFolder)) Directory.CreateDirectory(zapretFolder);
                Process.Start("explorer.exe", zapretFolder);
            }
            catch (Exception ex)
            {
                UIHelper.ShowAlert("Ошибка", $"Не удалось открыть папку: {ex.Message}", isError: true);
            }
        }

        private void BtnResetSettings_Click(object sender, RoutedEventArgs e)
        {
            var confirmed = UIHelper.ShowConfirm(
                "Сброс настроек",
                "Вы уверены, что хотите вернуть все настройки к состоянию по умолчанию? Это действие нельзя отменить.",
                confirmText: "Сбросить",
                isDanger: true);

            if (confirmed)
            {
                try
                {
                    var settingsPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "config.json");
                    if (File.Exists(settingsPath))
                        File.Delete(settingsPath);

                    StartupHelper.SetAutoStart(false);

                    SettingsManager.Load();
                    ServiceToolsManager.SyncGameFilterFile();
                    UIHelper.ApplyThemeColors();
                    LoadSettings();

                    UIHelper.ShowAlert("Готово", "Настройки успешно сброшены. Некоторые изменения вступят в силу после перезапуска программы.");
                }
                catch (Exception ex)
                {
                    UIHelper.ShowAlert("Ошибка сброса", $"Ошибка при сбросе: {ex.Message}", isError: true);
                }
            }
        }

        private void Hyperlink_RequestNavigate(object sender, System.Windows.Navigation.RequestNavigateEventArgs e)
        {
            Process.Start(new ProcessStartInfo(e.Uri.AbsoluteUri) { UseShellExecute = true });
            e.Handled = true;
        }

        private async void BtnCheckUpdates_Click(object sender, RoutedEventArgs e)
        {
            if (sender is System.Windows.Controls.Button btn)
                btn.IsEnabled = false;

            Action stopServicesAction = () =>
            {
                if (System.Windows.Application.Current.MainWindow is MainWindow mw && mw.IsBypassRunning())
                    mw.ToggleBypass();
            };

            await Core.UpdateManager.RunUpdateWorkflowAsync(isManualCheck: true, stopServicesAction, null);

            if (sender is System.Windows.Controls.Button btnReEnable)
                btnReEnable.IsEnabled = true;
        }
    }
}