using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text.Json;
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
            _basePath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, AppConstants.CoreFilesDirectory);
        }

        private string GetSourceDisplayName(string profileName)
        {
            if (profileName.StartsWith("mod_", StringComparison.OrdinalIgnoreCase))
            {
                var modId = Path.GetFileNameWithoutExtension(profileName).Substring(4);
                var modJsonPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, AppConstants.ModsDirectory, "strategies", modId, "mod.json");
                if (File.Exists(modJsonPath))
                {
                    try
                    {
                        var meta = JsonSerializer.Deserialize<ModMetaData>(File.ReadAllText(modJsonPath), new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                        if (meta != null && !string.IsNullOrWhiteSpace(meta.Name))
                            return $"моде «{meta.Name}» ({profileName})";
                    }
                    catch { }
                }
                return $"моде «{modId}» ({profileName})";
            }
            return $"профиле «{profileName}»";
        }

        public static string ParseAndValidateBatLines(string[] lines, string sourceName, string zapretBasePath, bool checkReferencedFiles = true)
        {
            if (lines == null || lines.Length == 0 || lines.All(string.IsNullOrWhiteSpace))
                throw new Exception($"Ошибка в {sourceName}: Файл стратегии пуст.");

            var arguments = "";
            var isReadingArgs = false;
            var winwsFound = false;
            var winwsStartLine = 0;

            for (var i = 0; i < lines.Length; i++)
            {
                var lineNum = i + 1;
                var rawLine = lines[i];
                var trimmed = rawLine.Trim();

                if (string.IsNullOrWhiteSpace(trimmed) ||
                    trimmed.StartsWith("::") ||
                    trimmed.StartsWith("rem ", StringComparison.OrdinalIgnoreCase) ||
                    trimmed.Equals("rem", StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                if (!isReadingArgs)
                {
                    if (trimmed.Contains(AppConstants.ZapretProcessName, StringComparison.OrdinalIgnoreCase))
                    {
                        isReadingArgs = true;
                        winwsFound = true;
                        winwsStartLine = lineNum;

                        var match = Regex.Match(trimmed, $@"{AppConstants.ZapretProcessName}(?:\.exe)?[""']?\s*(.*)", RegexOptions.IgnoreCase);
                        trimmed = match.Success ? match.Groups[1].Value.Trim() : "";
                    }
                    else
                    {
                        var isStandardBatCmd = Regex.IsMatch(trimmed, @"^(@?echo|chcp|cd|pushd|popd|set|title|cls|color|mode|goto|call|if|for|pause|timeout|:)\b", RegexOptions.IgnoreCase);
                        if (!isStandardBatCmd)
                            throw new Exception($"Синтаксическая ошибка в {sourceName} [Строка {lineNum}]:\nНеизвестная команда «{trimmed}».\nОжидался вызов {AppConstants.ZapretProcessName}.exe или стандартная инструкция Batch.");
                        continue;
                    }
                }

                if (isReadingArgs)
                {
                    var hasContinuation = trimmed.EndsWith("^");
                    var cleanLine = hasContinuation ? trimmed.Substring(0, trimmed.Length - 1).TrimEnd() : trimmed;
                    var quoteCount = cleanLine.Count(c => c == '\"');

                    if (quoteCount % 2 != 0)
                        throw new Exception($"Ошибка синтаксиса в {sourceName} [Строка {lineNum}]:\nНе закрыта кавычка (\") в параметрах:\n«{rawLine.Trim()}»");

                    if (!string.IsNullOrWhiteSpace(cleanLine))
                    {
                        var tokens = Regex.Matches(cleanLine, @"[\""].+?[\""]|[^ ]+")
                                          .Select(m => m.Value.Trim())
                                          .ToList();

                        foreach (var token in tokens)
                        {
                            if (!token.StartsWith("--") && !token.StartsWith("-") && !token.Equals("--new", StringComparison.OrdinalIgnoreCase))
                                throw new Exception($"Ошибка параметра в {sourceName} [Строка {lineNum}]:\nАргумент «{token}» не подходит для Zapret (winws).\nВсе параметры должны начинаться с «--» (например, --filter-tcp=80 или --dpi-desync=fake).\nСтрока: «{rawLine.Trim()}»");

                            if (token.StartsWith("---") || token == "--" || token == "-")
                                throw new Exception($"Ошибка синтаксиса в {sourceName} [Строка {lineNum}]:\nНекорректный формат флага «{token}».\nСтрока: «{rawLine.Trim()}»");

                            if (checkReferencedFiles && Directory.Exists(zapretBasePath))
                            {
                                var fileMatch = Regex.Match(token, @"^--(hostlist|hostlist-exclude|ipset|ipset-exclude|dpi-desync-fake-tls|dpi-desync-fake-quic|dpi-desync-fake-unknown-udp|dpi-desync-split-seqovl-pattern)=(.+)$", RegexOptions.IgnoreCase);
                                if (fileMatch.Success)
                                {
                                    var paramName = fileMatch.Groups[1].Value;
                                    var rawFilePath = fileMatch.Groups[2].Value.Trim('\"', '\'');

                                    if (!rawFilePath.StartsWith("0x", StringComparison.OrdinalIgnoreCase) && !rawFilePath.StartsWith("!"))
                                    {
                                        var resolvedPath = rawFilePath
                                            .Replace("%BIN%", @"bin\")
                                            .Replace("%LISTS%", @"lists\")
                                            .Replace("%~dp0", "");

                                        var fullCheckPath = Path.IsPathRooted(resolvedPath)
                                            ? resolvedPath
                                            : Path.Combine(zapretBasePath, resolvedPath);

                                        if (!File.Exists(fullCheckPath))
                                            throw new Exception($"Ошибка в {sourceName} [Строка {lineNum}]:\nВ параметре «--{paramName}» указан несуществующий файл «{rawFilePath}».\nСтрока: «{rawLine.Trim()}»");
                                    }
                                }
                            }
                        }

                        arguments += " " + cleanLine;
                    }

                    if (!hasContinuation)
                        break;
                }
            }

            if (!winwsFound)
                throw new Exception($"Ошибка структуры в {sourceName}:\nВ батнике не найден вызов ядра «{AppConstants.ZapretProcessName}.exe». Этот скрипт не подходит для Zapret.");

            arguments = arguments.Replace("%BIN%", @"bin\")
                                 .Replace("%LISTS%", @"lists\")
                                 .Replace("%~dp0", "")
                                 .Replace("%GameFilterTCP%", "65535")
                                 .Replace("%GameFilterUDP%", "65535")
                                 .Replace("%GameFilter%", "65535")
                                 .Trim();

            if (string.IsNullOrEmpty(arguments))
                throw new Exception($"Ошибка в {sourceName} [Строка {winwsStartLine}]:\nКоманда «{AppConstants.ZapretProcessName}» вызвана без параметров фильтрации.");

            var unexpandedVar = Regex.Match(arguments, @"%[a-zA-Z0-9_]+%");
            if (unexpandedVar.Success)
                throw new Exception($"Ошибка в {sourceName}:\nОбнаружена неизвестная переменная «{unexpandedVar.Value}», которая не поддерживается в прямом запуске Zapret.");

            return arguments;
        }

        public void Start(string profileName)
        {
            Stop();

            var batFilePath = Path.Combine(_basePath, profileName);
            var sourceName = GetSourceDisplayName(profileName);

            if (!File.Exists(batFilePath))
                throw new FileNotFoundException($"Конфигурационный файл не найден в {sourceName} по пути: {batFilePath}");

            var lines = File.ReadAllLines(batFilePath);
            var arguments = ParseAndValidateBatLines(lines, sourceName, _basePath, checkReferencedFiles: true);

            var exePath = Path.Combine(_basePath, $"{AppConstants.ZapretProcessName}.exe");
            var binExePath = Path.Combine(_basePath, "bin", $"{AppConstants.ZapretProcessName}.exe");

            if (!File.Exists(exePath) && File.Exists(binExePath))
                exePath = binExePath;

            if (!File.Exists(exePath))
                throw new FileNotFoundException($"Не найден исполняемый файл ядра по пути: {exePath}. Запустите проверку обновлений в настройках.");

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

            var errorOutputs = new List<string>();

            _process.OutputDataReceived += (s, e) =>
            {
                if (string.IsNullOrEmpty(e.Data)) 
                    return;

                var line = e.Data;
                var noise = new[]
                {
                    "Loading hostlist", "loading plain text list", "Loaded",
                    "user defined desync profile", "github version", "windivert initialized"
                };

                if (noise.Any(n => line.Contains(n, StringComparison.OrdinalIgnoreCase)))
                    return;

                LogMessage?.Invoke($"[Zapret] {line}");
            };

            _process.ErrorDataReceived += (s, e) =>
            {
                if (!string.IsNullOrEmpty(e.Data))
                {
                    errorOutputs.Add(e.Data);
                    LogMessage?.Invoke($"[Zapret ERR] {e.Data}");
                }
            };

            _process.Start();
            _process.BeginOutputReadLine();
            _process.BeginErrorReadLine();

            if (_process.WaitForExit(350))
            {
                var errDetails = errorOutputs.Count > 0
                    ? string.Join(" | ", errorOutputs)
                    : $"Код завершения: {_process.ExitCode}";

                throw new Exception($"Ядро Zapret отвергло конфигурацию в {sourceName}!\nПричина от движка winws: {errDetails}");
            }
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