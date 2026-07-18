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
                    process.Kill();
                    process.WaitForExit();
                }
                catch { }
            }
        }
    }
}