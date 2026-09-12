using System;
using System.Threading.Tasks;

namespace ZapretGUI.Core
{
    public class BypassController
    {
        public static BypassController Current { get; } = new BypassController();

        public ZapretManager Zapret { get; } = new ZapretManager();
        public TgProxyManager TgProxy { get; } = new TgProxyManager();
        public NetworkMonitor NetMonitor { get; } = new NetworkMonitor();
        public ZapretScanner Scanner { get; } = new ZapretScanner();

        public bool IsRunning => Zapret.IsRunning() || TgProxy.IsRunning();

        public event Action<string>? OnLog;

        private BypassController()
        {
            Zapret.LogMessage += msg => OnLog?.Invoke(msg);
            TgProxy.LogMessage += msg => OnLog?.Invoke(msg);
            Scanner.LogMessage += msg => OnLog?.Invoke(msg);
        }

        public async Task StartServicesAsync(string profileName, bool useZapret, bool useTgProxy)
        {
            if (useZapret)
            {
                OnLog?.Invoke($"[Zapret] Подготовка профиля {profileName}...");
                await Task.Delay(400);
                OnLog?.Invoke($"[Zapret] Запуск службы...");
                Zapret.Start(profileName);
            }

            if (useTgProxy)
            {
                OnLog?.Invoke("[TgWsProxy] Настройка маршрутов...");
                await Task.Delay(300);
                OnLog?.Invoke("[TgWsProxy] Запуск прокси...");
                TgProxy.Start();
            }
        }

        public void StopServices()
        {
            Zapret.Stop();
            TgProxy.Stop();
            OnLog?.Invoke("🛑 Все модули остановлены.");
        }

        public async Task RestartServicesAsync(string profileName)
        {
            StopServices();
            await Task.Delay(1000);

            if (SettingsManager.Current.ZapretEnabled)
                Zapret.Start(profileName);

            if (SettingsManager.Current.TgProxyEnabled)
                TgProxy.Start();

            OnLog?.Invoke("✅ Службы успешно перезапущены.");
        }

        public async Task<long> CheckPingAsync()
        {
            var hostToPing = AppConstants.AwsPingHost;
            var portToPing = AppConstants.AwsPingPort;

            var fullUrl = SettingsManager.Current.PingUrl;
            if (!string.IsNullOrWhiteSpace(fullUrl))
            {
                if (Uri.TryCreate(fullUrl, UriKind.Absolute, out Uri? uri))
                {
                    hostToPing = uri.Host;
                    portToPing = uri.Port > 0 ? uri.Port : 443;
                }
                else
                {
                    hostToPing = fullUrl;
                }
            }

            return await NetworkHelper.TcpPingAsync(hostToPing, portToPing);
        }
    }
}