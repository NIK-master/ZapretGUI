using System;
using System.IO;
using System.Text.Json;

namespace ZapretGUI.Core
{
    public class AppSettings
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

    public static class SettingsManager
    {
        private static readonly string _settingsPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "config.json");

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
            catch { }
        }

        public static void Save()
        {
            try
            {
                var json = JsonSerializer.Serialize(Current, new JsonSerializerOptions { WriteIndented = true });
                File.WriteAllText(_settingsPath, json);

                SettingsSaved?.Invoke();
            }
            catch { }
        }
    }
}