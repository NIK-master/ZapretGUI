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
using ZapretGUI.Core.Plugins;
using System.Linq;

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
        public PluginManager PluginLoader { get; private set; }

        private string _currentWebRoot = "";

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
            // Надежная папка кэша WebView2 с автоматическим фолбэком в ProgramData
            string webViewDataPath = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
                AppConstants.AppRegistryName,
                "WebView2Cache");

            try
            {
                Directory.CreateDirectory(webViewDataPath);
            }
            catch
            {
                webViewDataPath = Path.Combine(Path.GetTempPath(), "ZapretForADHD_WebView2");
                Directory.CreateDirectory(webViewDataPath);
            }

            Environment.SetEnvironmentVariable("WEBVIEW2_USER_DATA_FOLDER", webViewDataPath);
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
                .SetTemporaryFilesPath(webViewDataPath) // <-- ВАЖНО: Передает путь напрямую в C++ ядро Photino!
                .SetUseOsDefaultSize(false)
                .SetSize(initialSize)
                .Center()
                .SetChromeless(true)
                .SetResizable(false)
                .SetTopMost(SettingsManager.Current.AlwaysOnTop)
                .SetContextMenuEnabled(false)
                .SetDevToolsEnabled(true);


            _webBridge = new WebBridge(this, _isFirstRun);

            var modApi = new ModAPI(_webBridge);
            PluginLoader = new PluginManager(modApi);

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

        public async Task LoadActivePluginsAsync()
        {
            var modManager = new ModManager();
            var allPluginMods = new List<ModMetaData>();

            var libs = await modManager.GetAvailableModsAsync(ModType.Library);
            var plugins = await modManager.GetAvailableModsAsync(ModType.Plugin);

            // Автоматически добавляем найденные плагины в активные, если список еще пуст
            bool settingsChanged = false;
            foreach (var p in plugins)
            {
                if (!SettingsManager.Current.ActivePluginMods.Contains(p.Id))
                {
                    SettingsManager.Current.ActivePluginMods.Add(p.Id);
                    settingsChanged = true;
                }
            }
            foreach (var l in libs)
            {
                if (!SettingsManager.Current.ActiveLibraryMods.Contains(l.Id))
                {
                    SettingsManager.Current.ActiveLibraryMods.Add(l.Id);
                    settingsChanged = true;
                }
            }
            if (settingsChanged) SettingsManager.Save();

            allPluginMods.AddRange(libs.Where(m => SettingsManager.Current.ActiveLibraryMods.Contains(m.Id)).Select(m => m.Meta));
            allPluginMods.AddRange(plugins.Where(m => SettingsManager.Current.ActivePluginMods.Contains(m.Id)).Select(m => m.Meta));

            PluginLoader.LoadPlugins(allPluginMods);
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

            if (File.Exists(Path.Combine(devWebRootDir, "index.html")))
                _currentWebRoot = devWebRootDir;
            else if (File.Exists(Path.Combine(localWebRootDir, "index.html")))
                _currentWebRoot = localWebRootDir;
            else
                _currentWebRoot = ExtractEmbeddedWebUI();

            // Собираем рабочий интерфейс с учетом всех активных модов-тем
            string htmlPath = BuildActiveWebUI(_currentWebRoot);

            // Загружаем напрямую в Photino (как в оригинальной рабочей версии)
            Window.Load(htmlPath);
            Window.WaitForClose();
        }

        public string BuildActiveWebUI(string baseWebRootDir)
        {
            // Создаем гарантированно УНИКАЛЬНУЮ папку для каждой сессии, чтобы избежать любых блокировок файлов (File In Use)
            string sessionId = Guid.NewGuid().ToString("N").Substring(0, 8);
            string targetRootDir = Path.Combine(Path.GetTempPath(), $"ZapretGUI_UI_{AppConstants.AppVersion}_{sessionId}");

            try
            {
                if (Directory.Exists(targetRootDir))
                    Directory.Delete(targetRootDir, true);

                // 1. Копируем оригинальный wwwroot в безопасную временную зону
                CopyDirectoryRecursive(baseWebRootDir, targetRootDir);

                // 2. Накатываем активные темы поверх базового интерфейса
                var activeThemes = SettingsManager.Current.ActiveThemeMods;
                if (activeThemes != null && activeThemes.Count > 0)
                {
                    var themesBaseDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, AppConstants.ModsDirectory, "themes");
                    foreach (var themeId in activeThemes)
                    {
                        var themeDir = Path.Combine(themesBaseDir, themeId);
                        if (Directory.Exists(themeDir))
                        {
                            CopyDirectoryRecursive(themeDir, targetRootDir);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[WebUI Builder Error]: {ex.Message}");
                targetRootDir = baseWebRootDir; // Фолбэк на оригинал при критической ошибке ФС
            }

            return BuildBundledHtmlIfNeeded(targetRootDir);
        }

        private static void CopyDirectoryRecursive(string sourceDir, string targetDir)
        {
            Directory.CreateDirectory(targetDir);

            foreach (var file in Directory.GetFiles(sourceDir))
            {
                var fileName = Path.GetFileName(file);
                // Не копируем служебный манифест мода в корень wwwroot
                if (fileName.Equals("mod.json", StringComparison.OrdinalIgnoreCase))
                    continue;

                var destFile = Path.Combine(targetDir, fileName);
                File.Copy(file, destFile, overwrite: true);
            }

            foreach (var subDir in Directory.GetDirectories(sourceDir))
            {
                var dirName = Path.GetFileName(subDir);
                CopyDirectoryRecursive(subDir, Path.Combine(targetDir, dirName));
            }
        }

        private string GetMimeType(string path)
        {
            var ext = Path.GetExtension(path).ToLowerInvariant();
            return ext switch
            {
                ".html" => "text/html",
                ".css" => "text/css",
                ".js" => "application/javascript",
                ".json" => "application/json",
                ".png" => "image/png",
                ".jpg" or ".jpeg" => "image/jpeg",
                ".svg" => "image/svg+xml",
                ".woff" => "font/woff",
                ".woff2" => "font/woff2",
                ".wav" => "audio/wav",
                _ => "application/octet-stream"
            };
        }

        private static string BuildBundledHtmlIfNeeded(string webRootDir)
        {
            var indexPath = Path.Combine(webRootDir, "index.html");
            if (!File.Exists(indexPath)) return indexPath;

            try
            {
                var html = File.ReadAllText(indexPath);

                // Вставляем partials (вкладки)
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

                // Инжектим файлы тем, если они есть
                if (File.Exists(Path.Combine(webRootDir, "theme.css")) && !html.Contains("href=\"theme.css\""))
                {
                    html = html.Replace("</head>", "\t<link rel=\"stylesheet\" href=\"theme.css\">\r\n</head>");
                }
                if (File.Exists(Path.Combine(webRootDir, "theme.js")) && !html.Contains("src=\"theme.js\""))
                {
                    html = html.Replace("</body>", "\t<script src=\"theme.js\"></script>\r\n</body>");
                }

                // Генерируем уникальное имя файла для 100% защиты от конфликтов чтения/записи
                var bundledPath = Path.Combine(webRootDir, $"index.bundled.{Guid.NewGuid():N}.html");
                File.WriteAllText(bundledPath, html, System.Text.Encoding.UTF8);

                return bundledPath;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[HTML Bundler Error]: {ex.Message}");
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
            PluginLoader?.UnloadAll();
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
            try
            {
                if (BypassController.Current.IsRunning)
                    BypassController.Current.StopServices();
                else
                {
                    await BypassController.Current.StartServicesAsync(
                        SettingsManager.Current.SelectedProfileName,
                        SettingsManager.Current.ZapretEnabled,
                        SettingsManager.Current.TgProxyEnabled);
                }

                UpdateIndicators(BypassController.Current.Zapret.IsRunning, BypassController.Current.TgProxy.IsRunning);
            }
            catch (Exception ex)
            {
                BypassController.Current.StopServices();
                UpdateIndicators(false, false);
                InvokeOnUI(() => ShowNotification("Ошибка запуска обхода", ex.Message, ToolTipIcon.Error));
            }
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
        private Size _savedPreEasterSize;
        private Point _savedPreEasterLoc;
        private bool _isEasterFullscreen = false;

        public async void SetEasterEggFullscreen(bool enable)
        {
            if (!_isWindowCreated || _isEasterFullscreen == enable) return;
            _isEasterFullscreen = enable;

            _resizeAnimCts?.Cancel();
            _resizeAnimCts = new CancellationTokenSource();
            var token = _resizeAnimCts.Token;

            Size startSize = default;
            Point startLoc = default;
            Size targetSize = default;
            Point targetLoc = default;

            InvokeOnUI(() =>
            {
                startSize = Window.Size;
                startLoc = Window.Location;

                var screen = WindowHandle != IntPtr.Zero
                    ? Screen.FromHandle(WindowHandle).WorkingArea
                    : Screen.PrimaryScreen!.WorkingArea;

                if (enable)
                {
                    _savedPreEasterSize = startSize;
                    _savedPreEasterLoc = startLoc;
                    targetSize = new Size(screen.Width, screen.Height);
                    targetLoc = new Point(screen.Left, screen.Top);
                }
                else
                {
                    targetSize = _savedPreEasterSize.Width > 0
                        ? _savedPreEasterSize
                        : GetScaledWindowSize(SettingsManager.Current.CompactMode);
                    targetLoc = _savedPreEasterLoc.IsEmpty
                        ? new Point(
                            screen.Left + (screen.Width - targetSize.Width) / 2,
                            screen.Top + (screen.Height - targetSize.Height) / 2)
                        : _savedPreEasterLoc;
                }
            });

            const int steps = 16;
            for (int i = 1; i <= steps; i++)
            {
                if (token.IsCancellationRequested) return;

                double t = (double)i / steps;
                // Cubic Ease-Out для плавного торможения в конце
                double ease = 1.0 - Math.Pow(1.0 - t, 3.0);

                int curW = (int)Math.Round(startSize.Width + (targetSize.Width - startSize.Width) * ease);
                int curH = (int)Math.Round(startSize.Height + (targetSize.Height - startSize.Height) * ease);
                int curX = (int)Math.Round(startLoc.X + (targetLoc.X - startLoc.X) * ease);
                int curY = (int)Math.Round(startLoc.Y + (targetLoc.Y - startLoc.Y) * ease);

                InvokeOnUI(() =>
                {
                    Window.SetSize(new Size(curW, curH));
                    Window.SetLocation(new Point(curX, curY));
                });

                await Task.Delay(12);
            }
        }
    }
}