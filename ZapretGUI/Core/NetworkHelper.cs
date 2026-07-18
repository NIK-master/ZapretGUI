using System.Diagnostics;
using System.Net.Sockets;
using System.Threading.Tasks;

namespace ZapretGUI.Core
{
    public static class NetworkHelper
    {
        public static async Task<long> TcpPingAsync(string host, int port)
        {
            try
            {
                using var client = new TcpClient();
                var stopwatch = new Stopwatch();

                stopwatch.Start();
                var connectTask = client.ConnectAsync(host, port);

                if (await Task.WhenAny(connectTask, Task.Delay(2000)) == connectTask)
                {
                    stopwatch.Stop();
                    return client.Connected ? stopwatch.ElapsedMilliseconds : -1;
                }

                return -1;
            }
            catch
            {
                return -1;
            }
        }
    }
}