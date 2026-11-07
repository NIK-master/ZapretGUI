using System;
using System.Diagnostics;
using System.IO;
using Microsoft.Win32;

namespace ZapretGUI.Core
{
    public static class StartupHelper
    {
        private const string RegistryKeyPath = @"SOFTWARE\Microsoft\Windows\CurrentVersion\Run";
        private const string TaskName = AppConstants.AppRegistryName;

        public static bool IsAutoStartEnabled()
        {
            try
            {
                // 1. Проверяем наличие задачи в Планировщике Windows (основной способ для requireAdministrator)
                using var p = Process.Start(new ProcessStartInfo
                {
                    FileName = "schtasks.exe",
                    Arguments = $"/Query /TN \"{TaskName}\"",
                    CreateNoWindow = true,
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true
                });

                p?.WaitForExit(1500);
                if (p != null && p.ExitCode == 0)
                    return true;

                // 2. Фолбэк: проверяем реестр (на случай если запуск без админ-прав)
                using var key = Registry.CurrentUser.OpenSubKey(RegistryKeyPath, false);
                return key?.GetValue(AppConstants.AppRegistryName) != null;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Ошибка проверки автозапуска: {ex.Message}");
                return false;
            }
        }

        public static void SetAutoStart(bool enable)
        {
            try
            {
                var exePath = Environment.ProcessPath;
                if (string.IsNullOrEmpty(exePath))
                    exePath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "ZapretGUI.exe");

                // Всегда подчищаем старый ключ в Run, чтобы Windows не плодила дубликаты
                using (var key = Registry.CurrentUser.OpenSubKey(RegistryKeyPath, true))
                {
                    key?.DeleteValue(AppConstants.AppRegistryName, false);
                }

                if (enable)
                {
                    // Создаем задачу при входе пользователя с наивысшими правами (/RL HIGHEST)
                    using var p = Process.Start(new ProcessStartInfo
                    {
                        FileName = "schtasks.exe",
                        Arguments = $"/Create /F /RL HIGHEST /SC ONLOGON /TN \"{TaskName}\" /TR \"\\\"{exePath}\\\"\"",
                        CreateNoWindow = true,
                        UseShellExecute = false,
                        RedirectStandardOutput = true,
                        RedirectStandardError = true
                    });
                    p?.WaitForExit(2500);

                    // Если по какой-то причине служба планировщика отключена, пишем в реестр как резерв
                    if (p == null || p.ExitCode != 0)
                    {
                        using var key = Registry.CurrentUser.OpenSubKey(RegistryKeyPath, true);
                        key?.SetValue(AppConstants.AppRegistryName, $"\"{exePath}\"");
                    }
                }
                else
                {
                    using var p = Process.Start(new ProcessStartInfo
                    {
                        FileName = "schtasks.exe",
                        Arguments = $"/Delete /F /TN \"{TaskName}\"",
                        CreateNoWindow = true,
                        UseShellExecute = false,
                        RedirectStandardOutput = true,
                        RedirectStandardError = true
                    });
                    p?.WaitForExit(2500);
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Ошибка настройки автозапуска: {ex.Message}");
            }
        }
    }
}