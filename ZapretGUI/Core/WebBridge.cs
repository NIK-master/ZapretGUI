using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Runtime.InteropServices;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Interop;
using System.Windows.Media;
using Microsoft.Web.WebView2.Wpf;

namespace ZapretGUI.Core
{
    public class WebBridge : IDisposable
    {
        [DllImport("user32.dll")]
        private static extern bool ReleaseCapture();

        [DllImport("user32.dll")]
        private static extern IntPtr SendMessage(IntPtr hWnd, int Msg, int wParam, int lParam);
        private readonly WebView2 _webView;
        private readonly Window _mainWindow;
        private readonly ModManager _modManager = new ModManager();
        private bool _isFirstRun;

        private FileSystemWatcher? _modsWatcher;
        private CancellationTokenSource? _watcherDebounceCts;
        private bool _isInternalFileOp = false;
        private TaskCompletionSource<bool>? _pendingConfirmTcs;

        private static readonly JsonSerializerOptions _jsonOptions = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            PropertyNameCaseInsensitive = true
        };

        public WebBridge(WebView2 webView, Window mainWindow, bool isFirstRun = false)
        {
            _webView = webView;
            _mainWindow = mainWindow;
            _isFirstRun = isFirstRun;

            _modManager.InitializeFolders();
            SetupLiveModsWatcher();

            // Подключаем веб-диалоги для UpdateManager и UIHelper
            UIHelper.WebAlertHandler = (title, message, isError) =>
            {
                SendEvent("alert", new { title, message, isError });
            };

            UIHelper.WebConfirmHandler = (title, message, confirmText, isDanger) =>
            {
                _pendingConfirmTcs?.TrySetResult(false);
                _pendingConfirmTcs = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
                SendEvent("askConfirm", new { title, message, confirmText, isDanger });
                return _pendingConfirmTcs.Task;
            };

            BypassController.Current.OnLog += msg => SendEvent("log", new
            {
                message = msg,
                time = DateTime.Now.ToString("HH:mm:ss"),
                isProgress = msg.Contains("Скачивание:") || msg.Contains("Скачано:")
            });

            BypassController.Current.NetMonitor.StatsUpdated += (rx, tx) =>
            {
                SendEvent("netStats", new
                {
                    download = Math.Round(rx, 1),
                    upload = Math.Round(tx, 1),
                    zapretRunning = BypassController.Current.Zapret.IsRunning,
                    proxyRunning = BypassController.Current.TgProxy.IsRunning
                });
            };

            BypassController.Current.NetMonitor.StatusChanged += async isOnline =>
            {
                SendEvent("netStatus", new { isOnline });

                if (isOnline && SettingsManager.Current.AutoRestartServices && BypassController.Current.IsRunning)
                {
                    SendEvent("log", new
                    {
                        message = "🔄 [AutoRestart] Сеть восстановлена. Перезапуск служб обхода...",
                        time = DateTime.Now.ToString("HH:mm:ss"),
                        isProgress = false
                    });

                    await BypassController.Current.RestartServicesAsync(SettingsManager.Current.SelectedProfileName);
                    SendEvent("bypassState", new
                    {
                        isRunning = BypassController.Current.IsRunning,
                        zapretRunning = BypassController.Current.Zapret.IsRunning,
                        proxyRunning = BypassController.Current.TgProxy.IsRunning
                    });
                }
            };

            BypassController.Current.Scanner.ConfigTested += (file, ok, total) =>
            {
                SendEvent("configTested", new { fileName = file, ok, total });
            };

            BypassController.Current.Scanner.ScanCompleted += topConfigs =>
            {
                if (topConfigs.Count > 0)
                {
                    SettingsManager.Current.SelectedProfileName = topConfigs[0];
                    SettingsManager.Save();
                }
                SendEvent("scanCompleted", new
                {
                    topConfigs,
                    bestConfig = topConfigs.FirstOrDefault() ?? ""
                });
            };

            BypassController.Current.Scanner.ScanFailed += ex =>
            {
                SendEvent("scanFailed", new { error = ex.Message });
            };
        }

        private void SetupLiveModsWatcher()
        {
            var modsPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, AppConstants.ModsDirectory);
            if (!Directory.Exists(modsPath)) Directory.CreateDirectory(modsPath);

            _modsWatcher = new FileSystemWatcher(modsPath)
            {
                IncludeSubdirectories = true,
                NotifyFilter = NotifyFilters.FileName | NotifyFilters.DirectoryName | NotifyFilters.LastWrite,
                EnableRaisingEvents = true
            };

            FileSystemEventHandler handler = (s, e) =>
            {
                if (_isInternalFileOp) return;
                _watcherDebounceCts?.Cancel();
                _watcherDebounceCts = new CancellationTokenSource();
                var token = _watcherDebounceCts.Token;

                Task.Run(async () =>
                {
                    try
                    {
                        await Task.Delay(350, token);
                        if (token.IsCancellationRequested) return;
                        await _modManager.ApplyListModsAsync();
                        await _modManager.SyncActiveBatModsAsync();
                        await BroadcastModsAndProfilesAsync();
                    }
                    catch { }
                });
            };

