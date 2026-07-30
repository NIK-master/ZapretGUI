using System;
using System.Diagnostics;
using System.IO;
using System.Windows;
using System.Windows.Interop;
using ZapretGUI.Core;

namespace ZapretGUI.Views
{
    public partial class SettingsView : System.Windows.Controls.UserControl
    {
        public SettingsView()
        {
            InitializeComponent();
            LoadSettings();
        }

        private void LoadSettings()
        {
            try
            {
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

                switch (settings.StatsUpdateInterval)
                {
                    case 3: ComboUpdateInterval.SelectedIndex = 1; break;
                    case 5: ComboUpdateInterval.SelectedIndex = 2; break;
                    default: ComboUpdateInterval.SelectedIndex = 0; break;
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Ошибка при загрузке настроек в UI: {ex.Message}");
            }
        }

        private void Setting_Changed(object sender, RoutedEventArgs e)
        {
            AudioHelper.PlayClick();
            SaveAllSettings();
        }

        private void TextInput_LostFocus(object sender, RoutedEventArgs e)
        {
            SaveAllSettings();
        }

        private void SaveAllSettings()
        {
            if (!IsLoaded) return;

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

                var res = System.Windows.Application.Current.Resources;
                if (settings.ColorblindMode)
                {
                    res["BrandSuccessBrush"] = UIHelper.GetBrushFromHex("#0078D7");
                    res["BrandErrorBrush"] = UIHelper.GetBrushFromHex("#FF8C00");
                }
                else
                {
                    res["BrandSuccessBrush"] = UIHelper.GetBrushFromHex("#107C10");
                    res["BrandErrorBrush"] = UIHelper.GetBrushFromHex("#D13438");
                }

                settings.PingUrl = string.IsNullOrWhiteSpace(TxtPingUrl.Text) ? AppConstants.DefaultPingUrl : TxtPingUrl.Text;
                settings.AutoRestartServices = ToggleAutoRestart.IsChecked ?? false;

                settings.StatsUpdateInterval = ComboUpdateInterval.SelectedIndex switch { 1 => 3, 2 => 5, _ => 1 };

                SettingsManager.Save();
            }
            catch (Exception ex)
            {
                System.Windows.MessageBox.Show($"Не удалось сохранить настройки: {ex.Message}", "Ошибка", System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Error);
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
                System.Windows.MessageBox.Show($"Не удалось открыть папку: {ex.Message}", "Ошибка", System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Warning);
            }
        }

        private void BtnResetSettings_Click(object sender, RoutedEventArgs e)
        {
            var result = System.Windows.MessageBox.Show(
                "Вы уверены, что хотите вернуть все настройки к состоянию по умолчанию? Это действие нельзя отменить.",
                "Сброс настроек", System.Windows.MessageBoxButton.YesNo, System.Windows.MessageBoxImage.Warning);

            if (result == System.Windows.MessageBoxResult.Yes)
            {
                try
                {
                    var settingsPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "config.json");
                    if (File.Exists(settingsPath)) File.Delete(settingsPath);

                    StartupHelper.SetAutoStart(false);

                    SettingsManager.Load();
                    LoadSettings();

                    System.Windows.MessageBox.Show("Настройки успешно сброшены. Некоторые изменения вступят в силу после перезапуска программы.", "Готово", System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Information);
                }
                catch (Exception ex)
                {
                    System.Windows.MessageBox.Show($"Ошибка при сбросе: {ex.Message}", "Ошибка", System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Error);
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
            if (sender is System.Windows.Controls.Button btn) btn.IsEnabled = false;

            var appUpdate = await Core.UpdateManager.CheckForAppUpdateAsync();
            if (appUpdate.UpdateAvailable)
            {
                var prompt = new Views.UpdateWindow("Обновление программы", $"Доступна новая версия панели управления {appUpdate.Version}!\n\nПрограмма будет закрыта для установки обновления. Продолжить?");
                prompt.ShowDialog();
                if (prompt.Result && !string.IsNullOrEmpty(appUpdate.DownloadUrl))
                    await Core.UpdateManager.ApplyAppUpdateAsync(appUpdate.DownloadUrl, () => System.Windows.Application.Current.Shutdown());
            }
            else
            {
                new Views.UpdateWindow("Проверка обновлений", "У вас уже установлена самая последняя версия панели управления!", "ОК").ShowDialog();
            }

            Action stopServicesAction = () => { if (System.Windows.Application.Current.MainWindow is MainWindow mw && mw.IsBypassRunning()) mw.ToggleBypass(); };

            var zapretUpdate = await Core.UpdateManager.CheckForCoreUpdateAsync("https://api.github.com/repos/flowseal/zapret-discord-youtube/releases/latest", SettingsManager.Current.ZapretCoreVersion, "Zapret", true);
            if (zapretUpdate.UpdateAvailable)
            {
                var prompt = new Views.UpdateWindow("Обновление ядра Zapret", $"Найдено обновление обхода Zapret ({zapretUpdate.Version})!\n\nТекущая версия: {zapretUpdate.CurrentVersion}\nОбновить автоматически?");
                prompt.ShowDialog();
                if (prompt.Result)
                {
                    try
                    {
                        await Core.UpdateManager.InstallCoreAsync(zapretUpdate, stopServicesAction, null);
                        SettingsManager.Current.ZapretCoreVersion = zapretUpdate.Version;
                        SettingsManager.Save();
                        new Views.UpdateWindow("Успех", "Модуль Zapret успешно обновлен!", "ОК").ShowDialog();
                    }
                    catch (Exception ex) { new Views.UpdateWindow("Ошибка", $"Ошибка: {ex.Message}", "ОК").ShowDialog(); }
                }
            }
            else
            {
                new Views.UpdateWindow("Проверка ядра Zapret", "Ядро Zapret обновлено до последней версии.", "ОК").ShowDialog();
            }

            var proxyUpdate = await Core.UpdateManager.CheckForCoreUpdateAsync("https://api.github.com/repos/flowseal/tg-ws-proxy/releases/latest", SettingsManager.Current.TgProxyCoreVersion, "TgWsProxy", false);
            if (proxyUpdate.UpdateAvailable)
            {
                var prompt = new Views.UpdateWindow("Обновление ядра TgWsProxy", $"Найдено обновление прокси Telegram ({proxyUpdate.Version})!\n\nОбновить автоматически?");
                prompt.ShowDialog();
                if (prompt.Result)
                {
                    try
                    {
                        await Core.UpdateManager.InstallCoreAsync(proxyUpdate, stopServicesAction, null);
                        SettingsManager.Current.TgProxyCoreVersion = proxyUpdate.Version;
                        SettingsManager.Save();
                        new Views.UpdateWindow("Успех", "Модуль TgWsProxy успешно обновлен!", "ОК").ShowDialog();
                    }
                    catch (Exception ex) { new Views.UpdateWindow("Ошибка", $"Ошибка: {ex.Message}", "ОК").ShowDialog(); }
                }
            }
            else
            {
                new Views.UpdateWindow("Проверка ядра TgWsProxy", "Ядро TgWsProxy обновлено до последней версии.", "ОК").ShowDialog();
            }

            if (sender is System.Windows.Controls.Button btnReEnable) btnReEnable.IsEnabled = true;
        }
    }
}