using System;
using System.Diagnostics;
using System.IO;
using System.Text.RegularExpressions;

namespace ZapretGUI.Core
{
    public class ZapretManager
    {
        private readonly string _basePath;
        private Process? _process;

        public event Action<string>? LogMessage;

        public ZapretManager()
        {
            _basePath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "ZapretFiles");
        }

        public void Start(string profileName)
        {
            Stop();

            var batFilePath = Path.Combine(_basePath, profileName);
            if (!File.Exists(batFilePath))
                throw new FileNotFoundException($"Профиль {profileName} не найден по пути: {batFilePath}");

            var batContent = File.ReadAllText(batFilePath);

            var match = Regex.Match(batContent, @"winws(?:\.exe)?[""']?\s+(.+)");
            if (!match.Success)
                throw new Exception("Не удалось найти параметры запуска winws в .bat файле.");

            var arguments = match.Groups[1].Value.Trim();

            arguments = arguments.Replace("^\r\n", " ").Replace("^\n", " ").Replace("^", "");

            var exePath = Path.Combine(_basePath, "winws.exe");

            var startInfo = new ProcessStartInfo
            {
                FileName = exePath,
                Arguments = arguments,
                UseShellExecute = false, 
                CreateNoWindow = true,
                RedirectStandardOutput = true, 
                RedirectStandardError = true,  
                WorkingDirectory = _basePath
            };

            _process = new Process { StartInfo = startInfo };

            _process.OutputDataReceived += (s, e) => { if (!string.IsNullOrEmpty(e.Data)) LogMessage?.Invoke($"[Zapret] {e.Data}"); };
            _process.ErrorDataReceived += (s, e) => { if (!string.IsNullOrEmpty(e.Data)) LogMessage?.Invoke($"[Zapret ERR] {e.Data}"); };

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

            ProcessHelper.KillProcessesByName("winws");
        }

        public bool IsRunning()
            => Process.GetProcessesByName("winws").Length > 0;
    }
}