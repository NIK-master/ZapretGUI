using System;
using System.Diagnostics;
using System.IO;
using System.Text.RegularExpressions;

namespace ZapretGUI.Core
{
    public class ZapretManager
    {
        private string _basePath;
        private Process? _process;

        public event Action<string>? LogMessage;

        public ZapretManager()
        {
            _basePath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, AppConstants.CoreFilesDirectory);
        }

        public void Start(string profileName)
        {
            Stop();

            var batFilePath = Path.Combine(_basePath, profileName);
            if (!File.Exists(batFilePath))
                throw new FileNotFoundException($"Профиль {profileName} не найден по пути: {batFilePath}");

            var lines = File.ReadAllLines(batFilePath);
            var arguments = "";
            bool isReadingArgs = false;

            foreach (var line in lines)
            {
                var trimmed = line.Trim();

                if (trimmed.StartsWith("::") || trimmed.StartsWith("rem ", StringComparison.OrdinalIgnoreCase))
                    continue;

                if (!isReadingArgs && trimmed.Contains(AppConstants.ZapretProcessName, StringComparison.OrdinalIgnoreCase))
                {
                    isReadingArgs = true;
                    var match = Regex.Match(trimmed, $@"{AppConstants.ZapretProcessName}(?:\.exe)?[""']?\s+(.*)", RegexOptions.IgnoreCase);
                    trimmed = match.Success ? match.Groups[1].Value.Trim() : "";
                }

                if (isReadingArgs)
                {
                    bool hasContinuation = trimmed.EndsWith("^");
                    if (hasContinuation)
                        trimmed = trimmed.Substring(0, trimmed.Length - 1).TrimEnd();

                    if (!string.IsNullOrWhiteSpace(trimmed))
                        arguments += " " + trimmed;

                    if (!hasContinuation)
                        break;
                }
            }

            arguments = arguments.Replace("%BIN%", @"bin\");
            arguments = arguments.Replace("%LISTS%", @"lists\");

            arguments = arguments.Replace("%GameFilterTCP%", "65535");
            arguments = arguments.Replace("%GameFilterUDP%", "65535");

            arguments = arguments.Trim();

            if (string.IsNullOrEmpty(arguments))
                throw new Exception($"Не удалось извлечь параметры запуска из {profileName}.");

            var exePath = Path.Combine(_basePath, $"{AppConstants.ZapretProcessName}.exe");
            var binExePath = Path.Combine(_basePath, "bin", $"{AppConstants.ZapretProcessName}.exe");

            if (!File.Exists(exePath) && File.Exists(binExePath))
                exePath = binExePath;

            if (!File.Exists(exePath))
            {
                var msg = $"Не найден исполняемый файл ядра по пути: {exePath}\n\nПожалуйста, запустите проверку обновлений ядер или переустановите программу.";
                LogMessage?.Invoke($"[Zapret ERR] {msg}");
                System.Windows.Application.Current.Dispatcher.Invoke(() =>
                {
                    System.Windows.MessageBox.Show(msg, "Ошибка запуска", System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Error);
                });
                return;
            }

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

            _process.OutputDataReceived += (s, e) =>
            {
                if (string.IsNullOrEmpty(e.Data)) return;

                string line = e.Data;

                string[] noise = {
        "Loading hostlist", "loading plain text list", "Loaded",
        "user defined desync profile", "github version", "windivert initialized"
    };

                if (noise.Any(n => line.Contains(n, StringComparison.OrdinalIgnoreCase)))
                    return;

                LogMessage?.Invoke($"[Zapret] {line}");
            };

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
            catch (Exception ex)
            {
                Debug.WriteLine($"Ошибка остановки процесса Zapret: {ex.Message}");
            }

            ProcessHelper.KillProcessesByName(AppConstants.ZapretProcessName);
        }

        public bool IsRunning()
            => Process.GetProcessesByName(AppConstants.ZapretProcessName).Length > 0;
    }
}