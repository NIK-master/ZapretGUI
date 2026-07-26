using System;
using System.Diagnostics;
using System.Media;
using System.Threading.Tasks;

namespace ZapretGUI.Core
{
    public static class AudioHelper
    {
        private static SoundPlayer? _clickPlayer;
        private static SoundPlayer? _successPlayer;

        static AudioHelper()
        {
            try
            {
                _clickPlayer = new SoundPlayer("Assets/Sounds/click.wav");
                _successPlayer = new SoundPlayer("Assets/Sounds/success.wav");

                _clickPlayer.LoadAsync();
                _successPlayer.LoadAsync();
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