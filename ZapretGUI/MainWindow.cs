using Photino.NET;
using System;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Runtime.InteropServices;
using System.Threading;
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

        private const int NormalLogicalWidth = 1100;
        private const int NormalLogicalHeight = 760;
        private const int CompactLogicalWidth = 850;
        private const int CompactLogicalHeight = 520;

        public PhotinoWindow Window { get; }
        private TrayIconManager? _trayIconManager;
        private WebBridge? _webBridge;
        private readonly bool _isFirstRun;
        private bool _isForceExiting = false;
        private bool _isWindowCreated = false;
        private CancellationTokenSource? _resizeAnimCts;

        // Безопасное получение дескриптора окна только после физического создания HWND
        public IntPtr WindowHandle
        {
            get
            {
                if (!_isWindowCreated || Window == null)
                    return IntPtr.Zero;
                try
                {
                    return Window.WindowHandle;
                }
                catch
                {
                    return IntPtr.Zero;
                }
            }
        }

        public MainWindow()
        {
            Environment.SetEnvironmentVariable("WEBVIEW2_DEFAULT_BACKGROUND_COLOR", "FF0A0A0A");
            Environment.SetEnvironmentVariable("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", "--disable-pinch --force-device-scale-factor=1");

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
                _isWindowCreated = true;

                try
                {
                    var exactSize = GetScaledWindowSize(SettingsManager.Current.CompactMode);
                    Window.SetSize(exactSize);
                    Window.Center();
                }
                catch { }

                _trayIconManager = new TrayIconManager(this);
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
        }

        private double GetDpiScale()
        {
            try
            {
                IntPtr hwnd = WindowHandle;
                uint dpi = hwnd != IntPtr.Zero
                    ? GetDpiForWindow(hwnd)
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
            var devWebRootDir = Path.GetFullPath(Path.Combine(baseDir, @"..\..\..\wwwroot"));
            var localWebRootDir = Path.Combine(baseDir, "wwwroot");

            string webRootDir;
            if (File.Exists(Path.Combine(devWebRootDir, "index.html")))
            {
                webRootDir = devWebRootDir;
            }
            else if (File.Exists(Path.Combine(localWebRootDir, "index.html")))
            {
                webRootDir = localWebRootDir;
            }
            else
            {
                webRootDir = ExtractEmbeddedWebUI();
            }

            string htmlPath = BuildBundledHtmlIfNeeded(webRootDir);
            Window.Load(htmlPath);
            Window.WaitForClose();
        }

        private static string BuildBundledHtmlIfNeeded(string webRootDir)
        {
            var indexPath = Path.Combine(webRootDir, "index.html");
            if (!File.Exists(indexPath)) return indexPath;

            try
            {
                var html = File.ReadAllText(indexPath);
                if (!html.Contains("<!-- @include "))
                    return indexPath;

                var partialsDir = Path.Combine(webRootDir, "partials");
                if (Directory.Exists(partialsDir))
                {
                    foreach (var file in Directory.GetFiles(partialsDir, "*.html"))
                    {
                        var fileName = Path.GetFileName(file);
                        var token = $"<!-- @include partials/{fileName} -->";
                        if (html.Contains(token))
                        {
                            html = html.Replace(token, File.ReadAllText(file));
                        }
                    }
                }

                var bundledPath = Path.Combine(webRootDir, "index.bundled.html");
                File.WriteAllText(bundledPath, html, System.Text.Encoding.UTF8);
                return bundledPath;
            }
            catch
            {
                return indexPath;
            }
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
            var stopServicesAction = () =>
            {
                if (BypassController.Current.IsRunning)
                {
                    BypassController.Current.StopServices();
                    UpdateIndicators(false, false);
                }
            };
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
            IntPtr hwnd = WindowHandle;
            if (hwnd == IntPtr.Zero) return;
            try
            {
                SendMessage(hwnd, WM_SETICON, ICON_SMALL, icon.Handle);
                SendMessage(hwnd, WM_SETICON, ICON_BIG, icon.Handle);
            }
            catch { }
        }

        public void MinimizeWindow()
        {
            IntPtr hwnd = WindowHandle;
            if (hwnd != IntPtr.Zero)
                ShowWindow(hwnd, SW_SHOWMINIMIZED);
        }

        public void HideToTray()
        {
            IntPtr hwnd = WindowHandle;
            if (hwnd != IntPtr.Zero)
                ShowWindow(hwnd, SW_HIDE);
        }

        public void RestoreFromTray()
        {
            IntPtr hwnd = WindowHandle;
            if (hwnd != IntPtr.Zero)
            {
                ShowWindow(hwnd, SW_RESTORE);
                ShowWindow(hwnd, SW_SHOWNORMAL);
                SetForegroundWindow(hwnd);
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
            _resizeAnimCts?.Cancel();
            BypassController.Current.NetMonitor.Stop();
            if (SettingsManager.Current.StopServicesOnExit)
                BypassController.Current.StopServices();

            _webBridge?.Dispose();
            _trayIconManager?.Dispose();
        }

        public void InvokeOnUI(Action action)
        {
            if (!_isWindowCreated || Window == null)
                return;

            try
            {
                Window.Invoke(action);
            }
            catch { }
        }

        public void UpdateIndicators(bool isZapretRunning, bool isProxyRunning)
        {
            var anyRunning = isZapretRunning || isProxyRunning;
            _trayIconManager?.UpdateDynamicIcon(anyRunning);
            _webBridge?.SendEvent("bypassState", new
            {
                isRunning = anyRunning,
                zapretRunning = isZapretRunning,
                proxyRunning = isProxyRunning
            });
        }

        public void RefreshAppIcon()
        {
            _trayIconManager?.UpdateDynamicIcon(BypassController.Current.IsRunning);
        }

        public void UpdateNetworkIndicator(bool isOnline)
        {
            _webBridge?.SendEvent("netStatus", new { isOnline });
        }

        public void ShowNotification(string title, string message, ToolTipIcon icon = ToolTipIcon.Info)
        {
            _trayIconManager?.ShowNotification(title, message, icon);
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

        public async void AnimateWindowSize(bool isCompact)
        {
            if (!_isWindowCreated) return;

            _resizeAnimCts?.Cancel();
            _resizeAnimCts = new CancellationTokenSource();
            var token = _resizeAnimCts.Token;

            Size targetSize = default;
            Size startSize = default;
            Point startLoc = default;
            int targetX = 0, targetY = 0;

            InvokeOnUI(() =>
            {
                targetSize = GetScaledWindowSize(isCompact);
                startSize = Window.Size;
                startLoc = Window.Location;

                var screen = WindowHandle != IntPtr.Zero
                    ? Screen.FromHandle(WindowHandle).WorkingArea
                    : Screen.PrimaryScreen!.WorkingArea;

                targetX = startLoc.X - (targetSize.Width - startSize.Width) / 2;
                targetY = startLoc.Y - (targetSize.Height - startSize.Height) / 2;
                targetX = Math.Max(screen.Left, Math.Min(targetX, screen.Right - targetSize.Width));
                targetY = Math.Max(screen.Top, Math.Min(targetY, screen.Bottom - targetSize.Height));
            });

            if (Math.Abs(startSize.Width - targetSize.Width) < 2 &&
                Math.Abs(startSize.Height - targetSize.Height) < 2)
            {
                return;
            }

            const int steps = 14;
            for (int i = 1; i <= steps; i++)
            {
                if (token.IsCancellationRequested) return;

                double t = (double)i / steps;
                double ease = 1.0 - Math.Pow(1.0 - t, 3.0);

                int curW = (int)Math.Round(startSize.Width + (targetSize.Width - startSize.Width) * ease);
                int curH = (int)Math.Round(startSize.Height + (targetSize.Height - startSize.Height) * ease);
                int curX = (int)Math.Round(startLoc.X + (targetX - startLoc.X) * ease);
                int curY = (int)Math.Round(startLoc.Y + (targetY - startLoc.Y) * ease);

                InvokeOnUI(() =>
                {
                    Window.SetSize(new Size(curW, curH));
                    Window.SetLocation(new Point(curX, curY));
                });

                await Task.Delay(14);
            }
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