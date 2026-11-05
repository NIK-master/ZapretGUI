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

        public static Action<string, string, bool>? WebAlertHandler { get; set; }
        public static Func<string, string, string, bool, Task<bool>>? WebConfirmHandler { get; set; }

        public static string GetAccentHex(bool light = false)
        {
            return (SettingsManager.Current.AccentTheme ?? "green") switch
            {
                "blue" => light ? "#60A5FA" : "#0078D7",
                "purple" => light ? "#A78BFA" : "#7C3AED",
                "amber" => light ? "#FBBF24" : "#D97706",
                "cyan" or "crimson" => light ? "#22D3EE" : "#0891B2",
                _ => light ? "#4CAF50" : "#107C10"
            };
        }

        public static string GetAccentDarkBgHex()
        {
            return (SettingsManager.Current.AccentTheme ?? "green") switch
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
        }

        public static (Icon trayIcon, string icoFilePath) GetOrCreateAppIcon(bool isRunning)
        {
            var theme = (SettingsManager.Current.AccentTheme ?? "green").ToLowerInvariant();
            if (theme == "crimson") theme = "cyan";

            var cacheKey = $"{theme}_{(isRunning ? "on" : "off")}";

            if (_iconCache.TryGetValue(cacheKey, out var cached) && File.Exists(cached.icoFilePath))
                return cached;

            var cacheDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Assets", "Cache", "Icons");
            Directory.CreateDirectory(cacheDir);
            var pngPath = Path.Combine(cacheDir, $"icon_{cacheKey}.png");

            Bitmap bmp;

            if (File.Exists(pngPath) && new FileInfo(pngPath).Length > 100)
            {
                using var fs = new FileStream(pngPath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
                bmp = new Bitmap(fs);
            }
            else
            {
                bmp = RenderIconBitmap(isRunning);
                try
                {
                    bmp.Save(pngPath, ImageFormat.Png);
                }
                catch { }
            }

            using (bmp)
            {
                IntPtr hIcon = bmp.GetHicon();
                try
                {
                    using var tempIcon = Icon.FromHandle(hIcon);
                    var managedTrayIcon = (Icon)tempIcon.Clone();

                    var result = (managedTrayIcon, pngPath);
                    _iconCache[cacheKey] = result;
                    return result;
                }
                finally
                {
                    DestroyIcon(hIcon);
                }
            }
        }

        private static Bitmap RenderIconBitmap(bool isRunning)
        {
            const int size = 64;
            var bmp = new Bitmap(size, size);
            using var g = Graphics.FromImage(bmp);
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = TextRenderingHint.AntiAliasGridFit;
            g.Clear(Color.Transparent);

            var accentColor = GetAccentColor(light: true);
            var borderColor = isRunning ? accentColor : ColorTranslator.FromHtml("#3A3A3A");
            var bgTop = isRunning ? GetAccentDarkBgColor() : ColorTranslator.FromHtml("#18181B");
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