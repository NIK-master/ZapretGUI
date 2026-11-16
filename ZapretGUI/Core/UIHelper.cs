using System;
using System.Collections.Concurrent;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Drawing.Text;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading.Tasks;

namespace ZapretGUI.Core
{
    public static class UIHelper
    {
        [DllImport("user32.dll", CharSet = CharSet.Auto)]
        public static extern bool DestroyIcon(IntPtr handle);

        private static readonly ConcurrentDictionary<string, (Icon trayIcon, string icoFilePath)> _iconCache = new();
        private static readonly string[] AllThemes = ["green", "blue", "purple", "amber", "pink"];

        public static Action<string, string, bool>? WebAlertHandler { get; set; }
        public static Func<string, string, string, bool, Task<bool>>? WebConfirmHandler { get; set; }

        public static string GetAccentHex(bool light = false, string? themeOverride = null)
        {
            var t = (themeOverride ?? SettingsManager.Current.AccentTheme ?? "green").ToLowerInvariant();
            return t switch
            {
                "blue" => light ? "#60A5FA" : "#0078D7",
                "purple" => light ? "#A78BFA" : "#7C3AED",
                "amber" => light ? "#FBBF24" : "#D97706",
                "pink" or "cyan" or "crimson" => light ? "#F472B6" : "#DB2777",
                _ => light ? "#4CAF50" : "#107C10"
            };
        }

        public static string GetAccentDarkBgHex(string? themeOverride = null)
        {
            var t = (themeOverride ?? SettingsManager.Current.AccentTheme ?? "green").ToLowerInvariant();
            return t switch
            {
                "blue" => "#102033",
                "purple" => "#1E1433",
                "amber" => "#2B1D0E",
                "pink" or "cyan" or "crimson" => "#2D1222",
                _ => "#142616"
            };
        }

        public static Color GetAccentColor(bool light = false)
            => ColorTranslator.FromHtml(GetAccentHex(light));

        public static Color GetAccentDarkBgColor()
            => ColorTranslator.FromHtml(GetAccentDarkBgHex());

        public static Color GetErrorColor()
            => ColorTranslator.FromHtml("#D13438");

        public static void ApplyThemeColors()
        {
            // При старте или смене темы гарантируем наличие обеих иконок (ON и OFF)
            WarmupAllIcons();
        }

        public static void WarmupAllIcons()
        {
            try
            {
                var currentTheme = (SettingsManager.Current.AccentTheme ?? "green").ToLowerInvariant();
                if (currentTheme is "crimson" or "cyan") currentTheme = "pink";

                // Сначала мгновенно готовим обе версии (ON и OFF) для текущей темы
                GetOrCreateAppIcon(false, currentTheme);
                GetOrCreateAppIcon(true, currentTheme);

                // Остальные темы догенерируем в фоне, если их ещё нет на диске
                Task.Run(() =>
                {
                    foreach (var theme in AllThemes)
                    {
                        try
                        {
                            GetOrCreateAppIcon(false, theme);
                            GetOrCreateAppIcon(true, theme);
                        }
                        catch { }
                    }
                });
            }
            catch { }
        }

        public static (Icon trayIcon, string icoFilePath) GetOrCreateAppIcon(bool isRunning, string? themeOverride = null)
        {
            var theme = (themeOverride ?? SettingsManager.Current.AccentTheme ?? "green").ToLowerInvariant();
            if (theme is "crimson" or "cyan") theme = "pink";

            // Новый ключ v2 гарантирует замену старой иконки с буквой Z на Пиксельного Зэппи
            var cacheKey = $"zappy8bit_v2_{theme}_{(isRunning ? "on" : "off")}";

            if (_iconCache.TryGetValue(cacheKey, out var cached) && File.Exists(cached.icoFilePath))
                return cached;

            var cacheDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Assets", "Cache", "Icons");
            Directory.CreateDirectory(cacheDir);
            var icoPath = Path.Combine(cacheDir, $"icon_{cacheKey}.ico");

            if (!File.Exists(icoPath) || new FileInfo(icoPath).Length < 100)
            {
                using var bmp = RenderIconBitmap(isRunning, theme);
                SaveBitmapAsTrueIco(bmp, icoPath);
            }

            var managedTrayIcon = new Icon(icoPath, 64, 64);
            var result = (managedTrayIcon, icoPath);
            _iconCache[cacheKey] = result;
            return result;
        }

