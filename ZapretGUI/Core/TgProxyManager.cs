using System;
using System.Diagnostics;
using System.IO;

namespace ZapretGUI.Core
{
    public class TgProxyManager : IBypassService
    {
        private readonly string _proxyPath;
        private Process? _process;
        private DateTime _lastCheckTime = DateTime.MinValue;
        private bool _cachedRunning = false;

        public event Action<string>? LogMessage;

        public TgProxyManager()
        {
            _proxyPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, AppConstants.CoreFilesDirectory, $"{AppConstants.TgProxyProcessName}.exe");
        }

        public void Start(string profileName = "")
        {
            if (IsRunning)
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

            _cachedRunning = true;
            _lastCheckTime = DateTime.UtcNow;
        }

        public void Stop()
        {
            try
            {
                if (_process != null)
                {
                    if (!_process.HasExited)
                        _process.Kill(entireProcessTree: true);
                    _process.Dispose();
                    _process = null;
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Ошибка остановки процесса TgProxy: {ex.Message}");
            }

            ProcessHelper.KillProcessesByName(AppConstants.TgProxyProcessName);
            _cachedRunning = false;
            _lastCheckTime = DateTime.UtcNow;
        }

        public bool IsRunning
        {
            get
            {
                try
                {
                    if (_process != null && !_process.HasExited)
                        return true;
                }
                catch { }

                if ((DateTime.UtcNow - _lastCheckTime).TotalSeconds < 2.5)
                    return _cachedRunning;

                _cachedRunning = ProcessHelper.IsProcessRunning(AppConstants.TgProxyProcessName);
                _lastCheckTime = DateTime.UtcNow;
                return _cachedRunning;
            }
        }
    }
}