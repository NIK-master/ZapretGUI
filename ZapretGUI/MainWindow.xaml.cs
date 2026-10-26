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

        public MainWindow()
        {
            InitializeComponent();

            var configPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "config.json");
            var isFirstRun = !File.Exists(configPath);

            SettingsManager.Load();
            UIHelper.ApplyThemeColors();

            if (isFirstRun)
            {
                var wizard = new Views.WizardWindow();
                wizard.ShowDialog();
                SettingsManager.Save();
            }

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
            _ = CheckUpdatesOnStartupAsync();
        }

        private async Task InitializeWebViewAsync()
        {
            var userDataFolder = Path.Combine(Path.GetTempPath(), "ZapretGUI_WebView2");
            var env = await CoreWebView2Environment.CreateAsync(null, userDataFolder);
            await MainWebView.EnsureCoreWebView2Async(env);

            MainWebView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
            MainWebView.CoreWebView2.Settings.IsZoomControlEnabled = false;

            _webBridge = new WebBridge(MainWebView, this);
            MainWebView.CoreWebView2.WebMessageReceived += (s, e) =>
            {
                _webBridge.HandleMessage(e.WebMessageAsJson);
            };

            // 1. Ищем index.html рядом с .exe (для Release)
            var baseDir = AppDomain.CurrentDomain.BaseDirectory;
            var htmlPath = Path.Combine(baseDir, "wwwroot", "index.html");

            // 2. Если в bin еще не скопировалось — ищем в корне проекта (удобно для Debug)
            if (!File.Exists(htmlPath))
            {
                var projectRootHtml = Path.GetFullPath(Path.Combine(baseDir, @"..\..\..\wwwroot\index.html"));
                if (File.Exists(projectRootHtml))
                    htmlPath = projectRootHtml;
            }

            // 3. Также проверяем случай, если index.html лежит прямо в корне проекта
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
            else
            {
                MainWebView.NavigateToString($@"
                    <body style='background:#09090B;color:white;font-family:sans-serif;padding:40px;'>
                        <h2 style='color:#EF4444;'>Файл wwwroot/index.html не найден!</h2>
                        <p>Убедитесь, что в проекте создана папка <b>wwwroot</b> и внутри неё лежит файл <b>index.html</b>.</p>
                        <p style='color:#888;font-family:monospace;'>Ожидаемый путь: {htmlPath}</p>
                    </body>");
            }
        }

        private async Task CheckUpdatesOnStartupAsync()
        {
            var stopServicesAction = () => { if (IsBypassRunning()) ToggleBypass(); };
            var progress = new Progress<string>(status =>
                _webBridge?.SendEvent("log", new { message = $"[Updater] {status}", time = DateTime.Now.ToString("HH:mm:ss") }));
            await UpdateManager.RunUpdateWorkflowAsync(isManualCheck: false, stopServicesAction, progress);
        }

        // Методы совместимости для системного трея (TrayIconManager)
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