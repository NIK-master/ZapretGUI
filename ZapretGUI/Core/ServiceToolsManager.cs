using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;

namespace ZapretGUI.Core
{
    public static class ServiceToolsManager
    {
        private static readonly HttpClient _http = new HttpClient { Timeout = TimeSpan.FromSeconds(15) };

        private const string HostsMarkerStart = "# >>> ZAPRET FOR ADHD HOSTS START >>>";
        private const string HostsMarkerEnd = "# <<< ZAPRET FOR ADHD HOSTS END <<<";

        static ServiceToolsManager()
        {
            _http.DefaultRequestHeaders.UserAgent.ParseAdd(AppConstants.GithubUserAgent);
        }

        private static string ZapretBasePath => Path.Combine(AppDomain.CurrentDomain.BaseDirectory, AppConstants.CoreFilesDirectory);
        private static string ListsPath => Path.Combine(ZapretBasePath, "lists");
        private static string UtilsPath => Path.Combine(ZapretBasePath, "utils");

        public static bool ValidatePortRange(string? input, out string cleanRange)
        {
            cleanRange = "";
            if (string.IsNullOrWhiteSpace(input)) return false;

            string trimmed = input.Replace(" ", "");
            var parts = trimmed.Split(',', StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length == 0) return false;

            foreach (var part in parts)
            {
                if (!Regex.IsMatch(part, @"^[1-9][0-9]*(?:-[1-9][0-9]*)?$"))
                    return false;

                var bounds = part.Split('-');
                if (!int.TryParse(bounds[0], out int start) || start < 1 || start > 65535)
                    return false;

                if (bounds.Length == 2)
                {
                    if (!int.TryParse(bounds[1], out int end) || end < 1 || end > 65535 || start > end)
                        return false;
                }
            }

            cleanRange = trimmed;
            return true;
        }

        public static (string gameFilter, string tcpFilter, string udpFilter) GetGameFilterSubstitutions()
        {
            string mode = (SettingsManager.Current.GameFilterMode ?? "disabled").ToLowerInvariant();
            string tcpRange = ValidatePortRange(SettingsManager.Current.GameFilterTcpRange, out var validTcp) ? validTcp : "1024-65535";
            string udpRange = ValidatePortRange(SettingsManager.Current.GameFilterUdpRange, out var validUdp) ? validUdp : "1024-65535";

            return mode switch
            {
                "all" => (tcpRange, tcpRange, udpRange),
                "tcp" => (tcpRange, tcpRange, "12"),
                "udp" => (udpRange, "12", udpRange),
                _ => ("12", "12", "12")
            };
        }

        public static string GetGameFilterDisplayStatus()
        {
            string mode = (SettingsManager.Current.GameFilterMode ?? "disabled").ToLowerInvariant();
            string tcp = SettingsManager.Current.GameFilterTcpRange;
            string udp = SettingsManager.Current.GameFilterUdpRange;

            return mode switch
            {
                "all" => $"TCP и UDP ({tcp})",
                "tcp" => $"Только TCP ({tcp})",
                "udp" => $"Только UDP ({udp})",
                _ => "Отключен"
            };
        }

