using Microsoft.Web.WebView2.Core;
using System;
using System.IO;
using System.IO.Compression;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Media.Animation;
using ZapretGUI.Core;

namespace ZapretGUI
{
    public partial class MainWindow : Window
    {
        private readonly TrayIconManager _trayIconManager;
        private WebBridge? _webBridge;
        private readonly bool _isFirstRun;

        public MainWindow()
        {
            InitializeComponent();

            var configPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "config.json");
            _isFirstRun = !File.Exists(configPath);

            SettingsManager.Load();
            UIHelper.ApplyThemeColors();

            if (SettingsManager.Current.CompactMode)
            {
                this.Width = 850;
                this.Height = 520;
            }

            if (!SettingsManager.Current.HardwareAcceleration)
            {
                RenderOptions.ProcessRenderMode = RenderMode.SoftwareOnly;
            }

            _trayIconManager = new TrayIconManager(this);

            this.PreviewKeyDown += (s, e) =>
            {
                if (e.Key == System.Windows.Input.Key.K &&
                    (System.Windows.Input.Keyboard.Modifiers & System.Windows.Input.ModifierKeys.Control) == System.Windows.Input.ModifierKeys.Control)
                {
                    e.Handled = true;
                    _webBridge?.SendEvent("toggleCommandPalette", new { });
                }
            };

            _ = InitializeAppAsync();
        }

        private async Task InitializeAppAsync()
        {
            var modManager = new ModManager();
            modManager.InitializeFolders();
            await modManager.SyncActiveBatModsAsync();
            await modManager.ApplyListModsAsync();

            await InitializeWebViewAsync();

            BypassController.Current.NetMonitor.Start();

            if (!_isFirstRun)
                _ = CheckUpdatesOnStartupAsync();
        }

        private async Task InitializeWebViewAsync()
        {
            var userDataFolder = Path.Combine(Path.GetTempPath(), "ZapretGUI_WebView2");
            var env = await CoreWebView2Environment.CreateAsync(null, userDataFolder);
            await MainWebView.EnsureCoreWebView2Async(env);

            MainWebView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
            MainWebView.CoreWebView2.Settings.IsZoomControlEnabled = false;

            _webBridge = new WebBridge(MainWebView, this, _isFirstRun);
            MainWebView.CoreWebView2.WebMessageReceived += (s, e) =>
            {
                _webBridge.HandleMessage(e.WebMessageAsJson);
            };

            var baseDir = AppDomain.CurrentDomain.BaseDirectory;
            var webRootDir = ExtractEmbeddedWebUI();
            var htmlPath = Path.Combine(webRootDir, "index.html");

            if (File.Exists(htmlPath))
            {
                MainWebView.CoreWebView2.Navigate(new Uri(htmlPath).AbsoluteUri);
            }

            if (!File.Exists(htmlPath))
            {
                var rootFallback = Path.GetFullPath(Path.Combine(baseDir, @"..\..\..\index.html"));
                if (File.Exists(rootFallback))
                    htmlPath = rootFallback;
            }

            if (File.Exists(htmlPath))
            {
                MainWebView.CoreWebView2.Navigate(new Uri(htmlPath).AbsoluteUri);
            }
        }

        private async Task CheckUpdatesOnStartupAsync()
        {
            var stopServicesAction = () => { if (IsBypassRunning()) ToggleBypass(); };
            var progress = new Progress<string>(status =>
                _webBridge?.SendEvent("log", new { message = $"[Updater] {status}", time = DateTime.Now.ToString("HH:mm:ss"), isProgress = status.Contains("Скачивание:") || status.Contains("Скачано:") }));
            await UpdateManager.RunUpdateWorkflowAsync(isManualCheck: false, stopServicesAction, progress);
        }

        public void UpdateIndicators(bool isZapretRunning, bool isProxyRunning)
        {
            _webBridge?.SendEvent("bypassState", new
            {
                isRunning = isZapretRunning || isProxyRunning,
                zapretRunning = isZapretRunning,
                proxyRunning = isProxyRunning
            });
        }

        public void UpdateNetworkIndicator(bool isOnline)
        {
            _webBridge?.SendEvent("netStatus", new { isOnline });
        }

        public void ShowNotification(string title, string message, System.Windows.Forms.ToolTipIcon icon = System.Windows.Forms.ToolTipIcon.Info)
        {
            _trayIconManager.ShowNotification(title, message, icon);
        }

        private void Window_Closing(object sender, System.ComponentModel.CancelEventArgs e)
        {
            if (SettingsManager.Current.MinimizeOnClose)
            {
                e.Cancel = true;
                this.Hide();
                ShowNotification("Программа работает в фоне", "Zapret свернут в системный трей. Дважды кликните по иконке в трее, чтобы открыть окно.");
            }
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
            Dispatcher.Invoke(() =>
            {
                var targetWidth = isCompact ? 850 : 1100;
                var targetHeight = isCompact ? 520 : 760;

                if (Math.Abs(this.ActualWidth - targetWidth) < 2 && Math.Abs(this.ActualHeight - targetHeight) < 2)
                    return;

                var duration = new Duration(TimeSpan.FromMilliseconds(320));
                var ease = new CubicEase { EasingMode = EasingMode.EaseOut };

                var deltaW = targetWidth - this.ActualWidth;
                var deltaH = targetHeight - this.ActualHeight;

                var widthAnim = new DoubleAnimation(this.ActualWidth, targetWidth, duration) { EasingFunction = ease };
                var heightAnim = new DoubleAnimation(this.ActualHeight, targetHeight, duration) { EasingFunction = ease };
                var leftAnim = new DoubleAnimation(this.Left, this.Left - deltaW / 2, duration) { EasingFunction = ease };
                var topAnim = new DoubleAnimation(this.Top, this.Top - deltaH / 2, duration) { EasingFunction = ease };

                this.BeginAnimation(Window.WidthProperty, widthAnim);
                this.BeginAnimation(Window.HeightProperty, heightAnim);
                this.BeginAnimation(Window.LeftProperty, leftAnim);
                this.BeginAnimation(Window.TopProperty, topAnim);
            });
        }

        protected override void OnClosed(EventArgs e)
        {
            BypassController.Current.NetMonitor.Stop();
            _webBridge?.Dispose();
            _trayIconManager.Dispose();
            base.OnClosed(e);
        }
        private string ExtractEmbeddedWebUI()
        {
            var tempDir = Path.Combine(Path.GetTempPath(), "ZapretGUI_UI_" + AppConstants.AppVersion);
            if (!Directory.Exists(tempDir))
            {
                Directory.CreateDirectory(tempDir);
                using var stream = System.Reflection.Assembly.GetExecutingAssembly().GetManifestResourceStream("wwwroot.zip");
                if (stream != null)
                {
                    using var archive = new System.IO.Compression.ZipArchive(stream);
                    archive.ExtractToDirectory(tempDir);
                }
            }
            return tempDir;
        }
    }
}