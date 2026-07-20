using System.Collections.Generic;

namespace ZapretGUI.Core
{
    public enum BlockType { None, Throttling, IpBlock, SniBlock, DnsSpoof, MediaThrottle }

    public class DcResult
    {
        public int DcId { get; set; }
        public string Ip { get; set; } = "";
        public int Port { get; set; }
        public bool Ok { get; set; }
        public double? LatencyMs { get; set; }
        public string Error { get; set; } = "";

        // --- Свойства для привязки интерфейса (Data Binding) ---
        public string Title => $"DC {DcId} :{Port}";

        public string PingText => Ok && LatencyMs.HasValue ? $"{LatencyMs.Value:0} мс" : "Ошибка";

        public string StatusColorBrush
        {
            get
            {
                if (!Ok || !LatencyMs.HasValue)
                    return "#D13438"; // Красный

                if (LatencyMs.Value < 120)
                    return "#107C10"; // Зеленый

                return "#FF8C00"; // Оранжевый
            }
        }
    }

    public class PingResult
    {
        public string Host { get; set; } = "";
        public bool Ok { get; set; }
        public double? LatencyMs { get; set; }
        public double PacketLoss { get; set; } = 100;
        public string Error { get; set; } = "";
    }

    public class DnsResult
    {
        public string Domain { get; set; } = "";
        public List<string> SystemIps { get; set; } = new();
        public List<string> DohIps { get; set; } = new();
        public bool Spoofed { get; set; }
        public string Error { get; set; } = "";
    }

    public class DpiResult
    {
        public string SniTelegram { get; set; } = "unknown";
        public string SniNeutral { get; set; } = "unknown";
        public bool DpiDetected { get; set; }
        public string Error { get; set; } = "";
    }

    public class UdpResult
    {
        public List<int> TestedPorts { get; set; } = new();
        public List<int> OpenPorts { get; set; } = new();
        public bool Blocked { get; set; } = true;
        public string Error { get; set; } = "";
    }

    public class MediaThrottleResult
    {
        public double SpeedKbps { get; set; }
        public bool Throttled { get; set; }
        public string Error { get; set; } = "";
        public const double SlowThreshold = 200.0;
    }

    public class AppStatus
    {
        public bool TelegramRunning { get; set; }
        public string TelegramProcName { get; set; } = "";
        public bool DiscordRunning { get; set; }
        public string DiscordProcName { get; set; } = "";
        public bool ZapretRunning { get; set; }
        public string ZapretProcName { get; set; } = "";
        public bool TgWsProxyRunning { get; set; }
        public string TgWsProxyProcName { get; set; } = "";
    }

    public class DiscordPingResult
    {
        public string Label { get; set; } = "";
        public string Ip { get; set; } = "";
        public bool Ok { get; set; }
        public double? LatencyMs { get; set; }
        public string Error { get; set; } = "";
    }

    public class DiagReport
    {
        public List<DcResult> DcResults { get; set; } = new();
        public List<PingResult> PingResults { get; set; } = new();
        public DnsResult? DnsResult { get; set; }
        public DpiResult? DpiResult { get; set; }
        public UdpResult? UdpResult { get; set; }
        public MediaThrottleResult? MediaResult { get; set; }
        public AppStatus? AppStatus { get; set; }
        public List<BlockType> BlockTypes { get; set; } = new();
        public List<string> Recommendations { get; set; } = new();
        public List<DiscordPingResult> DiscordPing { get; set; } = new();
    }
}