        public static void SyncGameFilterFile()
        {
            try
            {
                if (!Directory.Exists(UtilsPath))
                    Directory.CreateDirectory(UtilsPath);

                string flagFile = Path.Combine(UtilsPath, "game_filter.enabled");
                string mode = (SettingsManager.Current.GameFilterMode ?? "disabled").ToLowerInvariant();

                if (mode == "disabled")
                {
                    if (File.Exists(flagFile))
                        File.Delete(flagFile);
                }
                else
                {
                    var lines = new[]
                    {
                        $"mode={mode}",
                        $"tcp={SettingsManager.Current.GameFilterTcpRange}",
                        $"udp={SettingsManager.Current.GameFilterUdpRange}"
                    };
                    File.WriteAllLines(flagFile, lines);
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Ошибка синхронизации game_filter.enabled: {ex.Message}");
            }
        }

        public static (string mode, int count, string statusText) GetIpSetStatus()
        {
            try
            {
                if (!Directory.Exists(ListsPath)) Directory.CreateDirectory(ListsPath);
                string listFile = Path.Combine(ListsPath, "ipset-all.txt");

                if (!File.Exists(listFile))
                    return ("none", 0, "Файл не найден");

                var lines = File.ReadAllLines(listFile)
                                .Where(l => !string.IsNullOrWhiteSpace(l) && !l.TrimStart().StartsWith("#"))
                                .Select(l => l.Trim())
                                .ToList();

                if (lines.Count == 0)
                    return ("any", 0, "Весь трафик (Any • 0 IP)");

                if (lines.Count == 1 && lines[0] == "203.0.113.113/32")
                    return ("none", 0, "Отключен (Заглушка)");

                return ("loaded", lines.Count, $"Активен ({lines.Count} подсетей)");
            }
            catch
            {
                return ("none", 0, "Ошибка чтения");
            }
        }

        public static void SetIpSetMode(string targetMode)
        {
            if (!Directory.Exists(ListsPath)) Directory.CreateDirectory(ListsPath);
            string listFile = Path.Combine(ListsPath, "ipset-all.txt");
            string backupFile = Path.Combine(ListsPath, "ipset-all.txt.backup");

            var (currentMode, _, _) = GetIpSetStatus();

            if (currentMode == "loaded" && File.Exists(listFile))
            {
                File.Copy(listFile, backupFile, overwrite: true);
            }

            if (targetMode == "none")
            {
                File.WriteAllText(listFile, "203.0.113.113/32\r\n");
            }
            else if (targetMode == "any")
            {
                File.WriteAllText(listFile, "");
            }
            else if (targetMode == "loaded")
            {
                if (File.Exists(backupFile))
                {
                    File.Copy(backupFile, listFile, overwrite: true);
                }
                else if (currentMode != "loaded")
                {
                    throw new FileNotFoundException("Резервная копия базы IPSet не найдена. Нажмите кнопку «Обновить IP», чтобы скачать свежий список.");
                }
            }
        }

        public static async Task<int> UpdateIpSetFromWebAsync()
        {
            if (!Directory.Exists(ListsPath)) Directory.CreateDirectory(ListsPath);
            string listFile = Path.Combine(ListsPath, "ipset-all.txt");
            string backupFile = Path.Combine(ListsPath, "ipset-all.txt.backup");

            string content = await _http.GetStringAsync(AppConstants.FlowsealIpSetUrl);
            if (string.IsNullOrWhiteSpace(content))
                throw new Exception("Сервер вернул пустой список IPSet.");

            await File.WriteAllTextAsync(listFile, content, Encoding.UTF8);
            await File.WriteAllTextAsync(backupFile, content, Encoding.UTF8);

            int count = content.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries)
                               .Count(l => !string.IsNullOrWhiteSpace(l) && !l.TrimStart().StartsWith("#"));
            return count;
        }

