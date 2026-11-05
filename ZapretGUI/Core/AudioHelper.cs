using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

namespace ZapretGUI.Core
{
    public static class AudioHelper
    {
        [DllImport("winmm.dll", CharSet = CharSet.Auto)]
        private static extern bool PlaySound(string pszSound, IntPtr hmod, uint fdwSound);

        private const uint SND_FILENAME = 0x00020000;
        private const uint SND_ASYNC = 0x0001;
        private const uint SND_NODEFAULT = 0x0002;

        private static readonly string? _successFilePath;

        static AudioHelper()
        {
            try
            {
                var cacheDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Assets", "Cache", "Sounds");
                if (Directory.Exists(cacheDir))
                {
                    foreach (var oldClick in Directory.GetFiles(cacheDir, "*click*.wav"))
                    {
                        try { File.Delete(oldClick); } catch { }
                    }
                }

                _successFilePath = EnsureSuccessFileCached("success.wav");
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Ошибка инициализации AudioHelper: {ex.Message}");
            }
        }

        private static string? EnsureSuccessFileCached(string fileName)
        {
            var baseDir = AppDomain.CurrentDomain.BaseDirectory;
            var cacheDir = Path.Combine(baseDir, "Assets", "Cache", "Sounds");
            Directory.CreateDirectory(cacheDir);
            var targetCachedPath = Path.Combine(cacheDir, fileName);

            if (File.Exists(targetCachedPath) && new FileInfo(targetCachedPath).Length > 100)
                return targetCachedPath;

            string[] diskCandidates =
            [
                Path.Combine(baseDir, "Assets", "Sounds", fileName),
                Path.Combine(baseDir, "Assets", fileName),
                Path.GetFullPath(Path.Combine(baseDir, @"..\..\..\Assets\Sounds", fileName)),
                Path.GetFullPath(Path.Combine(baseDir, @"..\..\..\Assets", fileName))
            ];

            foreach (var candidate in diskCandidates)
            {
                if (File.Exists(candidate) && new FileInfo(candidate).Length > 100)
                {
                    try
                    {
                        File.Copy(candidate, targetCachedPath, overwrite: true);
                        return targetCachedPath;
                    }
                    catch
                    {
                        return candidate;
                    }
                }
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
                            using var fs = new FileStream(targetCachedPath, FileMode.Create, FileAccess.Write, FileShare.ReadWrite);
                            stream.CopyTo(fs);
                            if (fs.Length > 100)
                                return targetCachedPath;
                        }
                    }
                }
            }
            catch { }

            GenerateSuccessWavToFile(targetCachedPath);
            return targetCachedPath;
        }

        public static void PlayClick()
        {
        }

        public static void PlaySuccess()
        {
            if (!SettingsManager.Current.SoundEffectsEnabled) return;
            if (string.IsNullOrEmpty(_successFilePath) || !File.Exists(_successFilePath)) return;

            try
            {
                PlaySound(_successFilePath, IntPtr.Zero, SND_FILENAME | SND_ASYNC | SND_NODEFAULT);
            }
            catch { }
        }

        private static void GenerateSuccessWavToFile(string filePath)
        {
            const int sampleRate = 44100;
            const int durationMs = 350;
            var numSamples = (sampleRate * durationMs) / 1000;
            var dataSize = numSamples * 2;

            using var fs = new FileStream(filePath, FileMode.Create, FileAccess.Write, FileShare.ReadWrite);
            using var bw = new BinaryWriter(fs, Encoding.ASCII);

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

            for (var i = 0; i < numSamples; i++)
            {
                var t = (double)i / sampleRate;
                var progress = (double)i / numSamples;

                var freq = progress < 0.45 ? 523.25 : 783.99;
                var localP = progress < 0.45 ? (progress / 0.45) : ((progress - 0.45) / 0.55);
                var env = Math.Sin(Math.Min(1.0, localP * 8.0) * (Math.PI / 2)) * Math.Exp(-localP * 4.5);
                var sample = (Math.Sin(2 * Math.PI * freq * t) + 0.35 * Math.Sin(2 * Math.PI * (freq * 2) * t)) * env * 0.35;

                var pcm = (short)Math.Clamp(sample * short.MaxValue, short.MinValue, short.MaxValue);
                bw.Write(pcm);
            }
        }
    }
}