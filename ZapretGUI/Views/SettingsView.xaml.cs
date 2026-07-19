using System;
using System.Diagnostics;
using System.IO;
using System.Windows;
using System.Windows.Interop;
using Microsoft.Win32;
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
                using (var key = Registry.CurrentUser.OpenSubKey("SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run", true))
                {
                    if (key != null)
                        ToggleAutoStart.IsChecked = key.GetValue(AppConstants.AppRegistryName) != null;
                }

                var settings = SettingsManager.Current;

                ToggleStartMinimized.IsChecked = settings.StartMinimized;
                ToggleMinimizeOnClose.IsChecked = settings.MinimizeOnClose;
                ToggleNotifications.IsChecked = settings.NotificationsEnabled;

                ToggleFocusMode.IsChecked = settings.FocusMode;
                ToggleCompactMode.IsChecked = settings.CompactMode;
                ToggleHardwareAccel.IsChecked = settings.HardwareAcceleration;
                ToggleColorblind.IsChecked = settings.ColorblindMode;

                TxtPingUrl.Text = settings.PingUrl ?? "https://dynamodb.eu-central-1.amazonaws.com";
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
            SaveAllSettings();
        }

        private void TextInput_LostFocus(object sender, RoutedEventArgs e)
        {
            SaveAllSettings();
        }

        private void SaveAllSettings()
        {
            if (!IsLoaded)
                return;

            try
            {
                using (var key = Registry.CurrentUser.OpenSubKey("SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run", true))
                {
                    if (key != null)
                    {
                        if (ToggleAutoStart.IsChecked == true)
                        {
                            var exePath = System.Reflection.Assembly.GetExecutingAssembly().Location;
                            exePath = Path.ChangeExtension(exePath, ".exe");
                            key.SetValue(AppConstants.AppRegistryName, $"\"{exePath}\"");
                        }
                        else
                        {
                            key.DeleteValue(AppConstants.AppRegistryName, false);
                        }
                    }
                }

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

                settings.PingUrl = string.IsNullOrWhiteSpace(TxtPingUrl.Text) ? "https://dynamodb.eu-central-1.amazonaws.com" : TxtPingUrl.Text;
                settings.AutoRestartServices = ToggleAutoRestart.IsChecked ?? false;

                var interval = 1;
                if (ComboUpdateInterval.SelectedIndex == 1)
                    interval = 3;
                else if (ComboUpdateInterval.SelectedIndex == 2)
                    interval = 5;
                settings.StatsUpdateInterval = interval;

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

                if (!Directory.Exists(zapretFolder))
                    Directory.CreateDirectory(zapretFolder);

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
                "Сброс настроек",
                System.Windows.MessageBoxButton.YesNo,
                System.Windows.MessageBoxImage.Warning);

            if (result == System.Windows.MessageBoxResult.Yes)
            {
                try
                {
                    var settingsPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "config.json");
                    if (File.Exists(settingsPath))
                    {
                        File.Delete(settingsPath);
                    }

                    using (var key = Registry.CurrentUser.OpenSubKey("SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run", true))
                    {
                        if (key != null)
                            key.DeleteValue(AppConstants.AppRegistryName, false);
                    }

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
            if (sender is System.Windows.Controls.Button btn)
                btn.IsEnabled = false;

            await ZapretGUI.Core.UpdateManager.CheckForUpdatesAsync(isManualCheck: true);

            if (sender is System.Windows.Controls.Button btnReEnable)
                btnReEnable.IsEnabled = true;
        }
    }
}