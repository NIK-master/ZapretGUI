using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Text;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Media.Imaging;

namespace ZapretGUI.Core
{
    public static class UIHelper
    {
        [DllImport("user32.dll", CharSet = CharSet.Auto)]
        public static extern bool DestroyIcon(IntPtr handle);

        private static readonly BrushConverter _brushConverter = new BrushConverter();

        public static Action<string, string, bool>? WebAlertHandler { get; set; }
        public static Func<string, string, string, bool, Task<bool>>? WebConfirmHandler { get; set; }

        public static SolidColorBrush GetBrushFromHex(string hex)
            => (SolidColorBrush)_brushConverter.ConvertFromString(hex)!;

        public static string GetAccentHex(bool light = false)
        {
            if (SettingsManager.Current.ColorblindMode)
                return light ? "#60A5FA" : "#0078D7";

            return (SettingsManager.Current.AccentTheme ?? "green") switch
            {
                "blue" => light ? "#60A5FA" : "#0078D7",
                "purple" => light ? "#A78BFA" : "#7C3AED",
                "amber" => light ? "#FBBF24" : "#D97706",
                "crimson" => light ? "#FB7185" : "#E11D48",
                _ => light ? "#4CAF50" : "#107C10"
            };
        }

        public static SolidColorBrush GetSuccessBrush()
            => GetBrushFromHex(GetAccentHex(light: false));

        public static SolidColorBrush GetErrorBrush()
            => GetBrushFromHex(SettingsManager.Current.ColorblindMode ? "#FF8C00" : "#D13438");

        public static void ApplyThemeColors()
        {
            var res = System.Windows.Application.Current?.Resources;
            if (res == null)
                return;

            res["BrandSuccessBrush"] = GetSuccessBrush();
            res["BrandErrorBrush"] = GetErrorBrush();
        }

        /// <summary>
        /// Программно рисует фирменную иконку "Z" в памяти без внешних файлов.
        /// Возвращает HICON (для NotifyIcon в трее) и ImageSource (для MainWindow в панели задач).
        /// </summary>
        public static (IntPtr hIcon, ImageSource wpfIcon) CreateDynamicAppIcon(bool isRunning)
        {
            const int size = 64;
            using var bmp = new Bitmap(size, size);
            using (var g = Graphics.FromImage(bmp))
            {
                g.SmoothingMode = SmoothingMode.AntiAlias;
                g.TextRenderingHint = TextRenderingHint.AntiAliasGridFit;
                g.Clear(System.Drawing.Color.Transparent);

                var accentColor = ColorTranslator.FromHtml(GetAccentHex(light: true));
                var borderColor = isRunning ? accentColor : ColorTranslator.FromHtml("#3A3A3A");
                var bgTop = isRunning ? ColorTranslator.FromHtml("#142416") : ColorTranslator.FromHtml("#18181B");
                var bgBottom = ColorTranslator.FromHtml("#0A0A0C");

                using var path = CreateRoundedRectPath(new Rectangle(4, 4, size - 8, size - 8), 14);
                using (var bgBrush = new System.Drawing.Drawing2D.LinearGradientBrush(new Rectangle(0, 0, size, size), bgTop, bgBottom, System.Drawing.Drawing2D.LinearGradientMode.Vertical))
                {
                    g.FillPath(bgBrush, path);
                }

                using (var pen = new System.Drawing.Pen(borderColor, 3.2f))
                {
                    g.DrawPath(pen, path);
                }

                // Рисуем монолитную букву "Z" по центру
                using var font = new Font("Segoe UI", 28f, System.Drawing.FontStyle.Bold, GraphicsUnit.Pixel);
                var textBrush = isRunning ? new SolidBrush(accentColor) : new SolidBrush(System.Drawing.Color.White);
                using (textBrush)
                {
                    var sf = new StringFormat
                    {
                        Alignment = StringAlignment.Center,
                        LineAlignment = StringAlignment.Center
                    };
                    g.DrawString("Z", font, textBrush, new RectangleF(0, 1, size, size), sf);
                }

                // Статусный индикатор в правом нижнем углу
                var dotColor = isRunning
                    ? accentColor
                    : ColorTranslator.FromHtml(SettingsManager.Current.ColorblindMode ? "#FF8C00" : "#D13438");

                using var dotBgBrush = new SolidBrush(ColorTranslator.FromHtml("#0A0A0C"));
                using var dotBrush = new SolidBrush(dotColor);
                g.FillEllipse(dotBgBrush, size - 20, size - 20, 16, 16);
                g.FillEllipse(dotBrush, size - 17, size - 17, 10, 10);
            }

            IntPtr hIcon = bmp.GetHicon();
            var wpfIcon = Imaging.CreateBitmapSourceFromHIcon(
                hIcon,
                Int32Rect.Empty,
                BitmapSizeOptions.FromEmptyOptions());
            wpfIcon.Freeze();

            return (hIcon, wpfIcon);
        }

        private static GraphicsPath CreateRoundedRectPath(Rectangle bounds, int radius)
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