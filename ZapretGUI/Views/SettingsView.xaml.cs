using System;
using System.Diagnostics;
using System.IO;
using System.Text.Json;
using System.Windows;
using System.Windows.Interop;
using Microsoft.Win32;

namespace ZapretGUI.Views
{
    public partial class SettingsView : System.Windows.Controls.UserControl
    {
        private readonly string _settingsPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "config.json");
        private readonly string _appName = "ZapretForADHD";

        private class AppSettings
        {
            public bool ZapretEnabled { get; set; } = true;
            public bool TgProxyEnabled { get; set; } = true;
            public int SelectedProfileIndex { get; set; } = 0;

            public bool StartMinimized { get; set; } = false;
            public bool MinimizeOnClose { get; set; } = true;
            public bool NotificationsEnabled { get; set; } = true;

            public bool FocusMode { get; set; } = false;
            public bool CompactMode { get; set; } = false;
            public bool HardwareAcceleration { get; set; } = true;
            public bool ColorblindMode { get; set; } = false;

            public string PingUrl { get; set; } = "https://dynamodb.eu-central-1.amazonaws.com";
            public bool AutoRestartServices { get; set; } = false;
            public int StatsUpdateInterval { get; set; } = 1;
        }

        public SettingsView()
        {
            InitializeComponent();
            LoadSettings();
        }

        private void LoadSettings()
        {
            try
            {
                using (RegistryKey? key = Registry.CurrentUser.OpenSubKey("SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run", true))
                {
                    if (key != null)
                        ToggleAutoStart.IsChecked = key.GetValue(_appName) != null;
                }

                if (File.Exists(_settingsPath))
                {
                    var json = File.ReadAllText(_settingsPath);
                    var settings = JsonSerializer.Deserialize<AppSettings>(json);

                    if (settings != null)
                    {
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
                }
                else
                {
                    ToggleHardwareAccel.IsChecked = true;
                }
            }
            catch { }
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
                using (RegistryKey? key = Registry.CurrentUser.OpenSubKey("SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run", true))
                {
                    if (key != null)
                    {
                        if (ToggleAutoStart.IsChecked == true)
                        {
                            var exePath = System.Reflection.Assembly.GetExecutingAssembly().Location;
                            exePath = Path.ChangeExtension(exePath, ".exe");
                            key.SetValue(_appName, $"\"{exePath}\"");
                        }
                        else
                            key.DeleteValue(_appName, false);
                    }
                }

                var useGpu = ToggleHardwareAccel.IsChecked ?? true;
                System.Windows.Media.RenderOptions.ProcessRenderMode = useGpu ? RenderMode.Default : RenderMode.SoftwareOnly;

                AppSettings currentSettings = new AppSettings();

                if (File.Exists(_settingsPath))
                {
                    var existingJson = File.ReadAllText(_settingsPath);
                    var loaded = JsonSerializer.Deserialize<AppSettings>(existingJson);
                    if (loaded != null)
                        currentSettings = loaded;
                }

                currentSettings.StartMinimized = ToggleStartMinimized.IsChecked ?? false;
                currentSettings.MinimizeOnClose = ToggleMinimizeOnClose.IsChecked ?? true;
                currentSettings.NotificationsEnabled = ToggleNotifications.IsChecked ?? true;

                currentSettings.FocusMode = ToggleFocusMode.IsChecked ?? false;
                currentSettings.CompactMode = ToggleCompactMode.IsChecked ?? false;
                currentSettings.HardwareAcceleration = useGpu;
                currentSettings.ColorblindMode = ToggleColorblind.IsChecked ?? false;

                currentSettings.PingUrl = string.IsNullOrWhiteSpace(TxtPingUrl.Text) ? "https://dynamodb.eu-central-1.amazonaws.com" : TxtPingUrl.Text;
                currentSettings.AutoRestartServices = ToggleAutoRestart.IsChecked ?? false;

                var interval = 1;
                if (ComboUpdateInterval.SelectedIndex == 1)
                    interval = 3;
                else if (ComboUpdateInterval.SelectedIndex == 2)
                    interval = 5;
                currentSettings.StatsUpdateInterval = interval;

                var newJson = JsonSerializer.Serialize(currentSettings, new JsonSerializerOptions { WriteIndented = true });
                File.WriteAllText(_settingsPath, newJson);
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
                var zapretFolder = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "zapret-winws");

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
                    if (File.Exists(_settingsPath))
                    {
                        File.Delete(_settingsPath);
                    }

                    using (RegistryKey? key = Registry.CurrentUser.OpenSubKey("SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run", true))
                    {
                        if (key != null) 
                            key.DeleteValue(_appName, false);
                    }

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
    }
}