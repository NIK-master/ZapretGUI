using System;
using System.Diagnostics;
using System.IO;

namespace ZapretGUI.Core
{
    public class ZapretManager
    {
        private readonly string _basePath = AppDomain.CurrentDomain.BaseDirectory;

        public void Start(string profileName = "general.bat")
        {
            Stop();

            var batPath = Path.Combine(_basePath, "ZapretFiles", profileName);

            if (!File.Exists(batPath))
                throw new FileNotFoundException($"Файл профиля не найден: {batPath}");

            var psi = new ProcessStartInfo
            {
                FileName = batPath,
                UseShellExecute = false,
                CreateNoWindow = true,
                WorkingDirectory = Path.Combine(_basePath, "ZapretFiles") 
            };

            var process = new Process { StartInfo = psi };
            process.Start();
        }

        public void Stop()
        {
            var processes = Process.GetProcessesByName("winws");

            foreach (var process in processes)
            {
                try
                {
                    process.Kill();
                    process.WaitForExit();
                }
                catch (Exception)
                {

                }
            }
        }

        public bool IsRunning()
        {
            var processes = Process.GetProcessesByName("winws");
            return processes.Length > 0;
        }
    }
}