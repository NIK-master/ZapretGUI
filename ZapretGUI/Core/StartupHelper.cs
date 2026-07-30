using System;
using System.Diagnostics;
using System.IO;
using Microsoft.Win32;

namespace ZapretGUI.Core
{
    public static class StartupHelper
    {
        private const string RegistryKeyPath = "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run";

        public static bool IsAutoStartEnabled()
        {
            try
            {
                using var key = Registry.CurrentUser.OpenSubKey(RegistryKeyPath, false);
                return key?.GetValue(AppConstants.AppRegistryName) != null;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Ошибка чтения реестра: {ex.Message}");
                return false;
            }
        }

        public static void SetAutoStart(bool enable)
        {
            try
            {
                using var key = Registry.CurrentUser.OpenSubKey(RegistryKeyPath, true);
                if (key == null) return;

                if (enable)
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
            catch (Exception ex)
            {
                Debug.WriteLine($"Ошибка записи в реестр: {ex.Message}");
            }
        }
    }
}