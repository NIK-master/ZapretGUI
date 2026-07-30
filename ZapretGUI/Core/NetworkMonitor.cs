using System;
using System.Net.NetworkInformation;
using System.Windows.Threading;

namespace ZapretGUI.Core
{
    public class NetworkMonitor
    {
        private readonly DispatcherTimer _networkTimer;
        private long _lastBytesReceived = 0;
        private long _lastBytesSent = 0;
        private bool _wasNetworkAvailable = true;

        public event Action<double, double>? StatsUpdated;
        public event Action<bool>? StatusChanged;

        public NetworkMonitor()
        {
            _networkTimer = new DispatcherTimer
            {
                Interval = TimeSpan.FromSeconds(1)
            };
            _networkTimer.Tick += Timer_Tick;
        }

        public void Start() => _networkTimer.Start();

        public void Stop() => _networkTimer.Stop();

        private void Timer_Tick(object? sender, EventArgs e)
        {
            var isAvailable = NetworkInterface.GetIsNetworkAvailable();

            if (isAvailable != _wasNetworkAvailable)
            {
                _wasNetworkAvailable = isAvailable;
                StatusChanged?.Invoke(isAvailable);
            }

            var currentReceived = 0L;
            var currentSent = 0L;

            var interfaces = NetworkInterface.GetAllNetworkInterfaces();
            foreach (var netInterface in interfaces)
            {
                if (netInterface.OperationalStatus == OperationalStatus.Up &&
                    netInterface.NetworkInterfaceType != NetworkInterfaceType.Loopback)
                {
                    var stats = netInterface.GetIPv4Statistics();
                    currentReceived += stats.BytesReceived;
                    currentSent += stats.BytesSent;
                }
            }

            if (_lastBytesReceived != 0 && _lastBytesSent != 0)
            {
                var diffReceived = currentReceived - _lastBytesReceived;
                var diffSent = currentSent - _lastBytesSent;

                var mbpsReceived = (diffReceived * 8.0) / 1000000.0;
                var mbpsSent = (diffSent * 8.0) / 1000000.0;

                StatsUpdated?.Invoke(mbpsReceived, mbpsSent);
            }

            _lastBytesReceived = currentReceived;
            _lastBytesSent = currentSent;
        }
    }
}