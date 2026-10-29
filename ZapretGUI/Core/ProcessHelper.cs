using System;
using System.Diagnostics;

namespace ZapretGUI.Core
{
    public static class ProcessHelper
    {
        public static void KillProcessesByName(string processName)
        {
            var processes = Process.GetProcessesByName(processName);
            foreach (var process in processes)
            {
                try
                {
                    if (!process.HasExited)
                    {
                        process.Kill(entireProcessTree: true);
                        process.WaitForExit(1500);
                    }
                }
                catch (Exception ex)
                {
                    Debug.WriteLine($"Ошибка при завершении процесса {processName}: {ex.Message}");
                }
                finally
                {
                    process.Dispose();
                }
            }
        }

        public static bool IsProcessRunning(string processName)
        {
            var processes = Process.GetProcessesByName(processName);
            bool running = processes.Length > 0;
            foreach (var p in processes)
            {
                p.Dispose();
            }
            return running;
        }
    }
}