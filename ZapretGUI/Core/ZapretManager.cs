using System;
using System.Diagnostics;
using System.IO;

namespace ZapretGUI.Core
{
    public class ZapretManager
    {
        private readonly string _basePath;

        public ZapretManager()
        {
            _basePath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "ZapretFiles");
        }

        public void Start(string profileName)
        {
            Stop();

            var batFilePath = Path.Combine(_basePath, profileName);

            if (!File.Exists(batFilePath))
                throw new FileNotFoundException($"Профиль {profileName} не найден по пути: {batFilePath}");

            var batContent = File.ReadAllText(batFilePath);
            batContent = batContent.Replace("start \"zapret: %~n0\" /min ", "");

            var tempBatPath = Path.Combine(_basePath, "invisible_run.bat");
            File.WriteAllText(tempBatPath, batContent);

            var startInfo = new ProcessStartInfo
            {
                FileName = "cmd.exe",
                Arguments = $"/c \"{tempBatPath}\"",
                UseShellExecute = false,
                CreateNoWindow = true,
                WindowStyle = ProcessWindowStyle.Hidden,
                WorkingDirectory = _basePath
            };

            Process.Start(startInfo);
        }

        public void Stop()
        {
            ProcessHelper.KillProcessesByName("winws");
        }

        public bool IsRunning() 
            => Process.GetProcessesByName("winws").Length > 0;
    }
}