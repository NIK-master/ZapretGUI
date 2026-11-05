using System;
using System.Diagnostics;
using System.IO;
using System.Media;
using System.Text;
using System.Windows.Media;

namespace ZapretGUI.Core
{
    public static class AudioHelper
    {
        private static readonly string? _clickFilePath;
        private static readonly string? _successFilePath;

        private static readonly MediaPlayer _clickMedia = new MediaPlayer();
        private static readonly MediaPlayer _successMedia = new MediaPlayer();

        private static readonly SoundPlayer? _synthClickPlayer;
        private static readonly SoundPlayer? _synthSuccessPlayer;

        static AudioHelper()
        {
            try
            {
                // Ищем файл на диске/в ресурсах
                _clickFilePath = ResolveSoundFile("click.wav");
                // Если не нашли — генерируем звук прямо в оперативную память (мгновенный отклик)
                if (_clickFilePath == null)
                {
                    _synthClickPlayer = new SoundPlayer(GenerateFallbackWavStream(false));
                    _synthClickPlayer.LoadAsync();
                }

                _successFilePath = ResolveSoundFile("success.wav");
                if (_successFilePath == null)
                {
                    _synthSuccessPlayer = new SoundPlayer(GenerateFallbackWavStream(true));
                    _synthSuccessPlayer.LoadAsync();
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Ошибка инициализации AudioHelper: {ex.Message}");
            }
        }

        private static string? ResolveSoundFile(string fileName)
        {
            var baseDir = AppDomain.CurrentDomain.BaseDirectory;

            // 1. Проверяем папку Assets рядом с программой
            string[] diskCandidates = [
                Path.Combine(baseDir, "Assets", fileName),
                Path.Combine(baseDir, "Assets", "Sounds", fileName),
                Path.GetFullPath(Path.Combine(baseDir, @"..\..\..\Assets", fileName)),
                Path.GetFullPath(Path.Combine(baseDir, @"..\..\..\Assets\Sounds", fileName))
            ];

            foreach (var candidate in diskCandidates)
            {
                if (File.Exists(candidate) && new FileInfo(candidate).Length > 44)
                    return candidate;
            }

            // 2. Проверяем вшитые ресурсы (с защитой от кэша — генерируем уникальное имя Temp-файла)
            var tempFile = Path.Combine(Path.GetTempPath(), $"ZapretGUI_{Guid.NewGuid():N}_{fileName}");
            string[] packUris = [
                $"pack://application:,,,/Assets/{fileName}",
                $"pack://application:,,,/Assets/Sounds/{fileName}"
            ];

            foreach (var uriStr in packUris)
            {
                try
                {
                    var streamInfo = System.Windows.Application.GetResourceStream(new Uri(uriStr, UriKind.Absolute));
                    if (streamInfo?.Stream != null)
                    {
                        using var fs = new FileStream(tempFile, FileMode.Create, FileAccess.Write, FileShare.ReadWrite);
                        streamInfo.Stream.CopyTo(fs);
                        if (fs.Length > 44) return tempFile;
                    }
                }
                catch { }
            }

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
                            if (fs.Length > 44) return tempFile;
                        }
                    }
                }
            }
            catch { }

            // Возвращаем null, чтобы включился синтезатор в ОЗУ
            return null;
        }

        public static void PlayClick()
        {
            if (!SettingsManager.Current.SoundEffectsEnabled) return;

            if (_synthClickPlayer != null)
                System.Threading.Tasks.Task.Run(() => { try { _synthClickPlayer.Play(); } catch { } });
            else
                PlayMedia(_clickFilePath, _clickMedia);
        }

        public static void PlaySuccess()
        {
            if (!SettingsManager.Current.SoundEffectsEnabled) return;

            if (_synthSuccessPlayer != null)
                System.Threading.Tasks.Task.Run(() => { try { _synthSuccessPlayer.Play(); } catch { } });
            else
                PlayMedia(_successFilePath, _successMedia);
        }

        private static void PlayMedia(string? path, MediaPlayer player)
        {
            if (string.IsNullOrEmpty(path)) return;
            System.Windows.Application.Current?.Dispatcher.InvokeAsync(() =>
            {
                try
                {
                    player.Stop();
                    player.Open(new Uri(path, UriKind.Absolute));
                    player.Volume = 0.85;
                    player.Play();
                }
                catch { }
            });
        }

        // Синтезатор звука напрямую в ОЗУ (MemoryStream)
        private static MemoryStream GenerateFallbackWavStream(bool isSuccess)
        {
            const int sampleRate = 44100;
            int durationMs = isSuccess ? 350 : 45; // 45мс для чёткого клика
            int numSamples = (sampleRate * durationMs) / 1000;
            int dataSize = numSamples * 2;

            var ms = new MemoryStream();
            using var bw = new BinaryWriter(ms, Encoding.ASCII, true);

            // Заголовок WAV (PCM 16-bit Mono 44100Hz)
            bw.Write(Encoding.ASCII.GetBytes("RIFF"));
            bw.Write(36 + dataSize);
            bw.Write(Encoding.ASCII.GetBytes("WAVEfmt "));
            bw.Write(16);
            bw.Write((short)1);
            bw.Write((short)1);
            bw.Write(sampleRate);
            bw.Write(sampleRate * 2);
            bw.Write((short)2);
            bw.Write((short)16);
            bw.Write(Encoding.ASCII.GetBytes("data"));
            bw.Write(dataSize);

            // Генерация аудиоволны
            for (int i = 0; i < numSamples; i++)
            {
                double t = (double)i / sampleRate;
                double progress = (double)i / numSamples;
                double sample;

                if (!isSuccess)
                {
                    // Звонкий и сочный UI-клик
                    double env = Math.Exp(-progress * 12.0);
                    double freq = 900.0 * Math.Exp(-progress * 6.0);
                    sample = (Math.Sin(2 * Math.PI * freq * t) + 0.5 * Math.Sin(2 * Math.PI * (freq * 1.5) * t)) * env * 0.95;
                }
                else
                {
                    // Мягкий аккорд успеха
                    double freq = progress < 0.45 ? 523.25 : 783.99;
                    double localP = progress < 0.45 ? (progress / 0.45) : ((progress - 0.45) / 0.55);
                    double env = Math.Sin(Math.Min(1.0, localP * 8.0) * (Math.PI / 2)) * Math.Exp(-localP * 4.5);
                    sample = (Math.Sin(2 * Math.PI * freq * t) + 0.35 * Math.Sin(2 * Math.PI * (freq * 2) * t)) * env * 0.35;
                }

                short pcm = (short)Math.Clamp(sample * short.MaxValue, short.MinValue, short.MaxValue);
                bw.Write(pcm);
            }

            ms.Position = 0; // Сбрасываем позицию потока в начало для чтения плеером
            return ms;
        }
    }
}