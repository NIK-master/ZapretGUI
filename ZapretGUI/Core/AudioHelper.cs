using System;
using System.Diagnostics;
using System.IO;
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
                // Загружаем звук клика прямо из памяти .exe
                var clickStreamInfo = System.Windows.Application.GetResourceStream(new Uri("pack://application:,,,/Assets/Sounds/click.wav"));
                if (clickStreamInfo != null)
                {
                    var ms = new MemoryStream();
                    clickStreamInfo.Stream.CopyTo(ms);
                    ms.Position = 0;
                    _clickPlayer = new SoundPlayer(ms);
                    _clickPlayer.LoadAsync();
                }

                // Загружаем звук успеха прямо из памяти .exe
                var successStreamInfo = System.Windows.Application.GetResourceStream(new Uri("pack://application:,,,/Assets/Sounds/success.wav"));
                if (successStreamInfo != null)
                {
                    var ms = new MemoryStream();
                    successStreamInfo.Stream.CopyTo(ms);
                    ms.Position = 0;
                    _successPlayer = new SoundPlayer(ms);
                    _successPlayer.LoadAsync();
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Не удалось загрузить звуки: {ex.Message}");
            }
        }

        public static void PlayClick() => Task.Run(() => { try { _clickPlayer?.Play(); } catch { } });
        public static void PlaySuccess() => Task.Run(() => { try { _successPlayer?.Play(); } catch { } });
    }
}