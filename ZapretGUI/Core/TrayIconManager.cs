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
                    try { _mainWindow.Window.SetIconFile(icoFilePath); } catch { }
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

        private readonly MainWindow _mainWindow;
        private double _rxMbps = 0;
        private double _txMbps = 0;
        private string _pingStr = "...";
        private Color _pingColor = ColorTranslator.FromHtml("#4CAF50");
        private int _hoveredZone = -1;

        private readonly Rectangle _rectPrevProf = new(144, 58, 22, 24);
        private readonly Rectangle _rectNextProf = new(244, 58, 22, 24);
        private readonly Rectangle _rectPowerBtn = new(14, 92, 252, 40);
        private readonly Rectangle _rectPingBtn = new(238, 186, 22, 22);
        private readonly Rectangle _rectRestartBtn = new(14, 224, 252, 32);
        private readonly Rectangle _rectOpenBtn = new(14, 258, 252, 32);
        private readonly Rectangle _rectExitBtn = new(14, 292, 252, 32);

        public CustomTrayPopupForm(MainWindow mainWindow)
        {
            _mainWindow = mainWindow;
            FormBorderStyle = FormBorderStyle.None;
            ShowInTaskbar = false;
            TopMost = true;
            DoubleBuffered = true;
            Size = new Size(280, 336);
            BackColor = ColorTranslator.FromHtml("#121212");
            Region = Region.FromHrgn(CreateRoundRectRgn(0, 0, Width, Height, 22, 22));

            BypassController.Current.NetMonitor.StatsUpdated += OnStatsUpdated;
            Deactivate += (s, e) => Hide();
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
            var cursor = Cursor.Position;
            var screen = Screen.FromPoint(cursor).WorkingArea;

            int x = Math.Max(screen.Left + 8, Math.Min(cursor.X - Width / 2, screen.Right - Width - 8));
            int y = Math.Max(screen.Top + 8, Math.Min(cursor.Y - Height - 10, screen.Bottom - Height - 8));

            Location = new Point(x, y);
            Show();
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
                _pingStr = "ошибка";
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

        private int GetZoneAt(Point pt)
        {
            if (_rectPrevProf.Contains(pt)) return 1;
            if (_rectNextProf.Contains(pt)) return 2;
            if (_rectPowerBtn.Contains(pt)) return 3;
            if (_rectPingBtn.Contains(pt)) return 4;
            if (_rectRestartBtn.Contains(pt)) return 5;
            if (_rectOpenBtn.Contains(pt)) return 6;
            if (_rectExitBtn.Contains(pt)) return 7;
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

            using (var borderPen = new Pen(ColorTranslator.FromHtml("#2A2A2A"), 1.5f))
            using (var borderPath = UIHelper.CreateRoundedRectPath(new Rectangle(1, 1, Width - 3, Height - 3), 11))
            {
                g.DrawPath(borderPen, borderPath);
            }

            using (var logoBg = new SolidBrush(accentDarkBg))
            using (var logoPen = new Pen(accent, 1f))
            using (var logoPath = UIHelper.CreateRoundedRectPath(new Rectangle(14, 14, 28, 28), 7))
            {
                g.FillPath(logoBg, logoPath);
                g.DrawPath(logoPen, logoPath);
            }
            using (var fLogo = new Font("Segoe UI", 11f, FontStyle.Bold))
            using (var bLogo = new SolidBrush(accentLight))
            {
                g.DrawString("⚡", fLogo, bLogo, 17, 17);
            }

            using (var fTitle = new Font("Segoe UI", 10.5f, FontStyle.Bold))
            using (var fSub = new Font("Segoe UI", 8.5f, FontStyle.Regular))
            using (var bSub = new SolidBrush(anyRun ? accentLight : ColorTranslator.FromHtml("#888888")))
            {
                g.DrawString("Zapret for ADHD", fTitle, Brushes.White, 48, 13);
                string subTxt = (zapretRun && proxyRun) ? "Zapret + TgWsProxy активны"
                              : zapretRun ? "Обход Zapret активен"
                              : proxyRun ? "Прокси Telegram активен"
                              : "Службы остановлены";
                g.DrawString(subTxt, fSub, bSub, 48, 30);
            }

            DrawStatusPill(g, new Rectangle(14, 58, 60, 24), "Zapret", zapretRun ? accentLight : danger);
            DrawStatusPill(g, new Rectangle(78, 58, 60, 24), "Proxy", proxyRun ? accentLight : danger);

            using (var profBg = new SolidBrush(ColorTranslator.FromHtml("#181818")))
            using (var profPen = new Pen(ColorTranslator.FromHtml("#262626")))
            using (var profPath = UIHelper.CreateRoundedRectPath(new Rectangle(144, 58, 122, 24), 6))
            {
                g.FillPath(profBg, profPath);
                g.DrawPath(profPen, profPath);
            }
            using (var fProf = new Font("Consolas", 8.2f, FontStyle.Bold))
            {
                g.DrawString("‹", fProf, _hoveredZone == 1 ? Brushes.White : Brushes.Gray, 150, 62);
                g.DrawString("›", fProf, _hoveredZone == 2 ? Brushes.White : Brushes.Gray, 252, 62);

                string profName = SettingsManager.Current.SelectedProfileName ?? "general.bat";
                if (profName.Length > 11) profName = profName.Substring(0, 10) + "…";
                g.DrawString(profName, fProf, Brushes.White, 166, 63);
            }

            var pwrBgColor = anyRun ? ColorTranslator.FromHtml("#2A1215") : accentDarkBg;
            var pwrBorderColor = anyRun ? danger : accent;
            using (var pwrBg = new SolidBrush(pwrBgColor))
            using (var pwrPen = new Pen(pwrBorderColor, 1.2f))
            using (var pwrPath = UIHelper.CreateRoundedRectPath(_rectPowerBtn, 9))
            {
                g.FillPath(pwrBg, pwrPath);
                g.DrawPath(pwrPen, pwrPath);
            }
            using (var fPwr = new Font("Segoe UI", 10f, FontStyle.Bold))
            {
                var sf = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };
                g.DrawString(anyRun ? "■  Остановить обход" : "▶  Включить обход", fPwr, Brushes.White, _rectPowerBtn, sf);
            }

            var teleRect = new Rectangle(14, 140, 252, 74);
            using (var teleBg = new SolidBrush(ColorTranslator.FromHtml("#171717")))
            using (var telePen = new Pen(ColorTranslator.FromHtml("#242424")))
            using (var telePath = UIHelper.CreateRoundedRectPath(teleRect, 9))
            {
                g.FillPath(teleBg, telePath);
                g.DrawPath(telePen, telePath);
            }

            using (var fLbl = new Font("Segoe UI", 7.8f))
            using (var fVal = new Font("Consolas", 9.2f, FontStyle.Bold))
            using (var bGray = new SolidBrush(ColorTranslator.FromHtml("#888888")))
            {
                g.DrawString("↓ Входящий", fLbl, bGray, 24, 147);
                g.DrawString($"{_rxMbps:0.0} Мбит/с", fVal, Brushes.White, 24, 161);

                g.DrawString("↑ Исходящий", fLbl, bGray, 152, 147);
                g.DrawString($"{_txMbps:0.0} Мбит/с", fVal, Brushes.White, 152, 161);

                using var sepPen = new Pen(ColorTranslator.FromHtml("#232323"));
                g.DrawLine(sepPen, 22, 181, 258, 181);

                g.DrawString("Пинг (EU):", new Font("Segoe UI", 8.8f), bGray, 24, 189);
                using var bPing = new SolidBrush(_pingColor);
                g.DrawString(_pingStr, fVal, bPing, 92, 189);

                using var btnPath = UIHelper.CreateRoundedRectPath(_rectPingBtn, 5);
                using var btnBg = new SolidBrush(_hoveredZone == 4 ? ColorTranslator.FromHtml("#2E2E2E") : ColorTranslator.FromHtml("#222222"));
                g.FillPath(btnBg, btnPath);
                g.DrawString("↻", fVal, Brushes.LightGray, 242, 188);
            }

            DrawMenuRow(g, _rectRestartBtn, "↻   Перезапустить службы", _hoveredZone == 5, false);
            DrawMenuRow(g, _rectOpenBtn, "❐   Открыть панель управления", _hoveredZone == 6, false);
            DrawMenuRow(g, _rectExitBtn, "✕   Полностью закрыть", _hoveredZone == 7, true);
        }

        private static void DrawStatusPill(Graphics g, Rectangle rect, string text, Color dotColor)
        {
            using var bg = new SolidBrush(ColorTranslator.FromHtml("#181818"));
            using var pen = new Pen(ColorTranslator.FromHtml("#262626"));
            using var path = UIHelper.CreateRoundedRectPath(rect, 6);
            g.FillPath(bg, path);
            g.DrawPath(pen, path);

            using var dotBrush = new SolidBrush(dotColor);
            g.FillEllipse(dotBrush, rect.X + 7, rect.Y + 9, 6, 6);

            using var font = new Font("Segoe UI", 8f, FontStyle.Bold);
            using var textBrush = new SolidBrush(ColorTranslator.FromHtml("#CCCCCC"));
            g.DrawString(text, font, textBrush, rect.X + 16, rect.Y + 5);
        }

        private static void DrawMenuRow(Graphics g, Rectangle rect, string text, bool hovered, bool isDanger)
        {
            if (hovered)
            {
                var bgCol = isDanger ? ColorTranslator.FromHtml("#2A1215") : ColorTranslator.FromHtml("#1E1E1E");
                var brdCol = isDanger ? ColorTranslator.FromHtml("#5C242A") : ColorTranslator.FromHtml("#2E2E2E");
                using var bg = new SolidBrush(bgCol);
                using var pen = new Pen(brdCol);
                using var path = UIHelper.CreateRoundedRectPath(rect, 7);
                g.FillPath(bg, path);
                g.DrawPath(pen, path);
            }

            using var font = new Font("Segoe UI", 9.2f, isDanger ? FontStyle.Bold : FontStyle.Regular);
            using var brush = new SolidBrush(isDanger ? ColorTranslator.FromHtml("#F44336") : ColorTranslator.FromHtml("#E0E0E0"));
            g.DrawString(text, font, brush, rect.X + 10, rect.Y + 7);
        }
    }
}