using Photino.NET;
using System;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using System.Windows.Forms;
using ZapretGUI.Core;

namespace ZapretGUI
{
    public class MainWindow
    {
        [DllImport("user32.dll")]
        private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

        [DllImport("user32.dll")]
        private static extern bool SetForegroundWindow(IntPtr hWnd);

        [DllImport("user32.dll", CharSet = CharSet.Auto)]
        private static extern IntPtr SendMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);

        [DllImport("user32.dll")]
        private static extern uint GetDpiForWindow(IntPtr hwnd);

        [DllImport("user32.dll")]
        private static extern uint GetDpiForSystem();

        private const int SW_HIDE = 0;
        private const int SW_SHOWNORMAL = 1;
        private const int SW_SHOWMINIMIZED = 2;
        private const int SW_RESTORE = 9;

        private const uint WM_SETICON = 0x0080;
        private static readonly IntPtr ICON_SMALL = new(0);
        private static readonly IntPtr ICON_BIG = new(1);

        // Базовые логические размеры (как были в WPF)
        private const int NormalLogicalWidth = 1100;
        private const int NormalLogicalHeight = 760;
        private const int CompactLogicalWidth = 850;
        private const int CompactLogicalHeight = 520;

        public PhotinoWindow Window { get; }
        private readonly TrayIconManager _trayIconManager;
        private WebBridge? _webBridge;
        private readonly bool _isFirstRun;
        private bool _isForceExiting = false;

        public IntPtr WindowHandle => Window.WindowHandle;

        public MainWindow()
        {
            // Убираем белую вспышку WebView2 при запуске (делаем фон #0A0A0A до загрузки HTML)
            Environment.SetEnvironmentVariable("WEBVIEW2_DEFAULT_BACKGROUND_COLOR", "FF0A0A0A");

            var configPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "config.json");
            _isFirstRun = !File.Exists(configPath);

            SettingsManager.Load();
            UIHelper.ApplyThemeColors();

            var (_, initIcoPath) = UIHelper.GetOrCreateAppIcon(false);
            var initialSize = GetScaledWindowSize(SettingsManager.Current.CompactMode);

            Window = new PhotinoWindow()
                .SetTitle("Zapret for ADHD")
                .SetIconFile(initIcoPath)
                .SetUseOsDefaultSize(false)
                .SetSize(initialSize)
                .Center()
                .SetChromeless(true)
                .SetResizable(false)
                .SetTopMost(SettingsManager.Current.AlwaysOnTop)
                .SetContextMenuEnabled(false)
                .SetDevToolsEnabled(false);

            _webBridge = new WebBridge(this, _isFirstRun);

            Window.RegisterWebMessageReceivedHandler((sender, message) =>
            {
                _webBridge.HandleMessage(message);
            });

            Window.RegisterWindowCreatedHandler((sender, args) =>
            {
                // Повторно применяем точный DPI-размер и центрирование после создания HWND
                var exactSize = GetScaledWindowSize(SettingsManager.Current.CompactMode);
                Window.SetSize(exactSize);
                Window.Center();

                RefreshAppIcon();

                if (SettingsManager.Current.StartMinimized)
                {
                    HideToTray();
                }

                _ = InitializeAppAsync();
            });

            Window.RegisterWindowClosingHandler((sender, args) =>
            {
                if (!_isForceExiting && SettingsManager.Current.MinimizeOnClose)
                {
                    HideToTray();
                    ShowNotification(
                        "Программа работает в фоне",
                        "Zapret свернут в системный трей. Дважды кликните по иконке в трее, чтобы открыть окно.");
                    return true;
                }

                CleanupOnExit();
                return false;
            });

