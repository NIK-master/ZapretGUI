using System;
using System.Diagnostics;
using System.Net.NetworkInformation;
using System.Timers;

namespace ZapretGUI.Core
{
    public class NetworkMonitor
    {
        private readonly System.Timers.Timer _networkTimer;
        private readonly Stopwatch _elapsedStopwatch = new Stopwatch();
        private long _lastBytesReceived = 0;
        private long _lastBytesSent = 0;
        private bool _wasNetworkAvailable = true;

        public event Action<double, double>? StatsUpdated;
        public event Action<bool>? StatusChanged;

        public NetworkMonitor()
        {
            _networkTimer = new System.Timers.Timer();
            UpdateIntervalFromSettings();
            _networkTimer.Elapsed += Timer_Tick;

            SettingsManager.SettingsSaved += UpdateIntervalFromSettings;
        }

        public void UpdateIntervalFromSettings()
        {
            int seconds = Math.Max(1, SettingsManager.Current.StatsUpdateInterval);
            _networkTimer.Interval = seconds * 1000;
        }

        public void Start()
        {
            UpdateIntervalFromSettings();
            _elapsedStopwatch.Restart();
            _networkTimer.Start();
        }

        public void Stop()
        {
            _networkTimer.Stop();
            _elapsedStopwatch.Stop();
        }

        private void Timer_Tick(object? sender, ElapsedEventArgs e)
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

            var elapsedSeconds = Math.Max(0.1, _elapsedStopwatch.Elapsed.TotalSeconds);
            _elapsedStopwatch.Restart();

            if (_lastBytesReceived != 0 && _lastBytesSent != 0)
            {
                var diffReceived = Math.Max(0L, currentReceived - _lastBytesReceived);
                var diffSent = Math.Max(0L, currentSent - _lastBytesSent);

                var mbpsReceived = (diffReceived * 8.0) / (1000000.0 * elapsedSeconds);
                var mbpsSent = (diffSent * 8.0) / (1000000.0 * elapsedSeconds);

                StatsUpdated?.Invoke(mbpsReceived, mbpsSent);
            }

            _lastBytesReceived = currentReceived;
            _lastBytesSent = currentSent;
        }
    }
}