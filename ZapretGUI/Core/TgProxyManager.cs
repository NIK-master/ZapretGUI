using System;
using System.Diagnostics;
using System.IO;

namespace ZapretGUI.Core
{
    public class TgProxyManager
    {
        private readonly string _proxyPath;
        private readonly string _processName = "TgWsProxy_windows";
        private Process? _process;

        public event Action<string>? LogMessage;

        public TgProxyManager()
        {
            _proxyPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "ZapretFiles", "TgWsProxy_windows.exe");
        }

        public void Start()
        {
            if (IsRunning())
                return;

            if (!File.Exists(_proxyPath))
                throw new FileNotFoundException($"Файл прокси не найден: {_proxyPath}");

            var startInfo = new ProcessStartInfo
            {
                FileName = _proxyPath,
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true
            };

            _process = new Process { StartInfo = startInfo };

            _process.OutputDataReceived += (s, e) => { if (!string.IsNullOrEmpty(e.Data)) LogMessage?.Invoke($"[TgWsProxy] {e.Data}"); };
            _process.ErrorDataReceived += (s, e) => { if (!string.IsNullOrEmpty(e.Data)) LogMessage?.Invoke($"[TgWsProxy ERR] {e.Data}"); };

            _process.Start();
            _process.BeginOutputReadLine();
            _process.BeginErrorReadLine();
        }

        public void Stop()
        {
            try
            {
                if (_process != null && !_process.HasExited)
                {
                    _process.Kill();
                    _process.Dispose();
                    _process = null;
                }
            }
            catch { }
            ProcessHelper.KillProcessesByName(_processName);
        }

        public bool IsRunning()
            => Process.GetProcessesByName(_processName).Length > 0;
    }
}