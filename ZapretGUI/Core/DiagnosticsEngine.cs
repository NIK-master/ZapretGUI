using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.NetworkInformation;
using System.Net.Security;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace ZapretGUI.Core
{
    public static class DiagnosticsEngine
    {
        private static readonly (int dcId, string ip)[] TelegramDcs =
        [
            (1, "149.154.175.50"),
            (2, "149.154.167.51"),
            (3, "149.154.175.100"),
            (4, "149.154.167.91"),
            (5, "91.108.56.130"),
        ];

        private static readonly int[] TelegramPorts = [443, 80, 5222];
        private static readonly string[] PingHosts = ["1.1.1.1", "8.8.8.8", "77.88.8.8"];
        private const string DiscordHost = "162.159.130.234";
        private static readonly int[] DiscordUdpPorts = Enumerable.Range(50000, 11).ToArray();

        private static readonly (string label, string ip)[] DiscordPingHosts =
        [
            ("Gateway", "162.159.130.234"),
            ("Media", "162.159.129.235"),
            ("API", "162.159.128.233"),
        ];

        private static readonly Dictionary<string, string[]> AppSignatures = new()
        {
            ["telegram"] = ["telegram", "tgram", "gram", "aygram"],
            ["discord"] = ["discord", "cord"],
            ["zapret"] = [AppConstants.ZapretProcessName, "zapret", "winws"],
            ["tgwsproxy"] = [AppConstants.TgProxyProcessName.ToLower(), "tg_ws_proxy", "flowseal"],
        };

        public static async Task<(bool ok, double latencyMs, string error)> TcpConnectAsync(string ip, int port, double timeoutSec = 3.0)
        {
            var sw = Stopwatch.StartNew();
            try
            {
                using var tcp = new TcpClient();
                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(timeoutSec));
                await tcp.ConnectAsync(ip, port, cts.Token);
                return (true, sw.Elapsed.TotalMilliseconds, "");
            }
            catch (OperationCanceledException) { return (false, 0, "timeout"); }
            catch (SocketException e) when (e.SocketErrorCode == SocketError.ConnectionRefused) { return (false, 0, "refused"); }
            catch (Exception e) { return (false, 0, e.Message); }
        }

        private static async Task<string> TlsHandshakeAsync(string ip, string sni, double timeoutSec = 4.0)
        {
            try
            {
                using var tcp = new TcpClient();
                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(timeoutSec));
                await tcp.ConnectAsync(ip, 443, cts.Token);

                using var ssl = new SslStream(tcp.GetStream(), false, (_, _, _, _) => true);
                await ssl.AuthenticateAsClientAsync(new SslClientAuthenticationOptions
                {
                    TargetHost = sni,
                    RemoteCertificateValidationCallback = (_, _, _, _) => true,
                }, cts.Token);
                return "ok";
            }
            catch (OperationCanceledException) { return "timeout"; }
            catch (Exception e)
            {
                var msg = e.Message.ToLower();
                if (msg.Contains("connection reset") || msg.Contains("forcibly closed") || msg.Contains("eof"))
                    return "rst";
                return $"error:{e.Message}";
            }
        }

        private static async Task<List<string>> DnsResolveAsync(string domain, string? server = null)
        {
            if (server is null)
            {
                try
                {
                    var entry = await Dns.GetHostEntryAsync(domain);
                    return entry.AddressList.Select(a => a.ToString()).Distinct().ToList();
                }
                catch { return []; }
            }

            try
            {
                var txId = (ushort)Random.Shared.Next(0, 65536);
                var query = BuildDnsQuery(domain, txId);
                using var udp = new UdpClient();
                udp.Client.ReceiveTimeout = 3000;
                var ep = new IPEndPoint(IPAddress.Parse(server), 53);
                await udp.SendAsync(query, ep);
                var result = await udp.ReceiveAsync();
                return ParseDnsResponse(result.Buffer);
            }
            catch { return []; }
        }

        private static byte[] BuildDnsQuery(string domain, ushort txId)
        {
            var buf = new List<byte>
            {
                (byte)(txId >> 8), (byte)(txId & 0xff),
                0x01, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
            };
            foreach (var part in domain.Split('.'))
            {
                buf.Add((byte)part.Length);
                buf.AddRange(Encoding.ASCII.GetBytes(part));
            }
            buf.Add(0);
            buf.AddRange(new byte[] { 0x00, 0x01, 0x00, 0x01 });
            return buf.ToArray();
        }

        private static List<string> ParseDnsResponse(byte[] data)
        {
            var ips = new List<string>();
            try
            {
                int ancount = (data[6] << 8) | data[7];
                if (ancount == 0) return ips;
                int i = 12;
                while (i < data.Length && data[i] != 0) i += data[i] + 1;
                i += 5;
                for (int a = 0; a < ancount && i + 10 < data.Length; a++)
                {
                    i += 2;
                    int rtype = (data[i] << 8) | data[i + 1];
                    int rdlen = (data[i + 8] << 8) | data[i + 9];
                    i += 10;
                    if (rtype == 1 && rdlen == 4 && i + 4 <= data.Length)
                        ips.Add($"{data[i]}.{data[i + 1]}.{data[i + 2]}.{data[i + 3]}");
                    i += rdlen;
                }
            }
            catch { }
            return ips;
        }

        private static async Task<(bool ok, double latencyMs)> PingOnceAsync(string host)
        {
            try
            {
                using var ping = new Ping();
                var reply = await ping.SendPingAsync(host, 2000);
                if (reply.Status == IPStatus.Success)
                    return (true, reply.RoundtripTime);
            }
            catch { }
            return (false, 0);
        }

        private static async Task<bool> UdpProbeAsync(string host, int port, int timeoutMs = 2000)
        {
            try
            {
                using var udp = new UdpClient();
                await udp.SendAsync(new byte[4], new IPEndPoint(IPAddress.Parse(host), port));
                using var cts = new CancellationTokenSource(timeoutMs);
                try
                {
                    await udp.ReceiveAsync(cts.Token);
                    return true;
                }
                catch (OperationCanceledException)
                {
                    return false;
                }
                catch (SocketException e) when (e.SocketErrorCode == SocketError.ConnectionReset)
                {
                    return true;
                }
                catch { return false; }
            }
            catch { return false; }
        }

        public static AppStatus CheckAppStatus()
        {
            var status = new AppStatus();
            try
            {
                var names = Process.GetProcesses()
                    .Select(p => { try { return p.ProcessName.ToLower(); } catch { return ""; } })
                    .Where(n => n.Length > 0).ToList();

                string Match(string key) =>
                    names.FirstOrDefault(n => AppSignatures[key].Any(s => n.Contains(s))) ?? "";

                var tg = Match("telegram"); if (tg != "") { status.TelegramRunning = true; status.TelegramProcName = tg; }
                var dc = Match("discord"); if (dc != "") { status.DiscordRunning = true; status.DiscordProcName = dc; }
                var zp = Match("zapret"); if (zp != "") { status.ZapretRunning = true; status.ZapretProcName = zp; }
                var tw = Match("tgwsproxy"); if (tw != "") { status.TgWsProxyRunning = true; status.TgWsProxyProcName = tw; }
            }
            catch { }
            return status;
        }

        public static async Task<List<DcResult>> CheckTelegramDcsAsync(Action<double>? progress = null)
        {
            int done = 0;
            int total = TelegramDcs.Length * TelegramPorts.Length;
            var tasks = (from dc in TelegramDcs
                         from port in TelegramPorts
                         select Task.Run(async () =>
                         {
                             var (ok, lat, err) = await TcpConnectAsync(dc.ip, port, 4.0);
                             Interlocked.Increment(ref done);
                             progress?.Invoke((double)done / total);
                             return new DcResult
                             {
                                 DcId = dc.dcId,
                                 Ip = dc.ip,
                                 Port = port,
                                 Ok = ok,
                                 LatencyMs = ok ? lat : null,
                                 Error = err
                             };
                         })).ToList();

            var results = await Task.WhenAll(tasks);
            return [.. results.OrderBy(r => r.DcId).ThenBy(r => r.Port)];
        }

        public static async Task<List<PingResult>> CheckPingAsync(Action<double>? progress = null)
        {
            var results = new List<PingResult>();
            for (int i = 0; i < PingHosts.Length; i++)
            {
                var (ok, rtt) = await PingOnceAsync(PingHosts[i]);
                results.Add(new PingResult
                {
                    Host = PingHosts[i],
                    Ok = ok,
                    LatencyMs = ok ? rtt : null,
                    PacketLoss = ok ? 0 : 100
                });
                progress?.Invoke((double)(i + 1) / PingHosts.Length);
            }
            return results;
        }

        public static async Task<DnsResult> CheckDnsAsync(string domain = "telegram.org", Action<double>? progress = null)
        {
            var result = new DnsResult { Domain = domain };
            progress?.Invoke(0.1);
            result.SystemIps = await DnsResolveAsync(domain);
            progress?.Invoke(0.5);
            result.DohIps = await DnsResolveAsync(domain, "1.1.1.1");
            progress?.Invoke(0.9);
            if (result.SystemIps.Count > 0 && result.DohIps.Count > 0)
            {
                if (!result.SystemIps.Intersect(result.DohIps).Any())
                    result.Spoofed = true;
            }
            else if (result.SystemIps.Count == 0) result.Spoofed = true;
            else if (result.DohIps.Count == 0) result.Error = "1.1.1.1 недоступен";
            progress?.Invoke(1.0);
            return result;
        }

        public static async Task<DpiResult> CheckDpiAsync(Action<double>? progress = null)
        {
            var result = new DpiResult();
            const string targetIp = "149.154.167.51";
            progress?.Invoke(0.1);
            result.SniTelegram = await TlsHandshakeAsync(targetIp, "telegram.org", 5.0);
            progress?.Invoke(0.5);
            result.SniNeutral = await TlsHandshakeAsync(targetIp, "example.com", 5.0);
            progress?.Invoke(0.9);
            if (result.SniTelegram is "rst" or "timeout" && result.SniNeutral != "rst")
                result.DpiDetected = true;
            progress?.Invoke(1.0);
            return result;
        }

        public static async Task<MediaThrottleResult> CheckMediaThrottleAsync(Action<double>? progress = null)
        {
            var result = new MediaThrottleResult();
            string[] urls =
            [
                "https://cdn1.telegram.org/file/811140210/1/iQITMsUeOrg/0c6eeff1e0b33e29c0",
                "https://cdn4.telegram.org/file/811140210/1/iQITMsUeOrg/0c6eeff1e0b33e29c0",
                "https://web.telegram.org/a/runtime.js",
            ];
            progress?.Invoke(0.1);

            using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(12) };
            http.DefaultRequestHeaders.UserAgent.ParseAdd(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");

            foreach (var url in urls)
            {
                try
                {
                    var sw = Stopwatch.StartNew();
                    var data = await http.GetByteArrayAsync(url);
                    sw.Stop();
                    double sizeKb = data.Length / 1024.0;
                    if (sizeKb < 5) continue;
                    double elapsed = Math.Max(sw.Elapsed.TotalSeconds, 0.001);
                    result.SpeedKbps = sizeKb / elapsed * 8;
                    result.Throttled = result.SpeedKbps < MediaThrottleResult.SlowThreshold;
                    progress?.Invoke(1.0);
                    return result;
                }
                catch (Exception e) { result.Error = e.Message; }
            }
            progress?.Invoke(1.0);
            return result;
        }

        public static async Task<UdpResult> CheckDiscordUdpAsync(Action<double>? progress = null)
        {
            var result = new UdpResult();
            var tested = DiscordUdpPorts.Take(5).ToList();
            result.TestedPorts = tested;
            int done = 0;

            var tasks = tested.Select(async port =>
            {
                bool open = await UdpProbeAsync(DiscordHost, port);
                Interlocked.Increment(ref done);
                progress?.Invoke((double)done / tested.Count);
                return (port, open);
            });

            var results = await Task.WhenAll(tasks);
            result.OpenPorts = results.Where(r => r.open).Select(r => r.port).ToList();
            result.Blocked = result.OpenPorts.Count == 0;
            return result;
        }

        public static async Task<List<DiscordPingResult>> CheckDiscordPingAsync(Action<double>? progress = null)
        {
            var results = new List<DiscordPingResult>();
            for (int i = 0; i < DiscordPingHosts.Length; i++)
            {
                var (label, ip) = DiscordPingHosts[i];
                var (ok, lat, err) = await TcpConnectAsync(ip, 443, 4.0);
                results.Add(new DiscordPingResult
                {
                    Label = label,
                    Ip = ip,
                    Ok = ok,
                    LatencyMs = ok ? lat : null,
                    Error = err
                });
                progress?.Invoke((double)(i + 1) / DiscordPingHosts.Length);
            }
            return results;
        }

        public static List<BlockType> ClassifyBlocks(DiagReport r)
        {
            var blocks = new HashSet<BlockType>();
            var dcOk = r.DcResults.Where(x => x.Ok).ToList();
            var pingOk = r.PingResults.Where(x => x.Ok).ToList();

            if (r.DnsResult?.Spoofed == true) blocks.Add(BlockType.DnsSpoof);
            if (r.DpiResult?.DpiDetected == true) blocks.Add(BlockType.SniBlock);

            if (dcOk.Count == 0 && pingOk.Count > 0 && !blocks.Contains(BlockType.SniBlock))
                blocks.Add(BlockType.IpBlock);

            if (dcOk.Count > 0 && pingOk.Count > 0)
            {
                var withLat = dcOk.Where(x => x.LatencyMs.HasValue).ToList();
                if (withLat.Count > 0)
                {
                    double avgDc = withLat.Average(x => x.LatencyMs!.Value);
                    var pingWithLat = pingOk.Where(x => x.LatencyMs.HasValue).ToList();
                    if (pingWithLat.Count > 0)
                    {
                        double avgPing = pingWithLat.Average(x => x.LatencyMs!.Value);
                        if ((avgDc > 150 && avgDc > avgPing * 3) || avgDc > 250)
                            blocks.Add(BlockType.Throttling);
                    }
                }
            }

            if (r.MediaResult?.Throttled == true) blocks.Add(BlockType.MediaThrottle);
            return [.. blocks];
        }

        public static List<string> MakeRecommendations(DiagReport r)
        {
            var recs = new List<string>();
            var blocks = r.BlockTypes;
            var app = r.AppStatus ?? new AppStatus();
            bool bypass = app.ZapretRunning;

            string BypassList()
            {
                var t = new List<string>();
                if (app.ZapretRunning) t.Add($"Zapret ({app.ZapretProcName})");
                return string.Join(", ", t);
            }

            if (blocks.Contains(BlockType.MediaThrottle))
            {
                string spd = r.MediaResult?.SpeedKbps > 0 ? $"{r.MediaResult.SpeedKbps:F0} kbps" : "не измерена";
                recs.Add($"⚠️  ТСПУ-ЗАМЕДЛЕНИЕ МЕДИА (РКН)\n    Измеренная скорость: {spd} (норма > 200 kbps)\n    Файлы и медиа грузятся медленно. Используйте Zapret или VPN.");
            }

            if (blocks.Contains(BlockType.SniBlock))
                recs.Add("🛡  SNI-БЛОКИРОВКА (DPI обрывает TLS по SNI)\n    Проверьте, что Zapret запущен с нужным профилем.");

            if (blocks.Contains(BlockType.IpBlock))
                recs.Add("📡  IP-БЛОКИРОВКА (все DC недоступны)\n    Требуется VPN или WARP.");

            if (blocks.Contains(BlockType.DnsSpoof))
                recs.Add("🔵  DNS-СПУФИНГ\n    Включите зашифрованный DNS в Windows (1.1.1.1).");

            if (r.UdpResult?.Blocked == true)
                recs.Add(bypass
                    ? $"🎮  Discord UDP: заблокирован, НО {BypassList()} активен, Discord работает! ✓"
                    : "🎮  Discord UDP заблокирован. Звонки не работают без Zapret.");
            else
                recs.Add("🎮  Discord UDP: доступен ✓, голос работает без дополнительных настроек.");

            return recs;
        }

        public static (string emoji, string title, string detail, string color) HumanVerdict(DiagReport r)
        {
            var blocks = new HashSet<BlockType>(r.BlockTypes);
            var app = r.AppStatus;
            int dcOk = r.DcResults.Count(x => x.Ok);
            int dcTot = r.DcResults.Count;
            bool pingOk = r.PingResults.Any(p => p.Ok);
            bool bypass = app != null && app.ZapretRunning;

            if (app?.TgWsProxyRunning == true)
                return ("🟢", "tg-ws-proxy активен", "Telegram работает через прокси локально.", "#107C10");

            if (!pingOk && dcOk == 0)
                return ("🔴", "Интернета нет", "Ни один сервер не отвечает.", "#D13438");

            if (blocks.Contains(BlockType.SniBlock))
                return bypass
                    ? ("🟢", "Telegram работает (обходчик активен)", "DPI обнаружен, но обходчик запущен.", "#107C10")
                    : ("🔴", "Telegram заблокирован (DPI)", "Нужен Zapret.", "#D13438");

            if (blocks.Contains(BlockType.IpBlock))
                return bypass
                    ? ("🟢", "Telegram работает", "IP заблокированы, но обходчик компенсирует.", "#107C10")
                    : ("🔴", "Серверы заблокированы", "Нужен VPN.", "#D13438");

            if (dcOk >= Math.Max(dcTot / 2, 1))
                return ("🟢", "Telegram работает нормально", "Серверы отвечают быстро.", "#107C10");

            return ("🟡", "Ситуация неоднозначная", "Проблемы со связью.", "#FF8C00");
        }

        public static (string emoji, string title, string detail, string color) DiscordVerdict(DiagReport r)
        {
            var app = r.AppStatus;
            bool bypass = app != null && app.ZapretRunning;
            if (r.UdpResult?.Blocked == true)
                return bypass
                    ? ("🟢", "Discord работает (обходчик активен)", "UDP заблокирован, но обходчик работает.", "#107C10")
                    : ("🔴", "Голосовые звонки могут лагать", "UDP-порты Discord заблокированы. Включи Zapret.", "#D13438");
            return ("🟢", "Discord работает нормально", "Все нужные порты доступны.", "#107C10");
        }

        public static async Task<DiagReport> RunFullDiagnosticsAsync(Action<double, string>? progress = null)
        {
            void Step(double r, string lbl) => progress?.Invoke(r, lbl);
            var report = new DiagReport();

            Step(0.00, "Определение процессов...");
            report.AppStatus = await Task.Run(CheckAppStatus);

            Step(0.10, "Проверка DC Telegram...");
            report.DcResults = await CheckTelegramDcsAsync(p => Step(0.10 + p * 0.20, "DC Telegram..."));

            Step(0.30, "DNS и DPI...");
            report.DnsResult = await CheckDnsAsync(progress: p => Step(0.30 + p * 0.10, "DNS..."));
            report.DpiResult = await CheckDpiAsync(p => Step(0.40 + p * 0.15, "DPI/SNI..."));

            Step(0.55, "Скорость медиа (ТСПУ)...");
            report.MediaResult = await CheckMediaThrottleAsync(p => Step(0.55 + p * 0.15, "Медиа..."));

            Step(0.70, "UDP порты Discord...");
            report.UdpResult = await CheckDiscordUdpAsync(p => Step(0.70 + p * 0.20, "UDP..."));

            Step(0.90, "Анализ данных...");
            report.BlockTypes = ClassifyBlocks(report);
            report.Recommendations = MakeRecommendations(report);

            Step(1.0, "Готово ✓");
            return report;
        }
    }
}