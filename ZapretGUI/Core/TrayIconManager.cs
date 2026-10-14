using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Windows;
using ZapretGUI.Views;

namespace ZapretGUI.Core
{
    public class TrayIconManager : IDisposable
    {
        [DllImport("user32.dll", CharSet = CharSet.Auto)]
        private static extern bool DestroyIcon(IntPtr handle);

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

            _notifyIcon = new System.Windows.Forms.NotifyIcon();
            try
            {
                var iconUri = new Uri("pack://application:,,,/Assets/freepik__толстая,_сплошная,_монолитная_буква_z_белого.png");
                var resourceInfo = System.Windows.Application.GetResourceStream(iconUri);
                if (resourceInfo != null)
                {
                    using var stream = resourceInfo.Stream;
                    using var bitmap = new System.Drawing.Bitmap(stream);
                    _hIcon = bitmap.GetHicon();
                    _notifyIcon.Icon = System.Drawing.Icon.FromHandle(_hIcon);
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Ошибка загрузки иконки в трей: {ex.Message}");
                _notifyIcon.Icon = System.Drawing.SystemIcons.Shield;
            }

            _notifyIcon.Text = "Zapret for ADHD";
            _notifyIcon.Visible = true;

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

                _trayMenu.Left = (mousePos.X * dpiX) - _trayMenu.ActualWidth;
                _trayMenu.Top = (mousePos.Y * dpiY) - _trayMenu.ActualHeight - 20;

                _trayMenu.Activate();
                _trayMenu.RefreshState();
            };
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
                DestroyIcon(_hIcon);
                _hIcon = IntPtr.Zero;
            }

            _trayMenu?.Close();
        }
    }
}