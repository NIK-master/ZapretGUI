using System;
using System.IO;
using System.Threading.Tasks;
using System.Windows;
using Microsoft.Web.WebView2.Core;
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

            _trayIconManager = new TrayIconManager(this);

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
            var htmlPath = Path.Combine(baseDir, "wwwroot", "index.html");

            if (!File.Exists(htmlPath))
            {
                var projectRootHtml = Path.GetFullPath(Path.Combine(baseDir, @"..\..\..\wwwroot\index.html"));
                if (File.Exists(projectRootHtml))
                    htmlPath = projectRootHtml;
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

        public void AnimateWindowSize(bool isCompact)
        {
            Dispatcher.Invoke(() =>
            {
                this.Width = isCompact ? 850 : 1100;
                this.Height = isCompact ? 520 : 760;
            });
        }

        protected override void OnClosed(EventArgs e)
        {
            BypassController.Current.NetMonitor.Stop();
            _trayIconManager.Dispose();
            base.OnClosed(e);
        }
    }
}