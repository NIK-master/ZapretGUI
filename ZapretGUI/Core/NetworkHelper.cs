using System;
using System.Diagnostics;
using System.Net.Sockets;
using System.Threading;
using System.Threading.Tasks;

namespace ZapretGUI.Core
{
    public static class NetworkHelper
    {
        public static async Task<long> TcpPingAsync(string host, int port, int timeoutMs = 2000)
        {
            try
            {
                using var client = new TcpClient();
                using var cts = new CancellationTokenSource(timeoutMs);
                var stopwatch = Stopwatch.StartNew();

                await client.ConnectAsync(host, port, cts.Token);
                stopwatch.Stop();

                return client.Connected ? stopwatch.ElapsedMilliseconds : -1;
            }
            catch
            {
                return -1;
            }
        }
    }
}