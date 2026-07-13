using System;
using System.Diagnostics;
using System.IO;

namespace ZapretGUI.Core
{
    public class TgProxyManager
    {
        private readonly string _proxyPath;
        private readonly string _processName = "TgWsProxy_windows";

        public TgProxyManager()
        {
            _proxyPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "ZapretFiles", "TgWsProxy_windows.exe");
        }

        public void Start()
        {
            if (IsRunning()) return;

            if (!File.Exists(_proxyPath))
            {
                throw new FileNotFoundException($"Файл прокси не найден по пути: {_proxyPath}");
            }

            var startInfo = new ProcessStartInfo
            {
                FileName = _proxyPath,
                UseShellExecute = false,
                CreateNoWindow = true
            };

            Process.Start(startInfo);
        }

        public void Stop()
        {
            var processes = Process.GetProcessesByName(_processName);
            foreach (var process in processes)
            {
                try
                {
                    process.Kill();
                    process.WaitForExit();
                }
                catch
                {
                }
            }
        }

        public bool IsRunning()
        {
            return Process.GetProcessesByName(_processName).Length > 0;
        }
    }
}