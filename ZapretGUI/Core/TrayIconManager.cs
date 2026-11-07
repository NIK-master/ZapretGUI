using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace ZapretGUI.Core
{
    public class TrayIconManager : IDisposable
    {
        private NotifyIcon? _notifyIcon;
        private CustomTrayPopupForm? _trayPopup;
        private readonly MainWindow _mainWindow;

        public TrayIconManager(MainWindow mainWindow)
        {
            _mainWindow = mainWindow;
            SetupTrayIcon();
        }

        private void SetupTrayIcon()
        {
            _trayPopup = new CustomTrayPopupForm(_mainWindow);

            _notifyIcon = new NotifyIcon
            {
                Text = $"Zapret for ADHD {AppConstants.AppVersion}",
                Visible = true
            };

            UpdateDynamicIcon(BypassController.Current.IsRunning);

            _notifyIcon.DoubleClick += (s, e) =>
            {
                _mainWindow.RestoreFromTray();
            };

            _notifyIcon.MouseClick += (s, e) =>
            {
                if (e.Button != MouseButtons.Left && e.Button != MouseButtons.Right)
                    return;

                _trayPopup.ShowAtCursor();
            };
        }

        public void UpdateDynamicIcon(bool isRunning)
        {
            try
            {
                var (trayIcon, icoFilePath) = UIHelper.GetOrCreateAppIcon(isRunning);

                if (_notifyIcon != null)
                {
                    _notifyIcon.Icon = trayIcon;
                    _notifyIcon.Text = isRunning
                        ? $"Zapret for ADHD ({SettingsManager.Current.SelectedProfileName} — Активен)"
                        : $"Zapret for ADHD {AppConstants.AppVersion} (Остановлен)";
                }

                _mainWindow.InvokeOnUI(() =>
                {
                    try
                    {
                        _mainWindow.Window.SetIconFile(icoFilePath);
                        _mainWindow.SetTaskbarIcon(trayIcon);
                    }
                    catch { }
                });
            }
            catch { }
        }

        public void ShowNotification(string title, string message, ToolTipIcon icon = ToolTipIcon.Info)
        {
            if (SettingsManager.Current.NotificationsEnabled && _notifyIcon != null && _notifyIcon.Visible)
                _notifyIcon.ShowBalloonTip(3000, title, message, icon);
        }

        public void Dispose()
        {
            if (_notifyIcon != null)
            {
                _notifyIcon.Visible = false;
                _notifyIcon.Dispose();
                _notifyIcon = null;
            }

            _trayPopup?.Dispose();
        }
    }

    internal sealed class CustomTrayPopupForm : Form
    {
        [DllImport("Gdi32.dll", EntryPoint = "CreateRoundRectRgn")]
        private static extern IntPtr CreateRoundRectRgn(int nLeftRect, int nTopRect, int nRightRect, int nBottomRect, int nWidthEllipse, int nHeightEllipse);

        [DllImport("Gdi32.dll")]
        private static extern bool DeleteObject(IntPtr hObject);

        [DllImport("user32.dll")]
        private static extern bool GetCursorPos(out Point lpPoint);

        [DllImport("user32.dll")]
        private static extern bool SetForegroundWindow(IntPtr hWnd);

        [DllImport("user32.dll")]
        private static extern uint GetDpiForSystem();

        private const int BaseW = 308;
        private const int BaseH = 352;

        private readonly MainWindow _mainWindow;
        private double _rxMbps = 0;
        private double _txMbps = 0;
        private string _pingStr = "...";
        private Color _pingColor = ColorTranslator.FromHtml("#4CAF50");
        private int _hoveredZone = -1;
        private float _scale = 1.0f;

        // Базовые координаты зон (умножаются на _scale при отрисовке и кликах)
        private Rectangle SRect(int x, int y, int w, int h) =>
            new((int)Math.Round(x * _scale), (int)Math.Round(y * _scale), (int)Math.Round(w * _scale), (int)Math.Round(h * _scale));

        private float S(float v) => v * _scale;
        private int SI(int v) => (int)Math.Round(v * _scale);

        public CustomTrayPopupForm(MainWindow mainWindow)
        {
            _mainWindow = mainWindow;
            AutoScaleMode = AutoScaleMode.None;
            StartPosition = FormStartPosition.Manual;
            FormBorderStyle = FormBorderStyle.None;
            ShowInTaskbar = false;
            TopMost = true;
            DoubleBuffered = true;
            BackColor = ColorTranslator.FromHtml("#121212");

            UpdateDpiMetrics();

            BypassController.Current.NetMonitor.StatsUpdated += OnStatsUpdated;
            Deactivate += (s, e) => Hide();
        }

        private void UpdateDpiMetrics()
        {
            try
            {
                uint dpi = DeviceDpi > 0 ? (uint)DeviceDpi : GetDpiForSystem();
                _scale = Math.Max(1.0f, dpi / 96.0f);
            }
            catch
            {
                _scale = 1.0f;
            }

            int w = SI(BaseW);
            int h = SI(BaseH);
            if (Width != w || Height != h)
            {
                Size = new Size(w, h);
                var oldRegion = Region;
                IntPtr hrgn = CreateRoundRectRgn(0, 0, w, h, SI(22), SI(22));
                try
                {
                    Region = Region.FromHrgn(hrgn);
                }
                finally
                {
                    DeleteObject(hrgn);
                    oldRegion?.Dispose();
                }
            }
        }

        private void OnStatsUpdated(double rx, double tx)
        {
            _rxMbps = rx;
            _txMbps = tx;
            if (Visible)
            {
                try { BeginInvoke(new Action(Invalidate)); } catch { }
            }
        }

        public void ShowAtCursor()
        {
            UpdateDpiMetrics();

            if (!GetCursorPos(out Point cursor))
                cursor = Cursor.Position;

            var screen = Screen.FromPoint(cursor).WorkingArea;

            int x = Math.Max(screen.Left + 8, Math.Min(cursor.X - Width / 2, screen.Right - Width - 8));
            int y = Math.Max(screen.Top + 8, Math.Min(cursor.Y - Height - 12, screen.Bottom - Height - 8));

            Location = new Point(x, y);
            if (!Visible)
                Show();

            SetDesktopLocation(x, y);
            SetForegroundWindow(Handle);
            Activate();
            Invalidate();
            _ = RefreshPingAsync();
        }

        private async Task RefreshPingAsync()
        {
            _pingStr = "...";
            _pingColor = ColorTranslator.FromHtml("#888888");
            Invalidate();

            var ms = await BypassController.Current.CheckPingAsync();
            if (ms >= 0)
            {
                _pingStr = $"{ms} мс";
                _pingColor = ms < 80 ? UIHelper.GetAccentColor(true) : ms < 150 ? ColorTranslator.FromHtml("#FF8C00") : UIHelper.GetErrorColor();
            }
            else
            {
                _pingStr = "недоступен";
                _pingColor = UIHelper.GetErrorColor();
            }
            if (Visible) Invalidate();
        }

        protected override void OnMouseMove(MouseEventArgs e)
        {
            base.OnMouseMove(e);
            int zone = GetZoneAt(e.Location);
            if (zone != _hoveredZone)
            {
                _hoveredZone = zone;
                Cursor = zone >= 0 ? Cursors.Hand : Cursors.Default;
                Invalidate();
            }
        }

        protected override void OnMouseLeave(EventArgs e)
        {
            base.OnMouseLeave(e);
            _hoveredZone = -1;
            Cursor = Cursors.Default;
            Invalidate();
        }

        protected override async void OnMouseClick(MouseEventArgs e)
        {
            base.OnMouseClick(e);
            if (e.Button != MouseButtons.Left) return;

            switch (GetZoneAt(e.Location))
            {
                case 1:
                    await CycleProfileAsync(-1);
                    break;
                case 2:
                    await CycleProfileAsync(1);
                    break;
                case 3:
                    _mainWindow.ToggleBypass();
                    await Task.Delay(450);
                    Invalidate();
                    break;
                case 4:
                    await RefreshPingAsync();
                    break;
                case 5:
                    await _mainWindow.RestartBypassAsync();
                    Invalidate();
                    break;
                case 6:
                    Hide();
                    _mainWindow.RestoreFromTray();
                    break;
                case 7:
                    Hide();
                    _mainWindow.ForceExit();
                    break;
            }
        }

        private async Task CycleProfileAsync(int dir)
        {
            var profiles = BypassController.Current.Zapret.GetAvailableProfiles();
            if (profiles.Count == 0) return;

            var current = SettingsManager.Current.SelectedProfileName ?? "general.bat";
            var idx = profiles.FindIndex(p => string.Equals(p, current, StringComparison.OrdinalIgnoreCase));
            var nextIdx = idx < 0 ? 0 : (idx + dir + profiles.Count) % profiles.Count;

            await _mainWindow.SelectProfileFromTrayAsync(profiles[nextIdx]);
            Invalidate();
        }

        private Rectangle RectPrevProf => SRect(154, 60, 24, 26);
        private Rectangle RectNextProf => SRect(270, 60, 24, 26);
        private Rectangle RectPowerBtn => SRect(14, 96, 280, 42);
        private Rectangle RectPingBtn => SRect(264, 196, 24, 24);
        private Rectangle RectRestartBtn => SRect(14, 236, 280, 34);
        private Rectangle RectOpenBtn => SRect(14, 272, 280, 34);
        private Rectangle RectExitBtn => SRect(14, 308, 280, 34);

        private int GetZoneAt(Point pt)
        {
            if (RectPrevProf.Contains(pt)) return 1;
            if (RectNextProf.Contains(pt)) return 2;
            if (RectPowerBtn.Contains(pt)) return 3;
            if (RectPingBtn.Contains(pt)) return 4;
            if (RectRestartBtn.Contains(pt)) return 5;
            if (RectOpenBtn.Contains(pt)) return 6;
            if (RectExitBtn.Contains(pt)) return 7;
            return -1;
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.ClearTypeGridFit;

            bool zapretRun = BypassController.Current.Zapret.IsRunning;
            bool proxyRun = BypassController.Current.TgProxy.IsRunning;
            bool anyRun = zapretRun || proxyRun;

            var accent = UIHelper.GetAccentColor(false);
            var accentLight = UIHelper.GetAccentColor(true);
            var accentDarkBg = UIHelper.GetAccentDarkBgColor();
            var danger = UIHelper.GetErrorColor();

            var sfCenter = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };
            var sfLeftCenter = new StringFormat { Alignment = StringAlignment.Near, LineAlignment = StringAlignment.Center };
            var sfRightCenter = new StringFormat { Alignment = StringAlignment.Far, LineAlignment = StringAlignment.Center };

            // Внешняя рамка
            using (var borderPen = new Pen(ColorTranslator.FromHtml("#2A2A2A"), S(1.5f)))
            using (var borderPath = UIHelper.CreateRoundedRectPath(new Rectangle(1, 1, Width - 3, Height - 3), SI(11)))
            {
                g.DrawPath(borderPen, borderPath);
            }

            // 1. Шапка: иконка, заголовок, подзаголовок и бейдж версии
            var logoRect = SRect(14, 14, 32, 32);
            using (var logoBg = new SolidBrush(accentDarkBg))
            using (var logoPen = new Pen(accent, S(1f)))
            using (var logoPath = UIHelper.CreateRoundedRectPath(logoRect, SI(8)))
            {
                g.FillPath(logoBg, logoPath);
                g.DrawPath(logoPen, logoPath);
            }
            using (var fLogo = new Font("Segoe UI", S(15f), FontStyle.Bold, GraphicsUnit.Pixel))
            using (var bLogo = new SolidBrush(accentLight))
            {
                g.DrawString("Z", fLogo, bLogo, logoRect, sfCenter);
            }

            using (var fTitle = new Font("Segoe UI", S(13.5f), FontStyle.Bold, GraphicsUnit.Pixel))
            using (var fSub = new Font("Segoe UI", S(11f), FontStyle.Regular, GraphicsUnit.Pixel))
            using (var bSub = new SolidBrush(anyRun ? accentLight : ColorTranslator.FromHtml("#888888")))
            {
                g.DrawString("Zapret for ADHD", fTitle, Brushes.White, S(54), S(13));
                string subTxt = (zapretRun && proxyRun) ? "Zapret + TgWsProxy активны"
                              : zapretRun ? "Обход Zapret активен"
                              : proxyRun ? "Прокси Telegram активен"
                              : "Службы остановлены";
                g.DrawString(subTxt, fSub, bSub, S(54), S(30));
            }

            var verRect = SRect(250, 18, 44, 22);
            using (var verBg = new SolidBrush(ColorTranslator.FromHtml("#1A1A1A")))
            using (var verPen = new Pen(ColorTranslator.FromHtml("#2A2A2A")))
            using (var verPath = UIHelper.CreateRoundedRectPath(verRect, SI(5)))
            using (var fVer = new Font("Consolas", S(10.5f), FontStyle.Bold, GraphicsUnit.Pixel))
            using (var bVer = new SolidBrush(ColorTranslator.FromHtml("#888888")))
            {
                g.FillPath(verBg, verPath);
                g.DrawPath(verPen, verPath);
                g.DrawString(AppConstants.AppVersion, fVer, bVer, verRect, sfCenter);
            }

            // 2. Пилюли статуса + селектор профиля
            DrawStatusPill(g, SRect(14, 60, 66, 26), "Zapret", zapretRun ? accentLight : danger);
            DrawStatusPill(g, SRect(84, 60, 64, 26), "Proxy", proxyRun ? accentLight : danger);

            var profBox = SRect(154, 60, 140, 26);
            using (var profBg = new SolidBrush(ColorTranslator.FromHtml("#181818")))
            using (var profPen = new Pen(ColorTranslator.FromHtml("#262626")))
            using (var profPath = UIHelper.CreateRoundedRectPath(profBox, SI(6)))
            {
                g.FillPath(profBg, profPath);
                g.DrawPath(profPen, profPath);
            }
            using (var fArrow = new Font("Segoe UI", S(13f), FontStyle.Bold, GraphicsUnit.Pixel))
            using (var fProf = new Font("Consolas", S(10.5f), FontStyle.Bold, GraphicsUnit.Pixel))
            {
                g.DrawString("‹", fArrow, _hoveredZone == 1 ? Brushes.White : Brushes.Gray, RectPrevProf, sfCenter);
                g.DrawString("›", fArrow, _hoveredZone == 2 ? Brushes.White : Brushes.Gray, RectNextProf, sfCenter);

                string profName = SettingsManager.Current.SelectedProfileName ?? "general.bat";
                if (profName.Length > 13) profName = profName.Substring(0, 12) + "…";
                var textRect = SRect(176, 60, 96, 26);
                g.DrawString(profName, fProf, Brushes.White, textRect, sfCenter);
            }

            // 3. Главная кнопка запуска / остановки
            var pwrBgColor = anyRun ? ColorTranslator.FromHtml("#2A1215") : accentDarkBg;
            var pwrBorderColor = anyRun ? danger : accent;
            using (var pwrBg = new SolidBrush(pwrBgColor))
            using (var pwrPen = new Pen(pwrBorderColor, S(1.2f)))
            using (var pwrPath = UIHelper.CreateRoundedRectPath(RectPowerBtn, SI(9)))
            {
                g.FillPath(pwrBg, pwrPath);
                g.DrawPath(pwrPen, pwrPath);
            }
            using (var fPwr = new Font("Segoe UI", S(13f), FontStyle.Bold, GraphicsUnit.Pixel))
            {
                g.DrawString(anyRun ? "■   Остановить обход" : "▶   Включить обход", fPwr, Brushes.White, RectPowerBtn, sfCenter);
            }

            // 4. Бенто-карточка телеметрии и пинга
            var teleRect = SRect(14, 148, 280, 80);
            using (var teleBg = new SolidBrush(ColorTranslator.FromHtml("#171717")))
            using (var telePen = new Pen(ColorTranslator.FromHtml("#242424")))
            using (var telePath = UIHelper.CreateRoundedRectPath(teleRect, SI(9)))
            {
                g.FillPath(teleBg, telePath);
                g.DrawPath(telePen, telePath);
            }

            using (var fLbl = new Font("Segoe UI", S(10f), FontStyle.Regular, GraphicsUnit.Pixel))
            using (var fVal = new Font("Consolas", S(12f), FontStyle.Bold, GraphicsUnit.Pixel))
            using (var bGray = new SolidBrush(ColorTranslator.FromHtml("#888888")))
            using (var sepPen = new Pen(ColorTranslator.FromHtml("#242424")))
            {
                // Входящий (левая колонка)
                g.DrawString("↓ Входящий", fLbl, bGray, S(24), S(154));
                g.DrawString($"{_rxMbps:0.0} Мбит/с", fVal, Brushes.White, S(24), S(170));

                // Вертикальный разделитель
                g.DrawLine(sepPen, S(154), S(155), S(154), S(185));

                // Исходящий (правая колонка)
                g.DrawString("↑ Исходящий", fLbl, bGray, SRect(160, 154, 124, 14), sfRightCenter);
                g.DrawString($"{_txMbps:0.0} Мбит/с", fVal, Brushes.White, SRect(160, 170, 124, 16), sfRightCenter);

                // Горизонтальный разделитель
                g.DrawLine(sepPen, S(24), S(191), S(284), S(191));

                // Строка пинга
                using var fPingLbl = new Font("Segoe UI", S(11.5f), FontStyle.Regular, GraphicsUnit.Pixel);
                g.DrawString("Пинг (EU):", fPingLbl, bGray, SRect(24, 196, 110, 24), sfLeftCenter);

                using var bPing = new SolidBrush(_pingColor);
                g.DrawString(_pingStr, fVal, bPing, SRect(110, 196, 146, 24), sfRightCenter);

                using var btnPath = UIHelper.CreateRoundedRectPath(RectPingBtn, SI(5));
                using var btnBg = new SolidBrush(_hoveredZone == 4 ? ColorTranslator.FromHtml("#2E2E2E") : ColorTranslator.FromHtml("#222222"));
                g.FillPath(btnBg, btnPath);
                g.DrawString("↻", fVal, Brushes.LightGray, RectPingBtn, sfCenter);
            }

            // 5. Нижние кнопки быстрых действий
            DrawMenuRow(g, RectRestartBtn, "↻   Перезапустить службы", _hoveredZone == 5, false);
            DrawMenuRow(g, RectOpenBtn, "❐   Открыть панель управления", _hoveredZone == 6, false);
            DrawMenuRow(g, RectExitBtn, "✕   Полностью закрыть", _hoveredZone == 7, true);
        }

        private void DrawStatusPill(Graphics g, Rectangle rect, string text, Color dotColor)
        {
            using var bg = new SolidBrush(ColorTranslator.FromHtml("#181818"));
            using var pen = new Pen(ColorTranslator.FromHtml("#262626"));
            using var path = UIHelper.CreateRoundedRectPath(rect, SI(6));
            g.FillPath(bg, path);
            g.DrawPath(pen, path);

            int dotSize = SI(6);
            using var dotBrush = new SolidBrush(dotColor);
            g.FillEllipse(dotBrush, rect.X + SI(8), rect.Y + (rect.Height - dotSize) / 2, dotSize, dotSize);

            using var font = new Font("Segoe UI", S(10.5f), FontStyle.Bold, GraphicsUnit.Pixel);
            using var textBrush = new SolidBrush(ColorTranslator.FromHtml("#CCCCCC"));
            var textRect = new Rectangle(rect.X + SI(18), rect.Y, rect.Width - SI(20), rect.Height);
            var sf = new StringFormat { Alignment = StringAlignment.Near, LineAlignment = StringAlignment.Center };
            g.DrawString(text, font, textBrush, textRect, sf);
        }

        private void DrawMenuRow(Graphics g, Rectangle rect, string text, bool hovered, bool isDanger)
        {
            if (hovered)
            {
                var bgCol = isDanger ? ColorTranslator.FromHtml("#2A1215") : ColorTranslator.FromHtml("#1E1E1E");
                var brdCol = isDanger ? ColorTranslator.FromHtml("#5C242A") : ColorTranslator.FromHtml("#2E2E2E");
                using var bg = new SolidBrush(bgCol);
                using var pen = new Pen(brdCol);
                using var path = UIHelper.CreateRoundedRectPath(rect, SI(7));
                g.FillPath(bg, path);
                g.DrawPath(pen, path);
            }

            using var font = new Font("Segoe UI", S(12f), isDanger ? FontStyle.Bold : FontStyle.Regular, GraphicsUnit.Pixel);
            using var brush = new SolidBrush(isDanger ? ColorTranslator.FromHtml("#F44336") : ColorTranslator.FromHtml("#E0E0E0"));
            var textRect = new Rectangle(rect.X + SI(10), rect.Y, rect.Width - SI(16), rect.Height);
            var sf = new StringFormat { Alignment = StringAlignment.Near, LineAlignment = StringAlignment.Center };
            g.DrawString(text, font, brush, textRect, sf);
        }
    }
}