            _modsWatcher.Changed += handler;
            _modsWatcher.Created += handler;
            _modsWatcher.Deleted += handler;
            _modsWatcher.Renamed += (s, e) => handler(s, e);
        }

        public void SendEvent(string eventName, object payload)
        {
            try
            {
                _mainWindow.Dispatcher.InvokeAsync(() =>
                {
                    if (_webView.CoreWebView2 != null)
                    {
                        var json = JsonSerializer.Serialize(new { type = eventName, data = payload }, _jsonOptions);
                        _webView.CoreWebView2.PostWebMessageAsJson(json);
                    }
                });
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Ошибка отправки в WebView2: {ex.Message}");
            }
        }

        public async void HandleMessage(string rawJson)
        {
            try
            {
                using var doc = JsonDocument.Parse(rawJson);
                var root = doc.RootElement;

                if (root.ValueKind == JsonValueKind.String)
                {
                    using var innerDoc = JsonDocument.Parse(root.GetString() ?? "{}");
                    await ProcessActionAsync(innerDoc.RootElement.Clone());
                }
                else
                {
                    await ProcessActionAsync(root.Clone());
                }
            }
            catch (Exception ex)
            {
                SendEvent("log", new { message = $"❌ ОШИБКА: {ex.Message}", time = DateTime.Now.ToString("HH:mm:ss") });
            }
        }

        private async Task ProcessActionAsync(JsonElement root)
        {
            if (!root.TryGetProperty("action", out var actionProp)) return;
            var action = actionProp.GetString() ?? "";

            switch (action)
            {
                case "init":
                    await SendInitialStateAsync();
                    break;

                case "confirmResponse":
                    var accepted = root.TryGetProperty("accepted", out var acc) && acc.GetBoolean();
                    _pendingConfirmTcs?.TrySetResult(accepted);
                    break;

                case "runWizardSetup":
                    await HandleRunWizardSetupAsync(root);
                    break;

                case "skipWizard":
                    _isFirstRun = false;
                    SettingsManager.Save();
                    break;

                case "windowDrag":
                    _mainWindow.Dispatcher.Invoke(() =>
                    {
                        try
                        {
                            var hwnd = new WindowInteropHelper(_mainWindow).Handle;
                            ReleaseCapture();
                            SendMessage(hwnd, 0xA1 /* WM_NCLBUTTONDOWN */, 0x2 /* HT_CAPTION */, 0);
                        }
                        catch { }
                    });
                    break;

                case "windowMinimize":
                    _mainWindow.Dispatcher.Invoke(() => _mainWindow.WindowState = WindowState.Minimized);
                    break;

                case "windowClose":
                    _mainWindow.Dispatcher.Invoke(() => _mainWindow.Close());
                    break;

                case "playClick":
                    AudioHelper.PlayClick();
                    break;

                case "playSuccess":
                    AudioHelper.PlaySuccess();
                    break;

                case "openUrl":
                    var url = root.GetProperty("url").GetString() ?? "";
                    if (!string.IsNullOrWhiteSpace(url))
                        Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
                    break;

                case "toggleBypass":
                    await HandleToggleBypassAsync(root);
                    break;

                case "restartBypass":
                    await BypassController.Current.RestartServicesAsync(SettingsManager.Current.SelectedProfileName);
                    SendEvent("bypassState", new
                    {
                        isRunning = BypassController.Current.IsRunning,
                        zapretRunning = BypassController.Current.Zapret.IsRunning,
                        proxyRunning = BypassController.Current.TgProxy.IsRunning
                    });
                    break;

                case "updateModuleToggles":
                    if (root.TryGetProperty("useZapret", out var uz)) SettingsManager.Current.ZapretEnabled = uz.GetBoolean();
                    if (root.TryGetProperty("useProxy", out var up)) SettingsManager.Current.TgProxyEnabled = up.GetBoolean();
                    SettingsManager.Save();
                    break;

                case "selectProfile":
                    var prof = root.GetProperty("profile").GetString() ?? "general.bat";
                    var prevChanged = !string.Equals(SettingsManager.Current.SelectedProfileName, prof, StringComparison.OrdinalIgnoreCase);
                    SettingsManager.Current.SelectedProfileName = prof;
                    SettingsManager.Save();
                    SendEvent("profileSelected", new { profile = prof });

                    if (prevChanged && BypassController.Current.Zapret.IsRunning)
                    {
                        SendEvent("log", new
                        {
                            message = $"🔄 Переключение конфига на {prof}...",
                            time = DateTime.Now.ToString("HH:mm:ss"),
                            isProgress = false
                        });
                        await BypassController.Current.RestartServicesAsync(prof);
                        SendEvent("bypassState", new
                        {
                            isRunning = BypassController.Current.IsRunning,
                            zapretRunning = BypassController.Current.Zapret.IsRunning,
                            proxyRunning = BypassController.Current.TgProxy.IsRunning
                        });
                    }
                    break;

                case "ping":
                    var pingMs = await BypassController.Current.CheckPingAsync();
                    SendEvent("pingResult", new { ping = pingMs });
                    break;

                case "startScan":
                    SettingsManager.Current.FirstTimeScanPrompted = true;
                    SettingsManager.Save();

                    if (BypassController.Current.Scanner.IsScanning)
                    {
                        BypassController.Current.Scanner.CancelScan();
                        SendEvent("scanState", new { isScanning = false });
                    }
                    else
                    {
                        SendEvent("scanState", new { isScanning = true });
                        await BypassController.Current.Scanner.StartScanAsync();
                        SendEvent("scanState", new { isScanning = false });
                    }
                    break;

                case "markFirstScanPrompted":
                    SettingsManager.Current.FirstTimeScanPrompted = true;
                    SettingsManager.Save();
                    break;

                case "saveGameFilter":
                    await HandleSaveGameFilterAsync(root);
                    break;

                case "exportLogs":
                    HandleExportLogs(root);
                    break;

                case "getMods":
                    await BroadcastModsAndProfilesAsync();
                    break;

                case "generateModId":
                    var baseName = root.TryGetProperty("baseName", out var bn) ? bn.GetString() ?? "mod" : "mod";
                    var genId = _modManager.GenerateUniqueModId(baseName);
                    SendEvent("modIdGenerated", new { id = genId, isTaken = false });
                    break;

                case "checkModId":
                    var candidate = root.GetProperty("id").GetString() ?? "";
                    var cleanId = ModManager.SanitizeModId(candidate);
                    var isTaken = string.IsNullOrEmpty(cleanId) || _modManager.IsModIdTaken(cleanId);
                    SendEvent("modIdChecked", new { cleanId, isTaken, isEmpty = string.IsNullOrEmpty(cleanId) });
                    break;

                case "createMod":
                    await HandleCreateModAsync(root);
                    break;

                case "toggleMod":
                    await HandleToggleModAsync(root);
                    break;

                case "disableAllMods":
                    await HandleDisableAllModsAsync(root);
                    break;

                case "deleteMod":
                    await HandleDeleteModAsync(root);
                    break;

                case "getModContent":
                    await HandleGetModContentAsync(root);
                    break;

                case "validateBatMod":
                    var modTitle = root.GetProperty("name").GetString() ?? "Скрипт";
                    var batCode = root.GetProperty("content").GetString() ?? "";
                    var (isValid, errMsg) = _modManager.ValidateBatMod(modTitle, batCode);
                    SendEvent("batValidationResult", new { isValid, errorMessage = errMsg });
                    break;

                case "saveModContent":
                    await HandleSaveModContentAsync(root);
                    break;

                case "importMod":
                    await HandleImportModAsync();
                    break;

                case "importDroppedFile":
                    await HandleImportDroppedFileAsync(root);
                    break;

                case "exportMod":
                    await HandleExportModAsync(root);
                    break;

                case "runDiagnostics":
                    await HandleRunDiagnosticsAsync();
                    break;

                case "saveSettings":
                    HandleSaveSettings(root.GetProperty("settings"));
                    break;

                case "setIpSetMode":
                    HandleSetIpSetMode(root);
                    break;

                case "updateIpSet":
                    await HandleUpdateIpSetAsync();
                    break;

                case "updateHosts":
                    await HandleUpdateHostsAsync(root);
                    break;

                case "clearHosts":
                    HandleClearHosts();
                    break;

                case "checkUpdates":
                    await HandleCheckUpdatesManualAsync();
                    break;

                case "resetSettings":
                    await HandleResetSettingsAsync();
                    break;

                case "openFolder":
                    var folderType = root.GetProperty("folder").GetString();
                    var targetPath = folderType switch
                    {
                        "mods" => Path.Combine(AppDomain.CurrentDomain.BaseDirectory, AppConstants.ModsDirectory),
                        "zapret" => Path.Combine(AppDomain.CurrentDomain.BaseDirectory, AppConstants.CoreFilesDirectory),
                        _ => AppDomain.CurrentDomain.BaseDirectory
                    };
                    if (!Directory.Exists(targetPath)) Directory.CreateDirectory(targetPath);
                    Process.Start("explorer.exe", targetPath);
                    break;


            }
        }

        private async Task HandleRunWizardSetupAsync(JsonElement root)
        {
            var useZapret = root.TryGetProperty("useZapret", out var uz) ? uz.GetBoolean() : true;
            var useTgProxy = root.TryGetProperty("useTgProxy", out var ut) ? ut.GetBoolean() : true;
            var autoStart = root.TryGetProperty("autoStart", out var aus) ? aus.GetBoolean() : true;
            var focusMode = root.TryGetProperty("focusMode", out var fm) ? fm.GetBoolean() : false;
            var colorblind = root.TryGetProperty("colorblind", out var cb) ? cb.GetBoolean() : false;

            void WizLog(string msg) => SendEvent("wizardLog", new
            {
                message = msg,
                time = DateTime.Now.ToString("HH:mm:ss"),
                isProgress = msg.Contains("Скачивание:") || msg.Contains("Скачано:")
            });

            WizLog("Инициализация модуля установки...");
            await Task.Delay(200);

            SettingsManager.Current.ZapretEnabled = useZapret;
            SettingsManager.Current.TgProxyEnabled = useTgProxy;
            SettingsManager.Current.FocusMode = focusMode;
            SettingsManager.Current.ColorblindMode = colorblind;

            WizLog("[Config] Сохранение пользовательских настроек UI...");
            SettingsManager.Save();
            UIHelper.ApplyThemeColors();
            await Task.Delay(150);

            if (autoStart)
            {
                WizLog("[System] Регистрация приложения в автозагрузке Windows...");
                StartupHelper.SetAutoStart(true);
                await Task.Delay(150);
            }

            WizLog("Проверка директорий...");
            var zapretDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, AppConstants.CoreFilesDirectory);
            if (!Directory.Exists(zapretDir))
            {
                WizLog($"[FS] Создание директории: {zapretDir}");
                Directory.CreateDirectory(zapretDir);
            }

            if (useZapret || useTgProxy)
            {
                WizLog("=====================================");
                WizLog("Запуск загрузки выбранных ядер...");
                var progress = new Progress<string>(status => WizLog($"[Download] {status}"));

                try
                {
                    await UpdateManager.InstallModulesSilentAsync(useZapret, useTgProxy, progress);
                    WizLog("✅ Модули успешно загружены и распакованы.");
                }
                catch (Exception ex)
                {
                    WizLog($"[ERROR] Ошибка при загрузке: {ex.Message}");
                }
                WizLog("=====================================");
            }

            WizLog("Сборка завершена.");
            WizLog("✅ Настройка успешно завершена. Можно закрывать окно.");

            _isFirstRun = false;
            SendEvent("wizardCompleted", new { });
            await SendInitialStateAsync();
        }

        private object GetRoutingStatusObj()
        {
            var (ipMode, ipCount, ipStatusText) = ServiceToolsManager.GetIpSetStatus();
            var (hostsApplied, hostsCount) = ServiceToolsManager.GetHostsStatus();

            return new
            {
                ipMode,
                ipCount,
                ipStatusText,
                hostsApplied,
                hostsCount,
                hostsStatusText = hostsApplied ? $"Активен ({hostsCount} домен.)" : "Не применен"
            };
        }

        private void HandleSetIpSetMode(JsonElement root)
        {
            var targetMode = root.GetProperty("mode").GetString() ?? "loaded";
            try
            {
                ServiceToolsManager.SetIpSetMode(targetMode);
                SendEvent("routingStatusUpdated", GetRoutingStatusObj());
            }
            catch (Exception ex)
            {
                SendEvent("alert", new { title = "Режим IPSet", message = ex.Message, isError = true });
                SendEvent("routingStatusUpdated", GetRoutingStatusObj());
            }
        }

        private async Task HandleUpdateIpSetAsync()
        {
            try
            {
                int count = await ServiceToolsManager.UpdateIpSetFromWebAsync();
                SendEvent("routingStatusUpdated", GetRoutingStatusObj());
                SendEvent("alert", new { title = "База IPSet обновлена", message = $"Список ipset-all.txt успешно загружен из репозитория Flowseal!\nВсего подсетей в базе: {count}", isError = false });
            }
            catch (Exception ex)
            {
                SendEvent("routingStatusUpdated", GetRoutingStatusObj());
                SendEvent("alert", new { title = "Ошибка обновления IPSet", message = $"Не удалось обновить список IPSet:\n{ex.Message}", isError = true });
            }
        }

        private async Task HandleUpdateHostsAsync(JsonElement root)
        {
            int sourceIdx = root.TryGetProperty("sourceIndex", out var si) ? Math.Clamp(si.GetInt32(), 0, 3) : SettingsManager.Current.HostsSourceIndex;
            SettingsManager.Current.HostsSourceIndex = sourceIdx;
            SettingsManager.Save();

            try
            {
                int count = await ServiceToolsManager.UpdateSystemHostsAsync(sourceIdx);
                SendEvent("routingStatusUpdated", GetRoutingStatusObj());
                SendEvent("alert", new { title = "Файл Hosts обновлен", message = $"В системный файл hosts успешно записано {count} актуальных правил маршрутизации, а DNS-кэш Windows очищен!\n\nВаши личные записи в файле hosts были бережно сохранены.", isError = false });
            }
            catch (UnauthorizedAccessException)
            {
                SendEvent("routingStatusUpdated", GetRoutingStatusObj());
                SendEvent("alert", new { title = "Требуются права администратора", message = "Для изменения системного файла C:\\Windows\\System32\\drivers\\etc\\hosts перезапустите программу от имени Администратора!", isError = true });
            }
            catch (Exception ex)
            {
                SendEvent("routingStatusUpdated", GetRoutingStatusObj());
                SendEvent("alert", new { title = "Ошибка обновления Hosts", message = $"Не удалось обновить системный файл hosts:\n{ex.Message}", isError = true });
            }
        }

        private void HandleClearHosts()
        {
            try
            {
                ServiceToolsManager.ClearZapretHosts();
                SendEvent("routingStatusUpdated", GetRoutingStatusObj());
                SendEvent("alert", new { title = "Готово", message = "Записи Zapret успешно удалены из системного файла hosts, DNS-кэш сброшен.", isError = false });
            }
            catch (UnauthorizedAccessException)
            {
                SendEvent("alert", new { title = "Требуются права администратора", message = "Для изменения системного файла hosts запустите программу от имени Администратора!", isError = true });
            }
            catch (Exception ex)
            {
                SendEvent("alert", new { title = "Ошибка", message = $"Не удалось очистить файл hosts:\n{ex.Message}", isError = true });
            }
        }

        private async Task HandleCheckUpdatesManualAsync()
        {
            Action stopServicesAction = () =>
            {
                if (_mainWindow is MainWindow mw && mw.IsBypassRunning())
                    mw.ToggleBypass();
            };

            var progress = new Progress<string>(status =>
                SendEvent("log", new { message = $"[Updater] {status}", time = DateTime.Now.ToString("HH:mm:ss"), isProgress = status.Contains("Скачивание:") || status.Contains("Скачано:") }));

            await UpdateManager.RunUpdateWorkflowAsync(isManualCheck: true, stopServicesAction, progress);
            await BroadcastModsAndProfilesAsync();
            SendEvent("updatesCheckFinished", new { });
        }

        private async Task HandleResetSettingsAsync()
        {
            try
            {
                var settingsPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "config.json");
                if (File.Exists(settingsPath))
                    File.Delete(settingsPath);

                StartupHelper.SetAutoStart(false);

                SettingsManager.Load();
                ServiceToolsManager.SyncGameFilterFile();
                UIHelper.ApplyThemeColors();

                if (_mainWindow is MainWindow mw)
                    mw.AnimateWindowSize(SettingsManager.Current.CompactMode);

                await SendInitialStateAsync();
                SendEvent("alert", new { title = "Готово", message = "Настройки успешно сброшены к состоянию по умолчанию.", isError = false });
            }
            catch (Exception ex)
            {
                SendEvent("alert", new { title = "Ошибка сброса", message = $"Ошибка при сбросе: {ex.Message}", isError = true });
            }
        }

        private async Task BroadcastModsAndProfilesAsync()
        {
            var batMods = await _modManager.GetAvailableModsAsync(ModType.BatStrategy);
            var listMods = await _modManager.GetAvailableModsAsync(ModType.DomainList);
            var profiles = GetBatProfiles();

            SendEvent("modsUpdated", new
            {
                batMods,
                listMods,
                profiles,
                selectedProfile = SettingsManager.Current.SelectedProfileName
            });
        }

        private async Task HandleCreateModAsync(JsonElement root)
        {
            var isBat = root.GetProperty("isBat").GetBoolean();
            var rawId = root.GetProperty("id").GetString() ?? "";
            var name = root.GetProperty("name").GetString() ?? "";
            var author = root.GetProperty("author").GetString() ?? "Аноним";
            var desc = root.GetProperty("description").GetString() ?? "";

            var id = ModManager.SanitizeModId(rawId);
            if (string.IsNullOrEmpty(id) || _modManager.IsModIdTaken(id))
            {
                SendEvent("alert", new { title = "Конфликт ID", message = "Мод с таким ID уже существует! Нажмите 🎲 для генерации уникального ID.", isError = true });
                return;
            }

            var folderName = isBat ? "strategies" : "lists";
            var modFolderPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, AppConstants.ModsDirectory, folderName, id);

            try
            {
                _isInternalFileOp = true;
                Directory.CreateDirectory(modFolderPath);

                var meta = new ModMetaData
                {
                    UniqueId = id,
                    Name = string.IsNullOrWhiteSpace(name) ? id : name.Trim(),
                    Author = string.IsNullOrWhiteSpace(author) ? "Аноним" : author.Trim(),
                    Version = "1.0",
                    Description = desc.Trim(),
                    IsBatStrategy = isBat
                };

                var jsonPath = Path.Combine(modFolderPath, "mod.json");
                await File.WriteAllTextAsync(jsonPath, JsonSerializer.Serialize(meta, new JsonSerializerOptions { WriteIndented = true }));

                if (isBat)
                {
                    var defaultBat = ":: Шаблон стратегии обхода\r\n" +
                                     "\"%BIN%winws.exe\" --wf-tcp=80,443 --wf-udp=443,50000-50100 ^\r\n" +
                                     "--filter-udp=443 --hostlist=\"%LISTS%list-general.txt\" --dpi-desync=fake --dpi-desync-repeats=6 ^\r\n" +
                                     "--new ^\r\n" +
                                     "--filter-tcp=80,443 --hostlist=\"%LISTS%list-general.txt\" --dpi-desync=fake,split2\r\n";
                    await File.WriteAllTextAsync(Path.Combine(modFolderPath, "strategy.bat"), defaultBat);
                }
                else
                {
                    await File.WriteAllTextAsync(Path.Combine(modFolderPath, "list.txt"), "");
                }

                SendEvent("modCreated", new { id, isBat });
                await BroadcastModsAndProfilesAsync();
            }
            catch (Exception ex)
            {
                SendEvent("alert", new { title = "Ошибка", message = $"Ошибка при создании мода: {ex.Message}", isError = true });
            }
            finally
            {
                _isInternalFileOp = false;
            }
        }

        private async Task HandleToggleModAsync(JsonElement root)
        {
            var id = root.GetProperty("id").GetString() ?? "";
            var isBat = root.GetProperty("isBat").GetBoolean();
            var modName = root.TryGetProperty("name", out var n) ? n.GetString() ?? id : id;

            try
            {
                _isInternalFileOp = true;
                var list = isBat ? SettingsManager.Current.ActiveBatMods : SettingsManager.Current.ActiveListMods;
                bool nowActive;

                if (list.Contains(id))
                {
                    list.Remove(id);
                    nowActive = false;
                }
                else
                {
                    list.Add(id);
                    nowActive = true;
                }

                if (isBat)
                    await _modManager.SyncActiveBatModsAsync();
                else
                    await _modManager.ApplyListModsAsync();

                SettingsManager.Save();
                await BroadcastModsAndProfilesAsync();

                if (!isBat && BypassController.Current.Zapret.IsRunning)
                {
                    var word = nowActive ? "включен" : "отключен";
                    SendEvent("promptRestartZapret", new { reason = $"Список доменов «{modName}» был {word}." });
                }
            }
            finally
            {
                _isInternalFileOp = false;
            }
        }

        private async Task HandleDisableAllModsAsync(JsonElement root)
        {
            var isBat = root.GetProperty("isBat").GetBoolean();
            try
            {
                _isInternalFileOp = true;
                if (isBat)
                {
                    SettingsManager.Current.ActiveBatMods.Clear();
                    await _modManager.SyncActiveBatModsAsync();
                }
                else
                {
                    SettingsManager.Current.ActiveListMods.Clear();
                    await _modManager.ApplyListModsAsync();
                }

                SettingsManager.Save();
                await BroadcastModsAndProfilesAsync();

                if (!isBat && BypassController.Current.Zapret.IsRunning)
                    SendEvent("promptRestartZapret", new { reason = "Все дополнительные списки доменов были отключены." });
            }
            finally
            {
                _isInternalFileOp = false;
            }
        }

        private async Task HandleDeleteModAsync(JsonElement root)
        {
            var id = root.GetProperty("id").GetString() ?? "";
            var isBat = root.GetProperty("isBat").GetBoolean();
            var modName = root.TryGetProperty("name", out var n) ? n.GetString() ?? id : id;

            try
            {
                _isInternalFileOp = true;
                var list = isBat ? SettingsManager.Current.ActiveBatMods : SettingsManager.Current.ActiveListMods;
                var wasActiveList = !isBat && list.Contains(id);

                var folderName = isBat ? "strategies" : "lists";
                var modFolderPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, AppConstants.ModsDirectory, folderName, id);

                if (Directory.Exists(modFolderPath))
                    Directory.Delete(modFolderPath, true);

                if (list.Remove(id))
                {
                    if (isBat) await _modManager.SyncActiveBatModsAsync();
                    else await _modManager.ApplyListModsAsync();
                    SettingsManager.Save();
                }

                await BroadcastModsAndProfilesAsync();

                if (wasActiveList && BypassController.Current.Zapret.IsRunning)
                    SendEvent("promptRestartZapret", new { reason = $"Активный список доменов «{modName}» был удален." });
            }
            catch (Exception ex)
            {
                SendEvent("alert", new { title = "Ошибка удаления", message = $"Не удалось удалить мод: {ex.Message}", isError = true });
            }
            finally
            {
                _isInternalFileOp = false;
            }
        }

        private async Task HandleGetModContentAsync(JsonElement root)
        {
            var id = root.GetProperty("id").GetString() ?? "";
            var isBat = root.GetProperty("isBat").GetBoolean();

            var folderName = isBat ? "strategies" : "lists";
            var fileName = isBat ? "strategy.bat" : "list.txt";
            var modFolder = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, AppConstants.ModsDirectory, folderName, id);
            var filePath = Path.Combine(modFolder, fileName);
            var jsonPath = Path.Combine(modFolder, "mod.json");

            if (!File.Exists(filePath))
            {
                SendEvent("alert", new { title = "Ошибка", message = $"Файл {fileName} не найден в папке мода!", isError = true });
                return;
            }

            var content = await File.ReadAllTextAsync(filePath);
            ModMetaData meta = new ModMetaData { UniqueId = id, Name = id, IsBatStrategy = isBat };
            if (File.Exists(jsonPath))
            {
                try
                {
                    var m = JsonSerializer.Deserialize<ModMetaData>(await File.ReadAllTextAsync(jsonPath), _jsonOptions);
                    if (m != null) meta = m;
                }
                catch { }
            }

            SendEvent("modContentLoaded", new
            {
                id,
                isBat,
                fileName,
                meta,
                content
            });
        }

        private async Task HandleSaveModContentAsync(JsonElement root)
        {
            var id = root.GetProperty("id").GetString() ?? "";
            var isBat = root.GetProperty("isBat").GetBoolean();
            var name = root.GetProperty("name").GetString() ?? id;
            var author = root.GetProperty("author").GetString() ?? "Аноним";
            var version = root.GetProperty("version").GetString() ?? "1.0";
            var desc = root.GetProperty("description").GetString() ?? "";
            var content = root.GetProperty("content").GetString() ?? "";
            var bypassWarning = root.TryGetProperty("bypassWarning", out var bw) && bw.GetBoolean();

            var editedModName = string.IsNullOrWhiteSpace(name) ? id : name.Trim();

            if (isBat && !bypassWarning)
            {
                var (isValid, errMsg) = _modManager.ValidateBatMod(editedModName, content);
                if (!isValid)
                {
                    SendEvent("modSaveSyntaxWarning", new { errorMessage = errMsg });
                    return;
                }
            }

            try
            {
                _isInternalFileOp = true;
                var folderName = isBat ? "strategies" : "lists";
                var fileName = isBat ? "strategy.bat" : "list.txt";
                var modFolder = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, AppConstants.ModsDirectory, folderName, id);

                var meta = new ModMetaData
                {
                    UniqueId = id,
                    Name = editedModName,
                    Author = string.IsNullOrWhiteSpace(author) ? "Аноним" : author.Trim(),
                    Version = string.IsNullOrWhiteSpace(version) ? "1.0" : version.Trim(),
                    Description = desc.Trim(),
                    IsBatStrategy = isBat
                };

                await File.WriteAllTextAsync(Path.Combine(modFolder, "mod.json"), JsonSerializer.Serialize(meta, new JsonSerializerOptions { WriteIndented = true }));
                await File.WriteAllTextAsync(Path.Combine(modFolder, fileName), content);

                if (isBat) await _modManager.SyncActiveBatModsAsync();
                else await _modManager.ApplyListModsAsync();

                SettingsManager.Save();
                SendEvent("modContentSaved", new { id });
                await BroadcastModsAndProfilesAsync();

                bool isActiveList = !isBat && SettingsManager.Current.ActiveListMods.Contains(id);
                if (isActiveList && BypassController.Current.Zapret.IsRunning)
                {
                    SendEvent("promptRestartZapret", new { reason = $"Содержимое активного списка «{editedModName}» было обновлено." });
                }
            }
            catch (Exception ex)
            {
                SendEvent("alert", new { title = "Ошибка сохранения", message = ex.Message, isError = true });
            }
            finally
            {
                _isInternalFileOp = false;
            }
        }

        private async Task HandleImportModAsync()
        {
            string? selectedFile = null;
            _mainWindow.Dispatcher.Invoke(() =>
            {
                var openFileDialog = new Microsoft.Win32.OpenFileDialog
                {
                    Filter = "Архивы модов (*.zip;*.netfix-mod)|*.zip;*.netfix-mod|Все файлы (*.*)|*.*",
                    Title = "Выберите архив с модом"
                };
                if (openFileDialog.ShowDialog() == true)
                    selectedFile = openFileDialog.FileName;
            });

            if (string.IsNullOrEmpty(selectedFile)) return;

            try
            {
                _isInternalFileOp = true;
                var meta = await _modManager.ImportModFromArchiveAsync(selectedFile);
                await BroadcastModsAndProfilesAsync();
                SendEvent("alert", new { title = "Импорт завершен", message = $"Мод «{meta.Name}» (ID: {meta.UniqueId}) успешно импортирован!", isError = false });
            }
            catch (Exception ex)
            {
                SendEvent("alert", new { title = "Ошибка импорта", message = ex.Message, isError = true });
            }
            finally
            {
                _isInternalFileOp = false;
            }
        }

        private async Task HandleImportDroppedFileAsync(JsonElement root)
        {
            var fileName = root.GetProperty("fileName").GetString() ?? "dropped_mod";
            var base64 = root.GetProperty("base64").GetString() ?? "";
            if (string.IsNullOrEmpty(base64)) return;

            var ext = Path.GetExtension(fileName).ToLowerInvariant();
            var bytes = Convert.FromBase64String(base64);

            if (ext == ".zip" || ext == ".netfix-mod")
            {
                var tempZip = Path.Combine(Path.GetTempPath(), "ZapretDrop_" + Guid.NewGuid().ToString("N") + ext);
                try
                {
                    _isInternalFileOp = true;
                    await File.WriteAllBytesAsync(tempZip, bytes);
                    var meta = await _modManager.ImportModFromArchiveAsync(tempZip, Path.GetFileNameWithoutExtension(fileName));

                    await BroadcastModsAndProfilesAsync();
                    AudioHelper.PlaySuccess();
                    SendEvent("alert", new { title = "Мод импортирован", message = $"Архив «{meta.Name}» (ID: {meta.UniqueId}) успешно установлен через Drag & Drop!", isError = false });
                }
                catch (Exception ex)
                {
                    SendEvent("alert", new { title = "Ошибка импорта", message = ex.Message, isError = true });
                }
                finally
                {
                    _isInternalFileOp = false;
                    try { if (File.Exists(tempZip)) File.Delete(tempZip); } catch { }
                }
            }
            else if (ext == ".bat" || ext == ".txt")
            {
                var isBat = ext == ".bat";
                var rawTitle = Path.GetFileNameWithoutExtension(fileName);
                var finalId = _modManager.GenerateUniqueModId(rawTitle);
                var folderName = isBat ? "strategies" : "lists";
                var modFolderPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, AppConstants.ModsDirectory, folderName, finalId);

                try
                {
                    _isInternalFileOp = true;
                    Directory.CreateDirectory(modFolderPath);

                    var meta = new ModMetaData
                    {
                        UniqueId = finalId,
                        Name = rawTitle,
                        Author = "Drag & Drop",
                        Version = "1.0",
                        Description = $"Создано автоматически из файла {fileName}",
                        IsBatStrategy = isBat
                    };

                    await File.WriteAllTextAsync(Path.Combine(modFolderPath, "mod.json"), JsonSerializer.Serialize(meta, new JsonSerializerOptions { WriteIndented = true }));
                    await File.WriteAllBytesAsync(Path.Combine(modFolderPath, isBat ? "strategy.bat" : "list.txt"), bytes);

                    await BroadcastModsAndProfilesAsync();
                    AudioHelper.PlaySuccess();
                    SendEvent("alert", new { title = "Файл превращен в мод!", message = $"Файл «{fileName}» автоматически упакован в мод «{rawTitle}» (ID: {finalId}).", isError = false });
                }
                catch (Exception ex)
                {
                    SendEvent("alert", new { title = "Ошибка создания мода", message = ex.Message, isError = true });
                }
                finally
                {
                    _isInternalFileOp = false;
                }
            }
        }

        private async Task HandleExportModAsync(JsonElement root)
        {
            var id = root.GetProperty("id").GetString() ?? "";
            var isBat = root.GetProperty("isBat").GetBoolean();
            var modName = root.TryGetProperty("name", out var n) ? n.GetString() ?? id : id;

            string? savePath = null;
            _mainWindow.Dispatcher.Invoke(() =>
            {
                var saveFileDialog = new Microsoft.Win32.SaveFileDialog
                {
                    Filter = "Архивы модов (*.zip)|*.zip|Мод NetFix (*.netfix-mod)|*.netfix-mod|Все файлы (*.*)|*.*",
                    Title = "Экспорт мода",
                    FileName = $"{id}_export.zip"
                };
                if (saveFileDialog.ShowDialog() == true)
                    savePath = saveFileDialog.FileName;
            });

            if (string.IsNullOrEmpty(savePath)) return;

            try
            {
                var folderName = isBat ? "strategies" : "lists";
                var modFolderPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, AppConstants.ModsDirectory, folderName, id);

                if (!Directory.Exists(modFolderPath))
                {
                    SendEvent("alert", new { title = "Ошибка", message = "Папка мода не найдена на диске!", isError = true });
                    return;
                }

                if (File.Exists(savePath)) File.Delete(savePath);
                await Task.Run(() => ZipFile.CreateFromDirectory(modFolderPath, savePath));

                SendEvent("alert", new { title = "Экспорт завершен", message = $"Мод «{modName}» (ID: {id}) успешно экспортирован и готов к отправке!", isError = false });
            }
            catch (Exception ex)
            {
                SendEvent("alert", new { title = "Ошибка экспорта", message = ex.Message, isError = true });
            }
        }

        private async Task SendInitialStateAsync()
        {
            var profiles = GetBatProfiles();
            var batMods = await _modManager.GetAvailableModsAsync(ModType.BatStrategy);
            var listMods = await _modManager.GetAvailableModsAsync(ModType.DomainList);

            SendEvent("initData", new
            {
                version = AppConstants.AppVersion,
                isFirstRun = _isFirstRun,
                settings = SettingsManager.Current,
                isAutoStart = StartupHelper.IsAutoStartEnabled(),
                zapretRunning = BypassController.Current.Zapret.IsRunning,
                proxyRunning = BypassController.Current.TgProxy.IsRunning,
                profiles,
                batMods,
                listMods,
                gameFilterStatus = ServiceToolsManager.GetGameFilterDisplayStatus(),
                routingStatus = GetRoutingStatusObj()
            });

            var pingMs = await BypassController.Current.CheckPingAsync();
            SendEvent("pingResult", new { ping = pingMs });
        }

        private List<string> GetBatProfiles() => BypassController.Current.Zapret.GetAvailableProfiles();

        private async Task HandleToggleBypassAsync(JsonElement root)
        {
            if (BypassController.Current.IsRunning)
            {
                BypassController.Current.StopServices();
                SendEvent("bypassState", new
                {
                    isRunning = false,
                    zapretRunning = false,
                    proxyRunning = false
                });
            }
            else
            {
                var profile = root.TryGetProperty("profile", out var p) ? p.GetString() ?? SettingsManager.Current.SelectedProfileName : SettingsManager.Current.SelectedProfileName;
                var useZapret = root.TryGetProperty("useZapret", out var z) ? z.GetBoolean() : SettingsManager.Current.ZapretEnabled;
                var useProxy = root.TryGetProperty("useProxy", out var t) ? t.GetBoolean() : SettingsManager.Current.TgProxyEnabled;

                if (!useZapret && !useProxy)
                {
                    SendEvent("log", new { message = "⚠ ОШИБКА: Нет выбранных модулей для запуска!", time = DateTime.Now.ToString("HH:mm:ss") });
                    SendEvent("errorGlitch", new { });
                    return;
                }

                SettingsManager.Current.SelectedProfileName = profile;
                SettingsManager.Current.ZapretEnabled = useZapret;
                SettingsManager.Current.TgProxyEnabled = useProxy;
                SettingsManager.Save();

                try
                {
                    await BypassController.Current.StartServicesAsync(profile, useZapret, useProxy);
                    AudioHelper.PlaySuccess();
                    SendEvent("log", new { message = "✅ Выбранные модули успешно запущены.", time = DateTime.Now.ToString("HH:mm:ss") });
                }
                catch (Exception ex)
                {
                    BypassController.Current.StopServices();
                    SendEvent("errorGlitch", new { });
                    foreach (var line in ex.Message.Split('\n', StringSplitOptions.RemoveEmptyEntries))
                        SendEvent("log", new { message = $"❌ ОШИБКА: {line.Trim()}", time = DateTime.Now.ToString("HH:mm:ss") });
                }

                SendEvent("bypassState", new
                {
                    isRunning = BypassController.Current.IsRunning,
                    zapretRunning = BypassController.Current.Zapret.IsRunning,
                    proxyRunning = BypassController.Current.TgProxy.IsRunning
                });
            }
        }

        private async Task HandleSaveGameFilterAsync(JsonElement root)
        {
            var mode = root.GetProperty("mode").GetString() ?? "disabled";
            var tcpRaw = root.GetProperty("tcp").GetString() ?? "1024-65535";
            var udpRaw = root.GetProperty("udp").GetString() ?? "1024-65535";
            var restartNow = root.TryGetProperty("restartIfRunning", out var r) && r.GetBoolean();

            if (!ServiceToolsManager.ValidatePortRange(tcpRaw, out string validTcp))
            {
                SendEvent("alert", new { title = "Ошибка портов TCP", message = "Указан некорректный диапазон портов TCP!\nПример правильного формата: 1024-65535 или 1024-1934,1936-65535", isError = true });
                return;
            }

            if (!ServiceToolsManager.ValidatePortRange(udpRaw, out string validUdp))
            {
                SendEvent("alert", new { title = "Ошибка портов UDP", message = "Указан некорректный диапазон портов UDP!\nПример правильного формата: 1024-65535", isError = true });
                return;
            }

            SettingsManager.Current.GameFilterMode = mode;
            SettingsManager.Current.GameFilterTcpRange = validTcp;
            SettingsManager.Current.GameFilterUdpRange = validUdp;

            ServiceToolsManager.SyncGameFilterFile();
            SettingsManager.Save();

            var statusText = ServiceToolsManager.GetGameFilterDisplayStatus();
            SendEvent("gameFilterSaved", new
            {
                mode,
                tcp = validTcp,
                udp = validUdp,
                statusText
            });

            SendEvent("log", new { message = $"🎮 Игровой фильтр обновлен: {statusText}", time = DateTime.Now.ToString("HH:mm:ss") });

            if (restartNow && BypassController.Current.Zapret.IsRunning)
            {
                await BypassController.Current.RestartServicesAsync(SettingsManager.Current.SelectedProfileName);
                SendEvent("bypassState", new
                {
                    isRunning = BypassController.Current.IsRunning,
                    zapretRunning = BypassController.Current.Zapret.IsRunning,
                    proxyRunning = BypassController.Current.TgProxy.IsRunning
                });
            }
        }

        private void HandleExportLogs(JsonElement root)
        {
            var logText = root.GetProperty("text").GetString() ?? "";
            _mainWindow.Dispatcher.Invoke(() =>
            {
                var saveFileDialog = new Microsoft.Win32.SaveFileDialog
                {
                    Filter = "Текстовые файлы (*.txt)|*.txt|Все файлы (*.*)|*.*",
                    DefaultExt = ".txt",
                    FileName = $"Zapret_Log_{DateTime.Now:yyyyMMdd_HHmmss}.txt"
                };

                if (saveFileDialog.ShowDialog() == true)
                {
                    File.WriteAllText(saveFileDialog.FileName, logText);
                    SendEvent("alert", new { title = "Экспорт завершен", message = "Лог событий успешно сохранен в файл!", isError = false });
                }
            });
        }

        private async Task HandleRunDiagnosticsAsync()
        {
            var report = await DiagnosticsEngine.RunFullDiagnosticsAsync((prog, text) =>
            {
                SendEvent("diagProgress", new { progress = Math.Round(prog * 100), status = text });
            });

            AudioHelper.PlaySuccess();
            SendEvent("diagResult", report);
        }

        private void HandleSaveSettings(JsonElement s)
        {
            var cur = SettingsManager.Current;

            if (s.TryGetProperty("autoStart", out var autoStart))
            {
                bool wantAuto = autoStart.GetBoolean();
                if (StartupHelper.IsAutoStartEnabled() != wantAuto)
                    StartupHelper.SetAutoStart(wantAuto);
            }

            if (s.TryGetProperty("startMinimized", out var sm)) cur.StartMinimized = sm.GetBoolean();
            if (s.TryGetProperty("minimizeOnClose", out var moc)) cur.MinimizeOnClose = moc.GetBoolean();
            if (s.TryGetProperty("notificationsEnabled", out var ne)) cur.NotificationsEnabled = ne.GetBoolean();
            if (s.TryGetProperty("focusMode", out var fm)) cur.FocusMode = fm.GetBoolean();

            if (s.TryGetProperty("compactMode", out var cm))
            {
                bool newCompact = cm.GetBoolean();
                if (cur.CompactMode != newCompact)
                {
                    cur.CompactMode = newCompact;
                    if (_mainWindow is MainWindow mw)
                        mw.AnimateWindowSize(newCompact);
                }
            }

            if (s.TryGetProperty("hardwareAcceleration", out var ha))
            {
                bool useGpu = ha.GetBoolean();
                if (cur.HardwareAcceleration != useGpu)
                {
                    cur.HardwareAcceleration = useGpu;
                    _mainWindow.Dispatcher.Invoke(() =>
                    {
                        RenderOptions.ProcessRenderMode = useGpu ? RenderMode.Default : RenderMode.SoftwareOnly;
                    });
                }
            }

            if (s.TryGetProperty("colorblindMode", out var cb))
            {
                bool newCb = cb.GetBoolean();
                if (cur.ColorblindMode != newCb)
                {
                    cur.ColorblindMode = newCb;
                    UIHelper.ApplyThemeColors();
                }
            }

            if (s.TryGetProperty("pingUrl", out var pu))
            {
                var urlStr = pu.GetString();
                cur.PingUrl = string.IsNullOrWhiteSpace(urlStr) ? AppConstants.DefaultPingUrl : urlStr.Trim();
            }

            if (s.TryGetProperty("statsUpdateInterval", out var sui))
                cur.StatsUpdateInterval = Math.Max(1, sui.GetInt32());

            if (s.TryGetProperty("autoRestartServices", out var ars))
                cur.AutoRestartServices = ars.GetBoolean();

            if (s.TryGetProperty("hostsSourceIndex", out var hsi))
                cur.HostsSourceIndex = Math.Clamp(hsi.GetInt32(), 0, 3);

            SettingsManager.Save();
        }
        public void Dispose()
        {
            _watcherDebounceCts?.Cancel();
            _watcherDebounceCts?.Dispose();
            _modsWatcher?.Dispose();
            _pendingConfirmTcs?.TrySetResult(false);
        }
    }
}