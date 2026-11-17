using System;
using System.Diagnostics;
using System.IO;
using System.Text.Json;

namespace ZapretGUI.Core
{
    public class AppSettings
    {
        public bool ZapretEnabled { get; set; } = true;
        public bool TgProxyEnabled { get; set; } = true;
        public string SelectedProfileName { get; set; } = "general.bat";
        public bool StartMinimized { get; set; } = false;
        public bool MinimizeOnClose { get; set; } = true;
        public bool NotificationsEnabled { get; set; } = true;
        public bool FocusMode { get; set; } = false;
        public bool CompactMode { get; set; } = false;
        public bool HardwareAcceleration { get; set; } = true;
        public string PingUrl { get; set; } = "https://dynamodb.eu-central-1.amazonaws.com";
        public bool AutoRestartServices { get; set; } = false;
        public int StatsUpdateInterval { get; set; } = 1;

        public bool AutoStartBypass { get; set; } = false;
        public bool StopServicesOnExit { get; set; } = true;
        public bool SoundEffectsEnabled { get; set; } = true;
        public bool SkipSplashScreen { get; set; } = false;
        public bool AlwaysOnTop { get; set; } = false;
        public string AccentTheme { get; set; } = "green";
        public bool WatchdogPingAutoRestart { get; set; } = false;

        public string ZapretCoreVersion { get; set; } = "0.0.0";
        public string TgProxyCoreVersion { get; set; } = "0.0.0";

        public System.Collections.Generic.List<string> ActiveBatMods { get; set; } = new();
        public System.Collections.Generic.List<string> ActiveListMods { get; set; } = new();

        public string GameFilterMode { get; set; } = "disabled";
        public string GameFilterTcpRange { get; set; } = "1024-65535";
        public string GameFilterUdpRange { get; set; } = "1024-65535";
        public int HostsSourceIndex { get; set; } = 2;
        public bool FirstTimeScanPrompted { get; set; } = false;
    }

    public static class SettingsManager
    {
        private static readonly string _settingsPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "config.json");
        private static readonly object _saveLock = new object();

        public static AppSettings Current { get; set; } = new AppSettings();
        public static event Action? SettingsSaved;

        public static void Load()
        {
            try
            {
                if (File.Exists(_settingsPath))
                {
                    var json = File.ReadAllText(_settingsPath);
                    var settings = JsonSerializer.Deserialize<AppSettings>(json);
                    if (settings != null)
                        Current = settings;
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Ошибка загрузки настроек: {ex.Message}");
            }
        }

        public static void Save()
        {
            lock (_saveLock)
            {
                try
                {
                    var json = JsonSerializer.Serialize(Current, new JsonSerializerOptions { WriteIndented = true });
                    var tempPath = _settingsPath + ".tmp";

                    File.WriteAllText(tempPath, json);
                    File.Move(tempPath, _settingsPath, overwrite: true);

                    SettingsSaved?.Invoke();
                }
                catch (Exception ex)
                {
                    Debug.WriteLine($"Ошибка сохранения настроек: {ex.Message}");
                }
            }
        }
    }
}