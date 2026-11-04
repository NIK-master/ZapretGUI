using System;
using System.Diagnostics;
using System.IO;
using System.Media;
using System.Windows;
using System.Windows.Media;

namespace ZapretGUI.Core
{
    public static class AudioHelper
    {
        private static readonly string? _clickFilePath;
        private static readonly string? _successFilePath;

        private static readonly MediaPlayer _clickMedia = new MediaPlayer();
        private static readonly MediaPlayer _successMedia = new MediaPlayer();

        static AudioHelper()
        {
            try
            {
                _clickFilePath = ResolveSoundFile("click.wav");
                _successFilePath = ResolveSoundFile("success.wav");
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Ошибка инициализации AudioHelper: {ex.Message}");
            }
        }

        private static string? ResolveSoundFile(string fileName)
        {
            var baseDir = AppDomain.CurrentDomain.BaseDirectory;

            // 1. Ищем файл напрямую в папке Assets\Sounds рядом с .exe
            var localPath = Path.Combine(baseDir, "Assets", "Sounds", fileName);
            if (File.Exists(localPath))
                return localPath;

            // 2. Ищем файл в корне проекта (во время запуска из Visual Studio Debug/Release)
            var devPath = Path.GetFullPath(Path.Combine(baseDir, @"..\..\..\Assets\Sounds", fileName));
            if (File.Exists(devPath))
                return devPath;

            // 3. Если приложение собрано в один .exe — распаковываем встроенный ресурс во временную папку
            var tempDir = Path.Combine(Path.GetTempPath(), "ZapretGUI_Audio_" + AppConstants.AppVersion);
            Directory.CreateDirectory(tempDir);
            var tempFile = Path.Combine(tempDir, fileName);

            try
            {
                var packUri = new Uri($"pack://application:,,,/Assets/Sounds/{fileName}", UriKind.Absolute);
                // ЯВНОЕ УКАЗАНИЕ WPF APPLICATION:
                var streamInfo = System.Windows.Application.GetResourceStream(packUri);
                if (streamInfo?.Stream != null)
                {
                    using var fs = new FileStream(tempFile, FileMode.Create, FileAccess.Write, FileShare.ReadWrite);
                    streamInfo.Stream.CopyTo(fs);
                    return tempFile;
                }
            }
            catch { }

            try
            {
                var asm = System.Reflection.Assembly.GetExecutingAssembly();
                foreach (var resName in asm.GetManifestResourceNames())
                {
                    if (resName.EndsWith(fileName, StringComparison.OrdinalIgnoreCase))
                    {
                        using var stream = asm.GetManifestResourceStream(resName);
                        if (stream != null)
                        {
                            using var fs = new FileStream(tempFile, FileMode.Create, FileAccess.Write, FileShare.ReadWrite);
                            stream.CopyTo(fs);
                            return tempFile;
                        }
                    }
                }
            }
            catch { }

            return File.Exists(tempFile) ? tempFile : null;
        }

        public static void PlayClick()
        {
            if (!SettingsManager.Current.SoundEffectsEnabled) return;
            PlayFile(_clickFilePath, _clickMedia);
        }

        public static void PlaySuccess()
        {
            if (!SettingsManager.Current.SoundEffectsEnabled) return;
            PlayFile(_successFilePath, _successMedia);
        }

        private static void PlayFile(string? path, MediaPlayer player)
        {
            if (string.IsNullOrEmpty(path) || !File.Exists(path))
                return;

            // ЯВНОЕ УКАЗАНИЕ WPF APPLICATION:
            System.Windows.Application.Current?.Dispatcher.InvokeAsync(() =>
            {
                try
                {
                    var uri = new Uri(path, UriKind.Absolute);
                    if (player.Source != uri)
                        player.Open(uri);

                    player.Position = TimeSpan.Zero;
                    player.Play();
                }
                catch
                {
                    // Резервный вариант через системный SoundPlayer
                    try
                    {
                        using var sp = new SoundPlayer(path);
                        sp.Play();
                    }
                    catch { }
                }
            });
        }
    }
}