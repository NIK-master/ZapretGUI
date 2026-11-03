using System;
using System.Drawing;
using System.Windows;
using ZapretGUI.Views;

namespace ZapretGUI.Core
{
    public class TrayIconManager : IDisposable
    {
        private System.Windows.Forms.NotifyIcon? _notifyIcon;
        private TrayMenuWindow? _trayMenu;
        private readonly Window _mainWindow;
        private IntPtr _hIcon = IntPtr.Zero;

        public TrayIconManager(Window mainWindow)
        {
            _mainWindow = mainWindow;
            SetupTrayIcon();
        }

        private void SetupTrayIcon()
        {
            _trayMenu = new TrayMenuWindow();
            _trayMenu.WindowStartupLocation = WindowStartupLocation.Manual;

            _notifyIcon = new System.Windows.Forms.NotifyIcon
            {
                Text = $"Zapret for ADHD {AppConstants.AppVersion}",
                Visible = true
            };

            UpdateDynamicIcon(BypassController.Current.IsRunning);

            _notifyIcon.DoubleClick += (s, e) =>
            {
                _mainWindow.Show();
                _mainWindow.WindowState = WindowState.Normal;
                _mainWindow.Activate();
            };

            _notifyIcon.MouseClick += (s, e) =>
            {
                if (e.Button != System.Windows.Forms.MouseButtons.Left && e.Button != System.Windows.Forms.MouseButtons.Right)
                    return;

                _trayMenu.RefreshState();
                _trayMenu.Show();
                _trayMenu.UpdateLayout();

                var mousePos = System.Windows.Forms.Control.MousePosition;
                var source = PresentationSource.FromVisual(_mainWindow);
                double dpiX = 1.0, dpiY = 1.0;

                if (source?.CompositionTarget != null)
                {
                    dpiX = source.CompositionTarget.TransformFromDevice.M11;
                    dpiY = source.CompositionTarget.TransformFromDevice.M22;
                }

                var workArea = SystemParameters.WorkArea;
                var targetLeft = (mousePos.X * dpiX) - (_trayMenu.ActualWidth / 2);
                var targetTop = (mousePos.Y * dpiY) - _trayMenu.ActualHeight - 10;

                targetLeft = Math.Max(workArea.Left + 8, Math.Min(targetLeft, workArea.Right - _trayMenu.ActualWidth - 8));
                targetTop = Math.Max(workArea.Top + 8, Math.Min(targetTop, workArea.Bottom - _trayMenu.ActualHeight - 8));

                _trayMenu.Left = targetLeft;
                _trayMenu.Top = targetTop;

                _trayMenu.Activate();
                _trayMenu.PlayPopupAnimation();
            };
        }

        public void UpdateDynamicIcon(bool isRunning)
        {
            _mainWindow.Dispatcher.InvokeAsync(() =>
            {
                try
                {
                    var oldHIcon = _hIcon;
                    var (newHIcon, wpfIcon) = UIHelper.CreateDynamicAppIcon(isRunning);
                    _hIcon = newHIcon;

                    if (_notifyIcon != null)
                    {
                        _notifyIcon.Icon = Icon.FromHandle(_hIcon);
                        _notifyIcon.Text = isRunning
                            ? $"Zapret for ADHD ({SettingsManager.Current.SelectedProfileName} — Активен)"
                            : $"Zapret for ADHD {AppConstants.AppVersion} (Остановлен)";
                    }

                    _mainWindow.Icon = wpfIcon;

                    if (oldHIcon != IntPtr.Zero)
                        UIHelper.DestroyIcon(oldHIcon);
                }
                catch { }
            });
        }

        public void ShowNotification(string title, string message, System.Windows.Forms.ToolTipIcon icon = System.Windows.Forms.ToolTipIcon.Info)
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

            if (_hIcon != IntPtr.Zero)
            {
                UIHelper.DestroyIcon(_hIcon);
                _hIcon = IntPtr.Zero;
            }

            _trayMenu?.Close();
        }
    }
}