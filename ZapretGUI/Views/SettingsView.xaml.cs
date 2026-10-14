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

                UIHelper.ApplyThemeColors();

                settings.PingUrl = string.IsNullOrWhiteSpace(TxtPingUrl.Text) ? AppConstants.DefaultPingUrl : TxtPingUrl.Text;
                settings.AutoRestartServices = ToggleAutoRestart.IsChecked ?? false;

                settings.StatsUpdateInterval = ComboUpdateInterval.SelectedIndex switch { 1 => 3, 2 => 5, _ => 1 };

                SettingsManager.Save();
            }
            catch (Exception ex)
            {
                UIHelper.ShowAlert("Ошибка сохранения", $"Не удалось сохранить настройки: {ex.Message}", isError: true);
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