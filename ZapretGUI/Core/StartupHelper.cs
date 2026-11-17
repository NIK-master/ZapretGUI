using System;
using System.Diagnostics;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Win32;

namespace ZapretGUI.Core
{
    public static class StartupHelper
    {
        private const string RegistryKeyPath = @"SOFTWARE\Microsoft\Windows\CurrentVersion\Run";
        private const string TaskName = AppConstants.AppRegistryName;

        public static async Task<bool> IsAutoStartEnabledAsync()
        {
            try
            {
                using var p = Process.Start(new ProcessStartInfo
                {
                    FileName = "schtasks.exe",
                    Arguments = $"/Query /TN \"{TaskName}\"",
                    CreateNoWindow = true,
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true
                });

                if (p != null)
                {
                    using var cts = new CancellationTokenSource(1500);
                    try { await p.WaitForExitAsync(cts.Token); } catch (TaskCanceledException) { }
                    if (p.HasExited && p.ExitCode == 0) return true;
                }

                using var key = Registry.CurrentUser.OpenSubKey(RegistryKeyPath, false);
                return key?.GetValue(AppConstants.AppRegistryName) != null;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Ошибка проверки автозапуска: {ex.Message}");
                return false;
            }
        }

        public static async Task SetAutoStartAsync(bool enable)
        {
            try
            {
                var exePath = Environment.ProcessPath;
                if (string.IsNullOrEmpty(exePath))
                    exePath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "ZapretGUI.exe");

                using (var key = Registry.CurrentUser.OpenSubKey(RegistryKeyPath, true))
                {
                    key?.DeleteValue(AppConstants.AppRegistryName, false);
                }

                if (enable)
                {
                    using var p = Process.Start(new ProcessStartInfo
                    {
                        FileName = "schtasks.exe",
                        Arguments = $"/Create /F /RL HIGHEST /SC ONLOGON /TN \"{TaskName}\" /TR \"\\\"{exePath}\\\"\"",
                        CreateNoWindow = true,
                        UseShellExecute = false,
                        RedirectStandardOutput = true,
                        RedirectStandardError = true
                    });

                    if (p != null)
                    {
                        using var cts = new CancellationTokenSource(2500);
                        try { await p.WaitForExitAsync(cts.Token); } catch (TaskCanceledException) { }
                    }

                    if (p == null || !p.HasExited || p.ExitCode != 0)
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
                    if (p != null)
                    {
                        using var cts = new CancellationTokenSource(2500);
                        try { await p.WaitForExitAsync(cts.Token); } catch (TaskCanceledException) { }
                    }
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Ошибка настройки автозапуска: {ex.Message}");
            }
        }
    }
}