        // Записывает настоящий бинарный .ICO файл с PNG-слоем внутри (понимается Windows Taskbar, Alt+Tab и Photino)
        private static void SaveBitmapAsTrueIco(Bitmap bmp, string icoPath)
        {
            using var pngMs = new MemoryStream();
            bmp.Save(pngMs, ImageFormat.Png);
            byte[] pngBytes = pngMs.ToArray();

            using var fs = new FileStream(icoPath, FileMode.Create, FileAccess.Write, FileShare.ReadWrite);
            using var bw = new BinaryWriter(fs);

            // ICONDIR header (6 байт)
            bw.Write((short)0);   // Reserved
            bw.Write((short)1);   // Type: 1 = ICO
            bw.Write((short)1);   // Count: 1 image

            // ICONDIRENTRY (16 байт)
            bw.Write((byte)bmp.Width);
            bw.Write((byte)bmp.Height);
            bw.Write((byte)0);    // Palette
            bw.Write((byte)0);    // Reserved
            bw.Write((short)1);   // Color planes
            bw.Write((short)32);  // Bits per pixel
            bw.Write(pngBytes.Length); // Size of image data
            bw.Write(22);         // Offset of image data (6 + 16 = 22)

            // PNG payload
            bw.Write(pngBytes);
        }

        private static Bitmap RenderIconBitmap(bool isRunning, string theme)
        {
            const int size = 64;
            var bmp = new Bitmap(size, size);
            using var g = Graphics.FromImage(bmp);
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.Clear(Color.Transparent);

            var accentLight = ColorTranslator.FromHtml(GetAccentHex(light: true, theme));
            var accentBase = ColorTranslator.FromHtml(GetAccentHex(light: false, theme));

            // 1. Фон: тёмный неоновый щит со скруглёнными углами
            var bgTop = isRunning
                ? ColorTranslator.FromHtml(GetAccentDarkBgHex(theme))
                : ColorTranslator.FromHtml("#16161A");
            var bgBottom = ColorTranslator.FromHtml("#08080B");

            var shieldRect = new Rectangle(4, 4, size - 8, size - 8);
            using var shieldPath = CreateRoundedRectPath(shieldRect, 14);

            using (var bgBrush = new LinearGradientBrush(new Rectangle(0, 0, size, size), bgTop, bgBottom, LinearGradientMode.Vertical))
            {
                g.FillPath(bgBrush, shieldPath);
            }

            // 2. Свечение и контур щита
            if (isRunning)
            {
                using (var outerGlowPen = new Pen(Color.FromArgb(65, accentLight), 6.5f))
                {
                    g.DrawPath(outerGlowPen, shieldPath);
                }
                using (var borderPen = new Pen(accentLight, 2.8f))
                {
                    g.DrawPath(borderPen, shieldPath);
                }
            }
            else
            {
                using (var borderPen = new Pen(ColorTranslator.FromHtml("#2E2E36"), 2.5f))
                {
                    g.DrawPath(borderPen, shieldPath);
                }
            }

            // 3. Отрисовка пиксельной головы котика Зэппи (сетка 16x16, шаг 3px -> 48x48, отступ 8px)
            DrawPixelZappyHead(g, offsetX: 8, offsetY: 8, pixelScale: 3, isRunning, accentLight, accentBase);

            return bmp;
        }

