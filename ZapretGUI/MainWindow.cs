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

        private const int SW_HIDE = 0;
        private const int SW_SHOWNORMAL = 1;
        private const int SW_SHOWMINIMIZED = 2;
        private const int SW_RESTORE = 9;

        public PhotinoWindow Window { get; }
        private readonly TrayIconManager _trayIconManager;
        private WebBridge? _webBridge;
        private readonly bool _isFirstRun;
        private bool _isForceExiting = false;

        public IntPtr WindowHandle => Window.WindowHandle;

        public MainWindow()
        {
            var configPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "config.json");
            _isFirstRun = !File.Exists(configPath);

            SettingsManager.Load();
            UIHelper.ApplyThemeColors();

            int initW = SettingsManager.Current.CompactMode ? 850 : 1100;
            int initH = SettingsManager.Current.CompactMode ? 520 : 760;

            Window = new PhotinoWindow()
                .SetTitle("Zapret for ADHD")
                .SetUseOsDefaultSize(false)
                .SetSize(new Size(initW, initH))
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

        public async void AnimateWindowSize(bool isCompact)
        {
            var targetWidth = isCompact ? 850 : 1100;
            var targetHeight = isCompact ? 520 : 760;

            var startSize = Window.Size;
            var startLoc = Window.Location;

            if (Math.Abs(startSize.Width - targetWidth) < 2 && Math.Abs(startSize.Height - targetHeight) < 2)
                return;

            const int steps = 14;
            for (int i = 1; i <= steps; i++)
            {
                double t = (double)i / steps;
                double ease = 1 - Math.Pow(1 - t, 3);

                int curW = (int)Math.Round(startSize.Width + (targetWidth - startSize.Width) * ease);
                int curH = (int)Math.Round(startSize.Height + (targetHeight - startSize.Height) * ease);

                int curX = startLoc.X - (curW - startSize.Width) / 2;
                int curY = startLoc.Y - (curH - startSize.Height) / 2;

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