        private static string SystemHostsPath => Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), @"drivers\etc\hosts");

        public static (bool isApplied, int lineCount) GetHostsStatus()
        {
            try
            {
                if (!File.Exists(SystemHostsPath)) return (false, 0);
                var text = File.ReadAllText(SystemHostsPath);

                int startIdx = text.IndexOf(HostsMarkerStart, StringComparison.OrdinalIgnoreCase);
                int endIdx = text.IndexOf(HostsMarkerEnd, StringComparison.OrdinalIgnoreCase);

                if (startIdx >= 0 && endIdx > startIdx)
                {
                    string block = text.Substring(startIdx + HostsMarkerStart.Length, endIdx - (startIdx + HostsMarkerStart.Length));
                    int count = block.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries)
                                     .Count(l => !string.IsNullOrWhiteSpace(l) && !l.TrimStart().StartsWith("#"));
                    return (true, count);
                }
                return (false, 0);
            }
            catch
            {
                return (false, 0);
            }
        }

        public static async Task<int> UpdateSystemHostsAsync(int sourceIndex)
        {
            var urls = new List<string>();
            if (sourceIndex == 0) 
                urls.Add(AppConstants.FlowsealHostsUrl);
            else if (sourceIndex == 1 || sourceIndex == 3) 
                urls.Add(AppConstants.V3nillaHostsUrl);
            else
            {
                urls.Add(AppConstants.FlowsealHostsUrl);
                urls.Add(AppConstants.V3nillaHostsUrl);
            }

            var includeAdBlockZeroIps = (sourceIndex == 3);

            var collectedLines = new List<string>();
            var seenEntries = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            foreach (var url in urls)
            {
                var raw = await _http.GetStringAsync($"{url}?t={Guid.NewGuid():N}");
                foreach (var line in raw.Split(new[] { "\r\n", "\n" }, StringSplitOptions.None))
                {
                    var trimmed = line.Trim();
                    if (string.IsNullOrWhiteSpace(trimmed)) continue;

                    if (!includeAdBlockZeroIps && trimmed.Contains("Блокировка рекламы, трекеров", StringComparison.OrdinalIgnoreCase))
                        break;

                    if (trimmed.StartsWith("#"))
                    {
                        collectedLines.Add(trimmed);
                        continue;
                    }

                    if (trimmed.Contains("localhost", StringComparison.OrdinalIgnoreCase))
                        continue;

                    if (!includeAdBlockZeroIps && trimmed.StartsWith("0.0.0.0"))
                        continue;

                    var parts = trimmed.Split(new[] { ' ', '\t' }, StringSplitOptions.RemoveEmptyEntries);
                    if (parts.Length >= 2)
                    {
                        var normalizedEntry = $"{parts[0]} {parts[1]}";
                        if (seenEntries.Add(normalizedEntry))
                            collectedLines.Add(normalizedEntry);
                    }
                }
            }

            var activeDomainsCount = collectedLines.Count(l => !l.StartsWith("#"));
            if (activeDomainsCount == 0)
                throw new Exception("Не удалось получить ни одной записи из выбранного источника.");

            var backupPath = SystemHostsPath + ".zapret.bak";
            if (File.Exists(SystemHostsPath) && !File.Exists(backupPath))
                try { File.Copy(SystemHostsPath, backupPath, overwrite: false); } catch { }

            var existingContent = File.Exists(SystemHostsPath) ? await File.ReadAllTextAsync(SystemHostsPath) : "";
            var cleanBase = RemoveZapretBlock(existingContent).TrimEnd();

            var sb = new StringBuilder();
            if (!string.IsNullOrEmpty(cleanBase))
            {
                sb.AppendLine(cleanBase);
                sb.AppendLine();
            }

            sb.AppendLine(HostsMarkerStart);
            sb.AppendLine($"# Обновлено: {DateTime.Now:dd.MM.yyyy HH:mm} (Активных записей: {activeDomainsCount})");
            foreach (var l in collectedLines)
                sb.AppendLine(l);
            sb.AppendLine(HostsMarkerEnd);

            await File.WriteAllTextAsync(SystemHostsPath, sb.ToString(), new UTF8Encoding(false));
            FlushDnsCache();

            return activeDomainsCount;
        }

        public static void ClearZapretHosts()
        {
            if (!File.Exists(SystemHostsPath)) return;

            var existingContent = File.ReadAllText(SystemHostsPath);
            var cleanBase = RemoveZapretBlock(existingContent).TrimEnd() + "\r\n";

            File.WriteAllText(SystemHostsPath, cleanBase, new UTF8Encoding(false));
            FlushDnsCache();
        }

        private static string RemoveZapretBlock(string content)
        {
            var startIdx = content.IndexOf(HostsMarkerStart, StringComparison.OrdinalIgnoreCase);
            var endIdx = content.IndexOf(HostsMarkerEnd, StringComparison.OrdinalIgnoreCase);

            if (startIdx >= 0 && endIdx > startIdx)
            {
                var removeLength = (endIdx + HostsMarkerEnd.Length) - startIdx;
                return content.Remove(startIdx, removeLength);
            }
            return content;
        }

        private static void FlushDnsCache()
        {
            try
            {
                Process.Start(new ProcessStartInfo
                {
                    FileName = "ipconfig.exe",
                    Arguments = "/flushdns",
                    CreateNoWindow = true,
                    UseShellExecute = false
                })?.WaitForExit(3000);
            }
            catch { }
        }
    }
}