            _trayIconManager = new TrayIconManager(this);
        }

        private double GetDpiScale()
        {
            try
            {
                uint dpi = Window != null && Window.WindowHandle != IntPtr.Zero
                    ? GetDpiForWindow(Window.WindowHandle)
                    : GetDpiForSystem();

                if (dpi >= 96)
                    return dpi / 96.0;
            }
            catch { }

            return 1.0;
        }

        private Size GetScaledWindowSize(bool isCompact)
        {
            double scale = GetDpiScale();
            int baseW = isCompact ? CompactLogicalWidth : NormalLogicalWidth;
            int baseH = isCompact ? CompactLogicalHeight : NormalLogicalHeight;

            return new Size(
                (int)Math.Round(baseW * scale),
                (int)Math.Round(baseH * scale));
        }

        public void Run()
        {
            var baseDir = AppDomain.CurrentDomain.BaseDirectory;
            var devWebRoot = Path.GetFullPath(Path.Combine(baseDir, @"..\..\..\wwwroot\index.html"));
            var localWebRoot = Path.Combine(baseDir, "wwwroot", "index.html");

            string htmlPath;
            if (File.Exists(devWebRoot))
            {
                htmlPath = devWebRoot;
            }
            else if (File.Exists(localWebRoot))
            {
                htmlPath = localWebRoot;
            }
            else
            {
                var webRootDir = ExtractEmbeddedWebUI();
                htmlPath = Path.Combine(webRootDir, "index.html");
            }

            Window.Load(htmlPath);
            Window.WaitForClose();
        }

        private async Task InitializeAppAsync()
        {
            var modManager = new ModManager();
            modManager.InitializeFolders();
            await modManager.SyncActiveBatModsAsync();
            await modManager.ApplyListModsAsync();

            BypassController.Current.NetMonitor.Start();

            if (!_isFirstRun)
                _ = CheckUpdatesOnStartupAsync();

            if (!_isFirstRun && SettingsManager.Current.AutoStartBypass && !BypassController.Current.IsRunning)
            {
                try
                {
                    await BypassController.Current.StartServicesAsync(
                        SettingsManager.Current.SelectedProfileName,
                        SettingsManager.Current.ZapretEnabled,
                        SettingsManager.Current.TgProxyEnabled);
                    UpdateIndicators(BypassController.Current.Zapret.IsRunning, BypassController.Current.TgProxy.IsRunning);
                }
                catch { }
            }
        }

        private async Task CheckUpdatesOnStartupAsync()
        {
            var stopServicesAction = () => { if (IsBypassRunning()) ToggleBypass(); };
            var progress = new Progress<string>(status =>
                _webBridge?.SendEvent("log", new
                {
                    message = $"[Updater] {status}",
                    time = DateTime.Now.ToString("HH:mm:ss"),
                    isProgress = status.Contains("Скачивание:") || status.Contains("Скачано:")
                }));
            await UpdateManager.RunUpdateWorkflowAsync(isManualCheck: false, stopServicesAction, progress);
        }

        public void SetTaskbarIcon(Icon icon)
        {
            if (WindowHandle == IntPtr.Zero) return;
            try
            {
                SendMessage(WindowHandle, WM_SETICON, ICON_SMALL, icon.Handle);
                SendMessage(WindowHandle, WM_SETICON, ICON_BIG, icon.Handle);
            }
            catch { }
        }

        public void MinimizeWindow()
        {
            if (WindowHandle != IntPtr.Zero)
                ShowWindow(WindowHandle, SW_SHOWMINIMIZED);
        }

        public void HideToTray()
        {
            if (WindowHandle != IntPtr.Zero)
                ShowWindow(WindowHandle, SW_HIDE);
        }

        public void RestoreFromTray()
        {
            if (WindowHandle != IntPtr.Zero)
            {
                ShowWindow(WindowHandle, SW_RESTORE);
                ShowWindow(WindowHandle, SW_SHOWNORMAL);
                SetForegroundWindow(WindowHandle);
            }
        }

        public void CloseWindow()
        {
            if (SettingsManager.Current.MinimizeOnClose && !_isForceExiting)
            {
                HideToTray();
                ShowNotification(
                    "Программа работает в фоне",
                    "Zapret свернут в системный трей. Дважды кликните по иконке в трее, чтобы открыть окно.");
            }
            else
            {
                ForceExit();
            }
        }

        public void ForceExit()
        {
            _isForceExiting = true;
            CleanupOnExit();
            try { Window.Close(); } catch { }
            Environment.Exit(0);
        }

        private void CleanupOnExit()
        {
            BypassController.Current.NetMonitor.Stop();
            if (SettingsManager.Current.StopServicesOnExit)
                BypassController.Current.StopServices();

            _webBridge?.Dispose();
            _trayIconManager.Dispose();
        }

        public void InvokeOnUI(Action action)
        {
            try
            {
                Window.Invoke(action);
            }
            catch
            {
                try { action(); } catch { }
            }
        }

        public void UpdateIndicators(bool isZapretRunning, bool isProxyRunning)
        {
            var anyRunning = isZapretRunning || isProxyRunning;
            _trayIconManager.UpdateDynamicIcon(anyRunning);
            _webBridge?.SendEvent("bypassState", new
            {
                isRunning = anyRunning,
                zapretRunning = isZapretRunning,
                proxyRunning = isProxyRunning
            });
        }

        public void RefreshAppIcon()
        {
            _trayIconManager.UpdateDynamicIcon(BypassController.Current.IsRunning);
        }

        public void UpdateNetworkIndicator(bool isOnline)
        {
            _webBridge?.SendEvent("netStatus", new { isOnline });
        }

        public void ShowNotification(string title, string message, ToolTipIcon icon = ToolTipIcon.Info)
        {
            _trayIconManager.ShowNotification(title, message, icon);
        }

        public bool IsBypassRunning() => BypassController.Current.IsRunning;

        public async void ToggleBypass()
        {
            if (BypassController.Current.IsRunning)
                BypassController.Current.StopServices();
            else
                await BypassController.Current.StartServicesAsync(
                    SettingsManager.Current.SelectedProfileName,
                    SettingsManager.Current.ZapretEnabled,
                    SettingsManager.Current.TgProxyEnabled);

            UpdateIndicators(BypassController.Current.Zapret.IsRunning, BypassController.Current.TgProxy.IsRunning);
        }

        public async Task RestartBypassAsync()
        {
            var profile = SettingsManager.Current.SelectedProfileName;
            await BypassController.Current.RestartServicesAsync(profile);
            UpdateIndicators(BypassController.Current.Zapret.IsRunning, BypassController.Current.TgProxy.IsRunning);
        }

        public async Task SelectProfileFromTrayAsync(string profileName)
        {
            SettingsManager.Current.SelectedProfileName = profileName;
            SettingsManager.Save();

            _webBridge?.SendEvent("profileSelected", new { profile = profileName });

            if (BypassController.Current.Zapret.IsRunning)
            {
                await BypassController.Current.RestartServicesAsync(profileName);
                UpdateIndicators(BypassController.Current.Zapret.IsRunning, BypassController.Current.TgProxy.IsRunning);
            }
        }

        public void AnimateWindowSize(bool isCompact)
        {
            InvokeOnUI(() =>
            {
                var targetSize = GetScaledWindowSize(isCompact);
                var currentSize = Window.Size;
                var currentLoc = Window.Location;

                if (Math.Abs(currentSize.Width - targetSize.Width) < 2 &&
                    Math.Abs(currentSize.Height - targetSize.Height) < 2)
                {
                    return;
                }

                int newX = currentLoc.X - (targetSize.Width - currentSize.Width) / 2;
                int newY = currentLoc.Y - (targetSize.Height - currentSize.Height) / 2;

                if (WindowHandle != IntPtr.Zero)
                {
                    var screen = Screen.FromHandle(WindowHandle).WorkingArea;
                    newX = Math.Max(screen.Left, Math.Min(newX, screen.Right - targetSize.Width));
                    newY = Math.Max(screen.Top, Math.Min(newY, screen.Bottom - targetSize.Height));
                }

                // Штатные методы PhotinoWindow корректно обновляют и рамку окна, и внутренний контрол WebView2
                Window.SetSize(targetSize);
                Window.SetLocation(new Point(newX, newY));
            });
        }

        private string ExtractEmbeddedWebUI()
        {
            var tempDir = Path.Combine(Path.GetTempPath(), "ZapretGUI_UI_" + AppConstants.AppVersion);
            try
            {
                Directory.CreateDirectory(tempDir);
                using var stream = System.Reflection.Assembly.GetExecutingAssembly().GetManifestResourceStream("wwwroot.zip");
                if (stream != null)
                {
                    using var archive = new ZipArchive(stream);
                    archive.ExtractToDirectory(tempDir, overwriteFiles: true);
                }
            }
            catch { }
            return tempDir;
        }
    }
}