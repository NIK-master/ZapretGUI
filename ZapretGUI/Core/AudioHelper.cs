using System;
using System.Diagnostics;
using System.IO;
using System.Media;
using System.Threading.Tasks;

namespace ZapretGUI.Core
{
    public static class AudioHelper
    {
        private static readonly SoundPlayer? _clickPlayer;
        private static readonly SoundPlayer? _successPlayer;

        static AudioHelper()
        {
            try
            {
                var baseDir = AppDomain.CurrentDomain.BaseDirectory;
                var clickPath = Path.Combine(baseDir, "Assets", "Sounds", "click.wav");
                var successPath = Path.Combine(baseDir, "Assets", "Sounds", "success.wav");

                if (File.Exists(clickPath))
                {
                    _clickPlayer = new SoundPlayer(clickPath);
                    _clickPlayer.LoadAsync();
                }

                if (File.Exists(successPath))
                {
                    _successPlayer = new SoundPlayer(successPath);
                    _successPlayer.LoadAsync();
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Не удалось загрузить звуки: {ex.Message}");
            }
        }

        public static void PlayClick()
        {
            Task.Run(() =>
            {
                try { _clickPlayer?.Play(); } catch { }
            });
        }

        public static void PlaySuccess()
        {
            Task.Run(() =>
            {
                try { _successPlayer?.Play(); } catch { }
            });
        }
    }
}