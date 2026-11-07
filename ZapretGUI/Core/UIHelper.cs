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
        private static readonly string[] AllThemes = ["green", "blue", "purple", "amber", "cyan"];

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
                "cyan" or "crimson" => light ? "#22D3EE" : "#0891B2",
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
                "cyan" or "crimson" => "#0D262B",
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
                if (currentTheme == "crimson") currentTheme = "cyan";

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
            if (theme == "crimson") theme = "cyan";

            var cacheKey = $"{theme}_{(isRunning ? "on" : "off")}";

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
            g.TextRenderingHint = TextRenderingHint.AntiAliasGridFit;
            g.Clear(Color.Transparent);

            var accentColor = ColorTranslator.FromHtml(GetAccentHex(light: true, theme));
            var borderColor = isRunning ? accentColor : ColorTranslator.FromHtml("#3A3A3A");
            var bgTop = isRunning ? ColorTranslator.FromHtml(GetAccentDarkBgHex(theme)) : ColorTranslator.FromHtml("#18181B");
            var bgBottom = ColorTranslator.FromHtml("#0A0A0C");

            using var path = CreateRoundedRectPath(new Rectangle(4, 4, size - 8, size - 8), 14);
            using (var bgBrush = new LinearGradientBrush(new Rectangle(0, 0, size, size), bgTop, bgBottom, LinearGradientMode.Vertical))
            {
                g.FillPath(bgBrush, path);
            }

            using (var pen = new Pen(borderColor, 3.2f))
            {
                g.DrawPath(pen, path);
            }

            using var font = new Font("Segoe UI", 28f, FontStyle.Bold, GraphicsUnit.Pixel);
            var textBrush = isRunning ? new SolidBrush(accentColor) : new SolidBrush(Color.White);
            using (textBrush)
            {
                var sf = new StringFormat
                {
                    Alignment = StringAlignment.Center,
                    LineAlignment = StringAlignment.Center
                };
                g.DrawString("Z", font, textBrush, new RectangleF(0, 1, size, size), sf);
            }

            var dotColor = isRunning ? accentColor : GetErrorColor();
            using var dotBgBrush = new SolidBrush(ColorTranslator.FromHtml("#0A0A0C"));
            using var dotBrush = new SolidBrush(dotColor);
            g.FillEllipse(dotBgBrush, size - 20, size - 20, 16, 16);
            g.FillEllipse(dotBrush, size - 17, size - 17, 10, 10);

            return bmp;
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