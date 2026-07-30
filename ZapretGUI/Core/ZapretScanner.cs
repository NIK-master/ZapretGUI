using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Threading;

namespace ZapretGUI.Core
{
    public class ZapretScanner
    {
        [DllImport("user32.dll")]
        private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
        private const int SW_HIDE = 0;

        private Process? _scanProcess;
        private CancellationTokenSource? _scanCts;
        private List<string> _topConfigs = new List<string>();

        public event Action<string>? LogMessage;
        public event Action<List<string>>? ScanCompleted;
        public event Action<Exception>? ScanFailed;

        public bool IsScanning => _scanProcess != null && !_scanProcess.HasExited;

        public async Task StartScanAsync()
        {
            if (IsScanning) return;

            _topConfigs.Clear();
            _scanCts = new CancellationTokenSource();

            var hideTimer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(100) };
            hideTimer.Tick += (s, ev) =>
            {
                foreach (var p in Process.GetProcessesByName(AppConstants.ZapretProcessName))
                {
                    if (p.MainWindowHandle != IntPtr.Zero)
                        ShowWindow(p.MainWindowHandle, SW_HIDE);
                }
            };
            hideTimer.Start();

            try
            {
                var scriptPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, AppConstants.CoreFilesDirectory, "utils", "test zapret.ps1");

                if (!File.Exists(scriptPath))
                    throw new FileNotFoundException("Скрипт тестирования не найден по пути: " + scriptPath);

                var startInfo = new ProcessStartInfo
                {
                    FileName = "powershell.exe",
                    Arguments = $"-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File \"{scriptPath}\"",
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    RedirectStandardInput = true,
                    RedirectStandardError = true,
                    CreateNoWindow = true,
                    StandardOutputEncoding = System.Text.Encoding.UTF8
                };

                _scanProcess = new Process { StartInfo = startInfo };
                _scanProcess.Start();

                await _scanProcess.StandardInput.WriteLineAsync("1");
                await _scanProcess.StandardInput.WriteLineAsync("1");
                _scanProcess.StandardInput.Close();

                await Task.Run(async () =>
                {
                    while (!_scanProcess.StandardOutput.EndOfStream)
                    {
                        if (_scanCts.Token.IsCancellationRequested) break;

                        var line = await _scanProcess.StandardOutput.ReadLineAsync();
                        if (string.IsNullOrWhiteSpace(line)) continue;

                        line = Regex.Replace(line, @"\x1B\[[0-9;]*[a-zA-Z]", "");

                        string? simpleLog = SimplifyLogLine(line);
                        if (simpleLog != null)
                            LogMessage?.Invoke($"[Auto] {simpleLog}");
                    }

                    if (!_scanProcess.HasExited)
                        _scanProcess.WaitForExit();

                }, _scanCts.Token);

                if (_scanCts.Token.IsCancellationRequested)
                    LogMessage?.Invoke("🛑 Сканирование было прервано пользователем.");
                else
                    ScanCompleted?.Invoke(new List<string>(_topConfigs));
            }
            catch (Exception ex)
            {
                ScanFailed?.Invoke(ex);
            }
            finally
            {
                hideTimer.Stop();
            }
        }

        public void CancelScan()
        {
            _scanCts?.Cancel();
            try
            {
                if (_scanProcess != null && !_scanProcess.HasExited)
                    _scanProcess.Kill();
            }
            catch { }

            ProcessHelper.KillProcessesByName("powershell");
            ProcessHelper.KillProcessesByName(AppConstants.ZapretProcessName);
        }

        private string? SimplifyLogLine(string line)
        {
            if (string.IsNullOrWhiteSpace(line))
                return null;

            var progressMatch = Regex.Match(line, @"\[(\d+/\d+)\]\s+([a-zA-Z0-9_\-\(\)\s]+\.bat)", RegexOptions.IgnoreCase);
            if (progressMatch.Success)
            {
                var progress = progressMatch.Groups[1].Value;
                var configName = progressMatch.Groups[2].Value.Trim();
                return $"[{progress}] 🔍 Анализ профиля: {configName}...";
            }

            if (line.Contains("=== ANALYTICS ==="))
                return "📊 Сводка результатов тестирования:";

            var statsMatch = Regex.Match(line, @"([a-zA-Z0-9_\-\(\)\s]+\.bat)\s*:\s*(?:HTTP\s*)?OK:\s*(\d+).*?(?:ERR|FAIL):\s*(\d+)", RegexOptions.IgnoreCase);
            if (statsMatch.Success)
            {
                var batName = statsMatch.Groups[1].Value.Trim();
                var okCount = statsMatch.Groups[2].Value;
                var errCount = statsMatch.Groups[3].Value;

                if (errCount == "0" && okCount != "0")
                {
                    if (!_topConfigs.Contains(batName)) _topConfigs.Add(batName);
                    return $"      ✨ {batName} -> Работает идеально (Успешно: {okCount})";
                }
                else
                {
                    return $"      ⚠️ {batName} -> Есть блокировки (Успешно: {okCount}, Ошибок: {errCount})";
                }
            }

            if (line.Contains("Best config:"))
            {
                var bestMatch = Regex.Match(line, @"Best config:\s*([a-zA-Z0-9_\-\(\)\s]+\.bat)", RegexOptions.IgnoreCase);
                if (bestMatch.Success)
                {
                    var best = bestMatch.Groups[1].Value.Trim();
                    if (_topConfigs.Contains(best)) _topConfigs.Remove(best);
                    _topConfigs.Insert(0, best);
                }
                return null;
            }

            return null;
        }
    }
}