        public static void DrawPixelZappyHead(
            Graphics g,
            float offsetX,
            float offsetY,
            float pixelScale,
            bool isRunning,
            Color accentLight,
            Color accentBase)
        {
            var oldSmooth = g.SmoothingMode;
            var oldOffset = g.PixelOffsetMode;
            g.SmoothingMode = SmoothingMode.None;
            g.PixelOffsetMode = PixelOffsetMode.Half;

            // Матрица 16x16:
            // '.' — прозрачно
            // 'O' — контур силуэта головы и острых ушек
            // 'B' — тёмный мех головы
            // 'I' — внутренняя часть ушек
            // 'N' — пиксельный носик
            string[] catHeadGrid =
            [
                "..O..........O..",
                ".OOO........OOO.",
                ".OIBO......OBIO.",
                ".OIIBOOOOOOBIIO.",
                ".OBBBBBBBBBBBBO.",
                "OBBBBBBBBBBBBBBO",
                "OBBBBBBBBBBBBBBO",
                "OBBBBBBBBBBBBBBO",
                "OBBBBBBBBBBBBBBO",
                "OBBBBBBBBBBBBBBO",
                "OBBBBBBBBBBBBBBO",
                "OBBBBBBBBBBBBBBO",
                ".OBBBBBNNBBBBBO.",
                "..OBBBBBBBBBBO..",
                "...OOOOOOOOOO...",
                "................"
            ];

            Color bodyFill = isRunning
                ? ColorTranslator.FromHtml("#0D0D12")
                : ColorTranslator.FromHtml("#121217");

            Color outlineColor = isRunning
                ? Color.FromArgb(200, accentBase.R, accentBase.G, accentBase.B)
                : ColorTranslator.FromHtml("#2C2C35");

            Color earInnerColor = isRunning
                ? Color.FromArgb(115, accentLight.R, accentLight.G, accentLight.B)
                : ColorTranslator.FromHtml("#1F1F27");

            Color noseColor = isRunning
                ? Color.FromArgb(190, accentLight.R, accentLight.G, accentLight.B)
                : ColorTranslator.FromHtml("#4A4A55");

            using var bodyBrush = new SolidBrush(bodyFill);
            using var outlineBrush = new SolidBrush(outlineColor);
            using var earBrush = new SolidBrush(earInnerColor);
            using var noseBrush = new SolidBrush(noseColor);

            for (int y = 0; y < 16; y++)
            {
                string row = catHeadGrid[y];
                for (int x = 0; x < 16; x++)
                {
                    char c = row[x];
                    if (c == '.') continue;

                    Brush brush = c switch
                    {
                        'O' => outlineBrush,
                        'I' => earBrush,
                        'N' => noseBrush,
                        _ => bodyBrush
                    };

                    g.FillRectangle(brush, offsetX + x * pixelScale, offsetY + y * pixelScale, pixelScale, pixelScale);
                }
            }

            if (isRunning)
            {
                // СВЕТЯЩИЕСЯ ОТКРЫТЫЕ 8-БИТНЫЕ ГЛАЗКИ (когда обход включён)
                // Мягкий неоновый ореол вокруг каждого глаза
                using (var eyeGlowBrush = new SolidBrush(Color.FromArgb(95, accentLight)))
                {
                    g.FillRectangle(eyeGlowBrush, offsetX + 2 * pixelScale, offsetY + 7 * pixelScale, 5 * pixelScale, 4 * pixelScale);
                    g.FillRectangle(eyeGlowBrush, offsetX + 9 * pixelScale, offsetY + 7 * pixelScale, 5 * pixelScale, 4 * pixelScale);
                }

                // Основной пиксельный блок глаза (3x2 пикселя сетки) цветом выбранной темы
                using (var eyeMainBrush = new SolidBrush(accentLight))
                {
                    g.FillRectangle(eyeMainBrush, offsetX + 3 * pixelScale, offsetY + 8 * pixelScale, 3 * pixelScale, 2 * pixelScale);
                    g.FillRectangle(eyeMainBrush, offsetX + 10 * pixelScale, offsetY + 8 * pixelScale, 3 * pixelScale, 2 * pixelScale);
                }

                // Яркий белый 8-битный блик в уголке каждого глаза
                using (var sparkBrush = new SolidBrush(Color.FromArgb(245, 255, 255, 255)))
                {
                    g.FillRectangle(sparkBrush, offsetX + 3 * pixelScale, offsetY + 8 * pixelScale, 1 * pixelScale, 1 * pixelScale);
                    g.FillRectangle(sparkBrush, offsetX + 10 * pixelScale, offsetY + 8 * pixelScale, 1 * pixelScale, 1 * pixelScale);
                }
            }
            else
            {
                // СПЯЩИЕ ГЛАЗКИ-ПОЛОСКИ «- -» (когда обход выключен)
                using var sleepEyeBrush = new SolidBrush(ColorTranslator.FromHtml("#8A8A98"));
                using var sleepShadowBrush = new SolidBrush(ColorTranslator.FromHtml("#25252E"));

                // Чуть заметная тень под ресничками и сами узкие полоски (3x1 пикселя сетки)
                g.FillRectangle(sleepShadowBrush, offsetX + 3 * pixelScale, offsetY + 10 * pixelScale, 3 * pixelScale, 1 * pixelScale);
                g.FillRectangle(sleepShadowBrush, offsetX + 10 * pixelScale, offsetY + 10 * pixelScale, 3 * pixelScale, 1 * pixelScale);

                g.FillRectangle(sleepEyeBrush, offsetX + 3 * pixelScale, offsetY + 9 * pixelScale, 3 * pixelScale, 1 * pixelScale);
                g.FillRectangle(sleepEyeBrush, offsetX + 10 * pixelScale, offsetY + 9 * pixelScale, 3 * pixelScale, 1 * pixelScale);
            }

            g.PixelOffsetMode = oldOffset;
            g.SmoothingMode = oldSmooth;
        }

        public static GraphicsPath CreateRoundedRectPath(Rectangle bounds, int radius)
        {
            int d = radius * 2;
            var path = new GraphicsPath();
            path.AddArc(bounds.X, bounds.Y, d, d, 180, 90);
            path.AddArc(bounds.Right - d, bounds.Y, d, d, 270, 90);
            path.AddArc(bounds.Right - d, bounds.Bottom - d, d, d, 0, 90);
            path.AddArc(bounds.X, bounds.Bottom - d, d, d, 90, 90);
            path.CloseFigure();
            return path;
        }

        public static void ShowAlert(string title, string message, bool isError = false)
        {
            WebAlertHandler?.Invoke(title, message, isError);
        }

        public static Task<bool> ShowConfirmAsync(string title, string message, string confirmText = "Да", bool isDanger = false)
        {
            if (WebConfirmHandler != null)
                return WebConfirmHandler.Invoke(title, message, confirmText, isDanger);

            return Task.FromResult(false);
        }
    }
}