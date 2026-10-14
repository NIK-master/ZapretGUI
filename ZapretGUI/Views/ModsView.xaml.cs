using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using ZapretGUI.Core;

namespace ZapretGUI.Views
{
    public partial class ModsView : System.Windows.Controls.UserControl
    {
        private readonly ModManager _modManager;
        private ModType _currentTab = ModType.BatStrategy;

        private ObservableCollection<UIModItem> _availableMods = new();
        private ObservableCollection<UIModItem> _activeMods = new();

        private string _currentEditingFilePath = "";
        private string _currentEditingJsonPath = "";
        private UIModItem? _currentEditingMod = null;

        private Action? _pendingConfirmAction;
        private UIElement? _currentConfirmBlurTarget;

        private FileSystemWatcher? _modsWatcher;
        private CancellationTokenSource? _watcherDebounceCts;
        private bool _isInternalFileOperation = false;
        private bool _isAutoGeneratingId = false;

        private int _lastEditorLineCount = -1;

        public ModsView()
        {
            InitializeComponent();
            _modManager = new ModManager();
            _modManager.InitializeFolders();

            AvailableModsList.ItemsSource = _availableMods;
            ActiveModsList.ItemsSource = _activeMods;

            SetupLiveFileWatcher();

            SettingsManager.SettingsSaved += ApplyCompactLayout;
            ApplyCompactLayout();

            _ = SwitchTabAsync(ModType.BatStrategy);
        }

        private void ApplyCompactLayout()
        {
            Dispatcher.Invoke(() =>
            {
                var isCompact = SettingsManager.Current.CompactMode;

                RootModsGrid.Margin = isCompact ? new Thickness(12, 10, 12, 10) : new Thickness(20);
                TxtCategoryTitle.FontSize = isCompact ? 18 : 22;
                TxtCategoryDesc.Visibility = isCompact ? Visibility.Collapsed : Visibility.Visible;
                HeaderPanel.Margin = isCompact ? new Thickness(0, 0, 0, 4) : new Thickness(0, 0, 0, 10);

                SidebarColumn.Width = new GridLength(isCompact ? 54 : 210);
                SpacerColumn.Width = new GridLength(isCompact ? 12 : 18);
                ModsSidebarBorder.Padding = isCompact ? new Thickness(6, 10, 6, 10) : new Thickness(12);

                TxtSidebarHeader.Visibility = isCompact ? Visibility.Collapsed : Visibility.Visible;
                TxtStrategies.Visibility = isCompact ? Visibility.Collapsed : Visibility.Visible;
                TxtDomainLists.Visibility = isCompact ? Visibility.Collapsed : Visibility.Visible;
                TxtGuide.Visibility = isCompact ? Visibility.Collapsed : Visibility.Visible;

                IconStrategies.Margin = isCompact ? new Thickness(0) : new Thickness(0, 0, 10, 0);
                IconDomainLists.Margin = isCompact ? new Thickness(0) : new Thickness(0, 0, 10, 0);
                IconGuide.Margin = isCompact ? new Thickness(0) : new Thickness(0, 0, 10, 0);

                BtnStrategies.HorizontalContentAlignment = isCompact ? System.Windows.HorizontalAlignment.Center : System.Windows.HorizontalAlignment.Left;
                BtnDomainLists.HorizontalContentAlignment = isCompact ? System.Windows.HorizontalAlignment.Center : System.Windows.HorizontalAlignment.Left;
                BtnGuide.HorizontalContentAlignment = isCompact ? System.Windows.HorizontalAlignment.Center : System.Windows.HorizontalAlignment.Left;

                TxtBtnDisableAll.Text = isCompact ? "Откл. всё" : "Отключить всё";
                TxtBtnImport.Text = isCompact ? "Импорт" : "Импорт (.zip)";
                this.Resources["ModDetailsVisibility"] = isCompact ? Visibility.Collapsed : Visibility.Visible;

                EditorContentBorder.Padding = isCompact ? new Thickness(12) : new Thickness(18);
                EditorContentBorder.Margin = isCompact ? new Thickness(4) : new Thickness(10);
            });
        }

        private void SetupLiveFileWatcher()
        {
            var modsPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, AppConstants.ModsDirectory);
            if (!Directory.Exists(modsPath)) 
                Directory.CreateDirectory(modsPath);

            _modsWatcher = new FileSystemWatcher(modsPath)
            {
                IncludeSubdirectories = true,
                NotifyFilter = NotifyFilters.FileName | NotifyFilters.DirectoryName | NotifyFilters.LastWrite,
                EnableRaisingEvents = true
            };

            _modsWatcher.Changed += OnModsDirectoryChanged;
            _modsWatcher.Created += OnModsDirectoryChanged;
            _modsWatcher.Deleted += OnModsDirectoryChanged;
            _modsWatcher.Renamed += OnModsDirectoryChanged;
        }

        private void OnModsDirectoryChanged(object sender, FileSystemEventArgs e)
        {
            if (_isInternalFileOperation) 
                return;

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

                    await Dispatcher.InvokeAsync(async () =>
                    {
                        if (_currentTab == ModType.BatStrategy || _currentTab == ModType.DomainList)
                            await LoadCurrentModsAsync();
                    });
                }
                catch (TaskCanceledException) { }
                catch (Exception ex)
                {
                    Debug.WriteLine($"Ошибка live-обновления модов: {ex.Message}");
                }
            });
        }

        private void PromptRestartZapretIfNeeded(string reasonText)
        {
            if (BypassController.Current.Zapret.IsRunning())
            {
                ShowConfirmDialog(
                    "Перезапустить Zapret?",
                    $"{reasonText}\n\nФайл list-general.txt был обновлен в прямом эфире, но для применения новых доменов в уже работающем ядре winws.exe требуется перезапуск. Перезапустить сейчас?",
                    "🔄 Перезапустить",
                    (System.Windows.Media.Brush)System.Windows.Application.Current.Resources["BrandSuccessBrush"],
                    async () =>
                    {
                        if (System.Windows.Application.Current.MainWindow is MainWindow mw)
                            await mw.RestartBypassAsync();
                    });
            }
        }

        private async Task SwitchTabAsync(ModType type)
        {
            _currentTab = type;

            BtnStrategies.Background = System.Windows.Media.Brushes.Transparent;
            BtnStrategies.Foreground = UIHelper.GetBrushFromHex("#A0A0A0");
            BtnDomainLists.Background = System.Windows.Media.Brushes.Transparent;
            BtnDomainLists.Foreground = UIHelper.GetBrushFromHex("#A0A0A0");
            BtnGuide.Background = System.Windows.Media.Brushes.Transparent;
            BtnGuide.Foreground = UIHelper.GetBrushFromHex("#A0A0A0");

            if (type == ModType.BatStrategy || type == ModType.DomainList)
            {
                GuidePanel.Visibility = Visibility.Collapsed;
                ModsListsPanel.Visibility = Visibility.Visible;
                ActionButtonsPanel.Visibility = Visibility.Visible;

                if (type == ModType.BatStrategy)
                {
                    TxtCategoryTitle.Text = ".bat Стратегии";
                    TxtCategoryDesc.Text = "Пользовательские скрипты обхода для специфичных игр и задач.";
                    BtnStrategies.Background = UIHelper.GetBrushFromHex("#2A2A2A");
                    BtnStrategies.Foreground = System.Windows.Media.Brushes.White;
                }
                else
                {
                    TxtCategoryTitle.Text = "Листы доменов";
                    TxtCategoryDesc.Text = "Списки сайтов и сервисов для маршрутизации трафика (обновляются в прямом эфире).";
                    BtnDomainLists.Background = UIHelper.GetBrushFromHex("#2A2A2A");
                    BtnDomainLists.Foreground = System.Windows.Media.Brushes.White;
                }

                await LoadCurrentModsAsync();
            }
            else
            {
                TxtCategoryTitle.Text = "Руководство";
                TxtCategoryDesc.Text = "Ответы на частые вопросы и инструкции.";
                BtnGuide.Background = UIHelper.GetBrushFromHex("#2A2A2A");
                BtnGuide.Foreground = System.Windows.Media.Brushes.White;

                ModsListsPanel.Visibility = Visibility.Collapsed;
                ActionButtonsPanel.Visibility = Visibility.Collapsed;
                GuidePanel.Visibility = Visibility.Visible;
            }
        }

        private async Task LoadCurrentModsAsync()
        {
            _availableMods.Clear();
            _activeMods.Clear();

            var allMods = await _modManager.GetAvailableModsAsync(_currentTab);

            foreach (var mod in allMods)
            {
                if (mod.IsActive)
                    _activeMods.Add(mod);
                else
                    _availableMods.Add(mod);
            }

            UpdateHeadersVisibility();
        }

        private void UpdateHeadersVisibility()
        {
            ActiveModsHeader.Visibility = _activeMods.Count > 0 ? Visibility.Visible : Visibility.Collapsed;
            AvailableModsHeader.Visibility = _availableMods.Count > 0 ? Visibility.Visible : Visibility.Collapsed;
            ModsDivider.Visibility = (_activeMods.Count > 0 && _availableMods.Count > 0) ? Visibility.Visible : Visibility.Collapsed;
            EmptyStatePanel.Visibility = (_activeMods.Count == 0 && _availableMods.Count == 0) ? Visibility.Visible : Visibility.Collapsed;
        }

        private async void BtnStrategies_Click(object sender, RoutedEventArgs e) { AudioHelper.PlayClick(); await SwitchTabAsync(ModType.BatStrategy); }
        private async void BtnDomainLists_Click(object sender, RoutedEventArgs e) { AudioHelper.PlayClick(); await SwitchTabAsync(ModType.DomainList); }
        private async void BtnGuide_Click(object sender, RoutedEventArgs e) { AudioHelper.PlayClick(); await SwitchTabAsync(ModType.Guide); }

        private void BtnOpenModsFolder_Click(object sender, RoutedEventArgs e)
        {
            AudioHelper.PlayClick();
            var path = Path.Combine(System.AppDomain.CurrentDomain.BaseDirectory, AppConstants.ModsDirectory);
            if (Directory.Exists(path)) Process.Start("explorer.exe", path);
        }


        private void BtnCreateMod_Click(object sender, RoutedEventArgs e)
        {
            AudioHelper.PlayClick();

            TxtNewModName.Text = "Мой новый мод";
            TxtNewModAuthor.Text = "You";
            TxtNewModDesc.Text = "Описание мода";

            _isAutoGeneratingId = true;
            TxtNewModId.Text = _modManager.GenerateUniqueModId("custom_mod");
            _isAutoGeneratingId = false;
            ValidateNewModIdUI();

            AnimationHelper.ShowOverlay(CreateModOverlay, CreateContentBorder, ContentGrid);
        }

        private void BtnRegenerateId_Click(object sender, RoutedEventArgs e)
        {
            AudioHelper.PlayClick();
            _isAutoGeneratingId = true;
            string slug = ModManager.SanitizeModId(TxtNewModName.Text);
            TxtNewModId.Text = _modManager.GenerateUniqueModId(string.IsNullOrEmpty(slug) ? "mod" : slug);
            _isAutoGeneratingId = false;
            ValidateNewModIdUI();
        }

        private void TxtNewModName_TextChanged(object sender, TextChangedEventArgs e)
        {
            if (!IsLoaded) 
                return;

            var slug = ModManager.SanitizeModId(TxtNewModName.Text);
            if (!string.IsNullOrEmpty(slug))
            {
                _isAutoGeneratingId = true;
                TxtNewModId.Text = _modManager.GenerateUniqueModId(slug);
                _isAutoGeneratingId = false;
                ValidateNewModIdUI();
            }
        }

        private void TxtNewModId_TextChanged(object sender, TextChangedEventArgs e)
        {
            if (!IsLoaded || _isAutoGeneratingId) 
                return;

            ValidateNewModIdUI();
        }

        private bool ValidateNewModIdUI()
        {
            if (TxtNewModId == null || TxtIdValidationStatus == null || BtnConfirmCreateMod == null) 
                return false;

            var cleanId = ModManager.SanitizeModId(TxtNewModId.Text);
            if (string.IsNullOrEmpty(cleanId))
            {
                TxtIdValidationStatus.Text = "⚠ Введите корректный ID (a-z, 0-9)";
                TxtIdValidationStatus.Foreground = UIHelper.GetBrushFromHex("#F59E0B");
                BtnConfirmCreateMod.IsEnabled = false;
                return false;
            }

            if (_modManager.IsModIdTaken(cleanId))
            {
                TxtIdValidationStatus.Text = "❌ Такой ID уже занят!";
                TxtIdValidationStatus.Foreground = UIHelper.GetBrushFromHex("#F44336");
                BtnConfirmCreateMod.IsEnabled = false;
                return false;
            }

            TxtIdValidationStatus.Text = $"✓ ID «{cleanId}» уникален";
            TxtIdValidationStatus.Foreground = UIHelper.GetBrushFromHex("#4ADE80");
            BtnConfirmCreateMod.IsEnabled = true;
            return true;
        }

        private void BtnCloseCreateMod_Click(object sender, RoutedEventArgs e)
        {
            AudioHelper.PlayClick();
            AnimationHelper.HideOverlay(CreateModOverlay, CreateContentBorder, ContentGrid);
        }

        private async void BtnConfirmCreateMod_Click(object sender, RoutedEventArgs e)
        {
            AudioHelper.PlayClick();

            var id = ModManager.SanitizeModId(TxtNewModId.Text);
            if (string.IsNullOrEmpty(id) || _modManager.IsModIdTaken(id))
            {
                ShowAlertDialog("Конфликт ID", "Мод с таким ID уже существует в системе (в стратегиях или списках)! Нажмите 🎲 для генерации уникального ID.", isError: true);
                return;
            }

            var folderName = _currentTab == ModType.BatStrategy ? "strategies" : "lists";
            var modFolderPath = Path.Combine(System.AppDomain.CurrentDomain.BaseDirectory, AppConstants.ModsDirectory, folderName, id);

            try
            {
                _isInternalFileOperation = true;
                Directory.CreateDirectory(modFolderPath);

                var meta = new ModMetaData
                {
                    UniqueId = id,
                    Name = string.IsNullOrWhiteSpace(TxtNewModName.Text) ? id : TxtNewModName.Text.Trim(),
                    Author = string.IsNullOrWhiteSpace(TxtNewModAuthor.Text) ? "Аноним" : TxtNewModAuthor.Text.Trim(),
                    Version = "1.0",
                    Description = TxtNewModDesc.Text.Trim(),
                    IsBatStrategy = _currentTab == ModType.BatStrategy
                };

                var jsonPath = Path.Combine(modFolderPath, "mod.json");
                await File.WriteAllTextAsync(jsonPath, JsonSerializer.Serialize(meta, new JsonSerializerOptions { WriteIndented = true }));

                if (_currentTab == ModType.BatStrategy)
                {
                    var defaultBat = ":: Шаблон стратегии обхода\r\n" +
                                        "\"%BIN%winws.exe\" --wf-tcp=80,443 --wf-udp=443,50000-50100 ^\r\n" +
                                        "--filter-udp=443 --hostlist=\"%LISTS%list-general.txt\" --dpi-desync=fake --dpi-desync-repeats=6 ^\r\n" +
                                        "--new ^\r\n" +
                                        "--filter-tcp=80,443 --hostlist=\"%LISTS%list-general.txt\" --dpi-desync=fake,split2\r\n";
                    await File.WriteAllTextAsync(Path.Combine(modFolderPath, "strategy.bat"), defaultBat);
                }
                else
                    await File.WriteAllTextAsync(Path.Combine(modFolderPath, "list.txt"), "");

                AnimationHelper.HideOverlay(CreateModOverlay, CreateContentBorder, ContentGrid);
                await LoadCurrentModsAsync();
            }
            catch (Exception ex)
            {
                ShowAlertDialog("Ошибка", $"Ошибка при создании мода: {ex.Message}", isError: true);
            }
            finally
            {
                _isInternalFileOperation = false;
            }
        }

        private async void BtnToggleMod_Click(object sender, RoutedEventArgs e)
        {
            AudioHelper.PlayClick();

            if ((sender as FrameworkElement)?.DataContext is UIModItem mod)
            {
                var btn = sender as System.Windows.Controls.Button;
                var border = UIHelper.FindParent<System.Windows.Controls.Border>(btn, "ModCardContainer");

                if (border != null)
                    await AnimationHelper.SlideOutAndHideAsync(border, mod.IsActive);

                mod.IsActive = !mod.IsActive;

                if (mod.IsActive)
                {
                    _availableMods.Remove(mod);
                    _activeMods.Add(mod);
                }
                else
                {
                    _activeMods.Remove(mod);
                    _availableMods.Add(mod);
                }

                await SaveAndApplyModsAsync();
                UpdateHeadersVisibility();

                if (_currentTab == ModType.DomainList)
                {
                    var actionWord = mod.IsActive ? "включен" : "отключен";
                    PromptRestartZapretIfNeeded($"Список доменов «{mod.Meta.Name}» был {actionWord}.");
                }
            }
        }

        private async Task SaveAndApplyModsAsync()
        {
            _isInternalFileOperation = true;
            try
            {
                var activeStrategies = new List<string>();
                var activeLists = new List<string>();

                if (_currentTab == ModType.BatStrategy)
                {
                    foreach (var mod in _activeMods) 
                        activeStrategies.Add(mod.Id);

                    SettingsManager.Current.ActiveBatMods = activeStrategies;
                    await _modManager.SyncActiveBatModsAsync();
                }
                else
                {
                    foreach (var mod in _activeMods) 
                        activeLists.Add(mod.Id);

                    SettingsManager.Current.ActiveListMods = activeLists;
                    await _modManager.ApplyListModsAsync();
                }

                SettingsManager.Save();
            }
            finally
            {
                _isInternalFileOperation = false;
            }
        }

        private UIElement GetCurrentBlurTarget()
        {
            if (EditorOverlay.Visibility == Visibility.Visible)
                return EditorContentBorder;
            if (CreateModOverlay.Visibility == Visibility.Visible)
                return CreateContentBorder;
            return ContentGrid;
        }

        private void ShowConfirmDialog(string title, string message, string confirmBtnText, System.Windows.Media.Brush confirmBtnBrush, Action onConfirm)
        {
            TxtConfirmTitle.Text = title;
            TxtConfirmMessage.Text = message;
            BtnCancelConfirm.Visibility = Visibility.Visible;
            BtnExecuteConfirm.Content = confirmBtnText;
            BtnExecuteConfirm.Background = confirmBtnBrush;
            _pendingConfirmAction = onConfirm;

            _currentConfirmBlurTarget = GetCurrentBlurTarget();
            AnimationHelper.ShowOverlay(ConfirmOverlay, ConfirmContentBorder, _currentConfirmBlurTarget);
        }

        private void ShowAlertDialog(string title, string message, bool isError = false)
        {
            TxtConfirmTitle.Text = title;
            TxtConfirmMessage.Text = message;
            BtnCancelConfirm.Visibility = Visibility.Collapsed;
            BtnExecuteConfirm.Content = "ОК";
            BtnExecuteConfirm.Background = isError
                ? UIHelper.GetBrushFromHex("#F44336")
                : (System.Windows.Media.Brush)System.Windows.Application.Current.Resources["BrandSuccessBrush"];
            _pendingConfirmAction = null;

            _currentConfirmBlurTarget = GetCurrentBlurTarget();
            AnimationHelper.ShowOverlay(ConfirmOverlay, ConfirmContentBorder, _currentConfirmBlurTarget);
        }

        private void BtnCancelConfirm_Click(object sender, RoutedEventArgs e)
        {
            AudioHelper.PlayClick();
            AnimationHelper.HideOverlay(ConfirmOverlay, ConfirmContentBorder, _currentConfirmBlurTarget);
            _pendingConfirmAction = null;
        }

        private void BtnExecuteConfirm_Click(object sender, RoutedEventArgs e)
        {
            AudioHelper.PlayClick();
            AnimationHelper.HideOverlay(ConfirmOverlay, ConfirmContentBorder, _currentConfirmBlurTarget);
            var action = _pendingConfirmAction;
            _pendingConfirmAction = null;
            action?.Invoke();
        }

        private void BtnDisableAll_Click(object sender, RoutedEventArgs e)
        {
            AudioHelper.PlayClick();
            if (_activeMods.Count == 0) return;

            ShowConfirmDialog(
                "Отключить всё",
                "Вы уверены, что хотите отключить все моды в этой категории?",
                "Отключить",
                UIHelper.GetBrushFromHex("#F44336"),
                async () => {
                    var modsToDisable = _activeMods.ToList();
                    foreach (var mod in modsToDisable)
                    {
                        mod.IsActive = false;
                        _activeMods.Remove(mod);
                        _availableMods.Add(mod);
                    }
                    await SaveAndApplyModsAsync();
                    UpdateHeadersVisibility();

                    if (_currentTab == ModType.DomainList)
                        PromptRestartZapretIfNeeded("Все дополнительные списки доменов были отключены.");
                });
        }

        private void BtnDeleteMod_Click(object sender, RoutedEventArgs e)
        {
            AudioHelper.PlayClick();
            if ((sender as FrameworkElement)?.DataContext is UIModItem mod)
            {
                ShowConfirmDialog(
                    "Удаление мода",
                    $"Удалить мод «{mod.Meta.Name}» навсегда?\nЭто удалит все файлы мода с диска.",
                    "Удалить",
                    UIHelper.GetBrushFromHex("#F44336"),
                    async () => {
                        try
                        {
                            _isInternalFileOperation = true;
                            var wasActiveList = mod.IsActive && _currentTab == ModType.DomainList;

                            var folderName = _currentTab == ModType.BatStrategy ? "strategies" : "lists";
                            var modFolderPath = Path.Combine(System.AppDomain.CurrentDomain.BaseDirectory, AppConstants.ModsDirectory, folderName, mod.Id);

                            if (Directory.Exists(modFolderPath))
                                Directory.Delete(modFolderPath, true);

                            if (mod.IsActive)
                            {
                                _activeMods.Remove(mod);
                                await SaveAndApplyModsAsync();
                            }
                            else
                                _availableMods.Remove(mod);

                            UpdateHeadersVisibility();

                            if (wasActiveList)
                                PromptRestartZapretIfNeeded($"Активный список доменов «{mod.Meta.Name}» был удален.");
                        }
                        catch (Exception ex)
                        {
                            ShowAlertDialog("Ошибка удаления", $"Не удалось удалить мод.\nОшибка: {ex.Message}", isError: true);
                        }
                        finally
                        {
                            _isInternalFileOperation = false;
                        }
                    });
            }
        }


        private void BtnEditMod_Click(object sender, RoutedEventArgs e)
        {
            AudioHelper.PlayClick();

            if ((sender as FrameworkElement)?.DataContext is UIModItem mod)
            {
                _currentEditingMod = mod;
                var isBat = _currentTab == ModType.BatStrategy;

                var folderName = isBat ? "strategies" : "lists";
                var fileName = isBat ? "strategy.bat" : "list.txt";
                var modFolder = Path.Combine(System.AppDomain.CurrentDomain.BaseDirectory, AppConstants.ModsDirectory, folderName, mod.Id);

                _currentEditingFilePath = Path.Combine(modFolder, fileName);
                _currentEditingJsonPath = Path.Combine(modFolder, "mod.json");

                if (!File.Exists(_currentEditingFilePath))
                {
                    ShowAlertDialog("Ошибка", $"Файл {fileName} не найден в папке мода!", isError: true);
                    return;
                }

                TxtEditModName.Text = mod.Meta.Name;
                TxtEditModAuthor.Text = mod.Meta.Author;
                TxtEditModVersion.Text = string.IsNullOrWhiteSpace(mod.Meta.Version) ? "1.0" : mod.Meta.Version;
                TxtEditModDesc.Text = mod.Meta.Description;

                TxtEditorTitle.Text = $"Редактор: {mod.Meta.Name}";
                TxtEditorSubTitle.Text = $"Уникальный ID: {mod.Id} • Файл: {fileName}";
                TxtEditorStatusMsg.Text = "";

                MetaEditorPanel.Visibility = SettingsManager.Current.CompactMode ? Visibility.Collapsed : Visibility.Visible;
                MetaEditorPanel.Opacity = 1;

                BatToolsPanel.Visibility = isBat ? Visibility.Visible : Visibility.Collapsed;
                SnippetsBar.Visibility = isBat ? Visibility.Visible : Visibility.Collapsed;
                ListToolsPanel.Visibility = isBat ? Visibility.Collapsed : Visibility.Visible;

                EditorTextBox.Text = File.ReadAllText(_currentEditingFilePath);
                UpdateLineNumbersAndStats();

                AnimationHelper.ShowOverlay(EditorOverlay, EditorContentBorder, ContentGrid);
            }
        }

        private void BtnToggleMetaPanel_Click(object sender, RoutedEventArgs e)
        {
            AudioHelper.PlayClick();
            var shouldShow = MetaEditorPanel.Visibility != Visibility.Visible;
            AnimationHelper.ToggleExpandPanel(MetaEditorPanel, shouldShow);
        }

        private async void BtnSaveEditor_Click(object sender, RoutedEventArgs e)
        {
            AudioHelper.PlayClick();
            await SaveEditorChangesAsync();
        }

        private async Task SaveEditorChangesAsync(bool bypassSyntaxWarning = false)
        {
            if (_currentEditingMod == null) 
                return;

            var editedModName = string.IsNullOrWhiteSpace(TxtEditModName.Text) ? _currentEditingMod.Id : TxtEditModName.Text.Trim();

            if (_currentTab == ModType.BatStrategy && !bypassSyntaxWarning)
            {
                var (isValid, errMsg) = _modManager.ValidateBatMod(editedModName, EditorTextBox.Text);
                if (!isValid)
                {
                    ShowConfirmDialog(
                        "Предупреждение синтаксиса Zapret",
                        $"В скрипте обнаружена проблема:\n\n{errMsg}\n\nВсё равно сохранить файл?",
                        "Сохранить всё равно",
                        UIHelper.GetBrushFromHex("#F59E0B"),
                        async () => await SaveEditorChangesAsync(bypassSyntaxWarning: true));
                    return;
                }
            }

            try
            {
                _isInternalFileOperation = true;
                var wasActiveDomainList = _currentEditingMod.IsActive && _currentTab == ModType.DomainList;

                _currentEditingMod.Meta.UniqueId = _currentEditingMod.Id;
                _currentEditingMod.Meta.Name = editedModName;
                _currentEditingMod.Meta.Author = string.IsNullOrWhiteSpace(TxtEditModAuthor.Text) ? "Аноним" : TxtEditModAuthor.Text.Trim();
                _currentEditingMod.Meta.Version = string.IsNullOrWhiteSpace(TxtEditModVersion.Text) ? "1.0" : TxtEditModVersion.Text.Trim();
                _currentEditingMod.Meta.Description = TxtEditModDesc.Text.Trim();

                if (!string.IsNullOrEmpty(_currentEditingJsonPath))
                {
                    var jsonContent = JsonSerializer.Serialize(_currentEditingMod.Meta, new JsonSerializerOptions { WriteIndented = true });
                    await File.WriteAllTextAsync(_currentEditingJsonPath, jsonContent);
                }

                await File.WriteAllTextAsync(_currentEditingFilePath, EditorTextBox.Text);

                await SaveAndApplyModsAsync();
                await LoadCurrentModsAsync();

                AnimationHelper.HideOverlay(EditorOverlay, EditorContentBorder, ContentGrid);

                if (wasActiveDomainList)
                    PromptRestartZapretIfNeeded($"Содержимое активного списка «{editedModName}» было обновлено.");
            }
            catch (Exception ex)
            {
                ShowAlertDialog("Ошибка сохранения", $"Ошибка сохранения: {ex.Message}", isError: true);
            }
            finally
            {
                _isInternalFileOperation = false;
            }
        }

        private void BtnCloseEditor_Click(object sender, RoutedEventArgs e)
        {
            AudioHelper.PlayClick();
            AnimationHelper.HideOverlay(EditorOverlay, EditorContentBorder, ContentGrid);
        }


        private void EditorTextBox_TextChanged(object sender, TextChangedEventArgs e)
        {
            UpdateLineNumbersAndStats();
        }

        private void EditorTextBox_SelectionChanged(object sender, RoutedEventArgs e)
        {
            var caretIndex = EditorTextBox.CaretIndex;
            var lineIndex = EditorTextBox.GetLineIndexFromCharacterIndex(caretIndex);
            var colIndex = caretIndex - EditorTextBox.GetCharacterIndexFromLineIndex(Math.Max(0, lineIndex));

            if (TxtCursorPos != null)
                TxtCursorPos.Text = $"Стр: {lineIndex + 1}, Столб: {colIndex + 1}";
        }

        private void EditorTextBox_ScrollChanged(object sender, ScrollChangedEventArgs e)
        {
            LineNumbersScrollViewer?.ScrollToVerticalOffset(e.VerticalOffset);
        }

        private async void EditorTextBox_PreviewKeyDown(object sender, System.Windows.Input.KeyEventArgs e)
        {
            if (Keyboard.Modifiers == ModifierKeys.Control)
            {
                if (e.Key == Key.F)
                {
                    e.Handled = true;
                    BtnToggleSearch_Click(this, new RoutedEventArgs());
                }
                else if (e.Key == Key.S)
                {
                    e.Handled = true;
                    await SaveEditorChangesAsync();
                }
            }
        }

        private void UpdateLineNumbersAndStats()
        {
            if (EditorTextBox == null || TxtLineNumbers == null || TxtStatsInfo == null) return;

            var lines = EditorTextBox.Text.Split(new[] { "\r\n", "\n" }, StringSplitOptions.None);
            var lineCount = Math.Max(1, lines.Length);

            if (lineCount != _lastEditorLineCount)
            {
                _lastEditorLineCount = lineCount;
                var sb = new StringBuilder(lineCount * 4);
                for (var i = 1; i <= lineCount; i++)
                    sb.AppendLine(i.ToString());

                TxtLineNumbers.Text = sb.ToString().TrimEnd();
            }

            if (_currentTab == ModType.DomainList)
            {
                var nonEmptyCount = lines.Count(l => !string.IsNullOrWhiteSpace(l));
                TxtStatsInfo.Text = $"Строк: {lineCount} (Доменов: {nonEmptyCount})";
            }
            else
                TxtStatsInfo.Text = $"Строк: {lineCount} • Символов: {EditorTextBox.Text.Length}";
        }

        private void BtnEditorUndo_Click(object sender, RoutedEventArgs e)
        {
            if (EditorTextBox.CanUndo) 
                EditorTextBox.Undo();
        }

        private void BtnEditorRedo_Click(object sender, RoutedEventArgs e)
        {
            if (EditorTextBox.CanRedo) 
                EditorTextBox.Redo();
        }

        private void BtnToggleSearch_Click(object sender, RoutedEventArgs e)
        {
            AudioHelper.PlayClick();
            var shouldShow = SearchPanel.Visibility != Visibility.Visible;
            AnimationHelper.ToggleExpandPanel(SearchPanel, shouldShow, () =>
            {
                if (shouldShow)
                    TxtSearchQuery.Focus();
                else
                    EditorTextBox.Focus();
            });
        }

        private void BtnFindNext_Click(object sender, RoutedEventArgs e)
        {
            var query = TxtSearchQuery.Text;
            if (string.IsNullOrEmpty(query)) return;

            var startIndex = EditorTextBox.SelectionStart + EditorTextBox.SelectionLength;
            if (startIndex >= EditorTextBox.Text.Length) startIndex = 0;

            var matchIndex = EditorTextBox.Text.IndexOf(query, startIndex, StringComparison.OrdinalIgnoreCase);
            if (matchIndex == -1 && startIndex > 0)
                matchIndex = EditorTextBox.Text.IndexOf(query, 0, StringComparison.OrdinalIgnoreCase);

            if (matchIndex >= 0)
            {
                EditorTextBox.Focus();
                EditorTextBox.Select(matchIndex, query.Length);
                var line = EditorTextBox.GetLineIndexFromCharacterIndex(matchIndex);
                EditorTextBox.ScrollToLine(line);
                SetEditorStatus($"Найдено на строке {line + 1}", "#60A5FA");
            }
            else
            {
                SetEditorStatus("Совпадений не найдено", "#F44336");
            }
        }

        private void BtnReplaceAll_Click(object sender, RoutedEventArgs e)
        {
            var query = TxtSearchQuery.Text;
            var replacement = TxtReplaceQuery.Text ?? "";
            if (string.IsNullOrEmpty(query)) return;

            var current = EditorTextBox.Text;
            var count = (current.Length - current.Replace(query, "", StringComparison.OrdinalIgnoreCase).Length) / query.Length;

            if (count > 0)
            {
                EditorTextBox.Text = current.Replace(query, replacement, StringComparison.OrdinalIgnoreCase);
                SetEditorStatus($"Заменено совпадений: {count}", "#4ADE80");
            }
            else
                SetEditorStatus("Совпадений для замены нет", "#F44336");
        }

        private void BtnToggleWordWrap_Click(object sender, RoutedEventArgs e)
        {
            if (EditorTextBox.TextWrapping == TextWrapping.Wrap)
            {
                EditorTextBox.TextWrapping = TextWrapping.NoWrap;
                TxtWordWrapStatus.Text = "Перенос: Выкл";
            }
            else
            {
                EditorTextBox.TextWrapping = TextWrapping.Wrap;
                TxtWordWrapStatus.Text = "Перенос: Вкл";
            }
        }

        private void BtnZoomIn_Click(object sender, RoutedEventArgs e)
        {
            if (EditorTextBox.FontSize < 24)
            {
                EditorTextBox.FontSize += 1;
                TxtLineNumbers.FontSize = EditorTextBox.FontSize;
            }
        }

        private void BtnZoomOut_Click(object sender, RoutedEventArgs e)
        {
            if (EditorTextBox.FontSize > 10)
            {
                EditorTextBox.FontSize -= 1;
                TxtLineNumbers.FontSize = EditorTextBox.FontSize;
            }
        }

        private void BtnInsertSnippet_Click(object sender, RoutedEventArgs e)
        {
            if (sender is System.Windows.Controls.Button btn && btn.Tag is string snippet)
            {
                var caret = EditorTextBox.CaretIndex;
                EditorTextBox.Text = EditorTextBox.Text.Insert(caret, snippet);
                EditorTextBox.CaretIndex = caret + snippet.Length;
                EditorTextBox.Focus();
            }
        }

        private void BtnCommentLine_Click(object sender, RoutedEventArgs e)
        {
            var caret = EditorTextBox.CaretIndex;
            var lineIdx = EditorTextBox.GetLineIndexFromCharacterIndex(caret);
            var lines = EditorTextBox.Text.Split(new[] { "\r\n", "\n" }, StringSplitOptions.None);

            if (lineIdx >= 0 && lineIdx < lines.Length)
            {
                var line = lines[lineIdx];
                if (line.TrimStart().StartsWith("::"))
                {
                    var idx = line.IndexOf("::");
                    lines[lineIdx] = line.Remove(idx, 2).TrimStart();
                }
                else
                {
                    lines[lineIdx] = ":: " + line;
                }

                EditorTextBox.Text = string.Join("\r\n", lines);
                EditorTextBox.CaretIndex = Math.Min(caret + 3, EditorTextBox.Text.Length);
                EditorTextBox.Focus();
            }
        }

        private void BtnValidateBat_Click(object sender, RoutedEventArgs e)
        {
            AudioHelper.PlayClick();
            var modName = string.IsNullOrWhiteSpace(TxtEditModName.Text) ? "Текущий скрипт" : TxtEditModName.Text.Trim();
            var (isValid, errMsg) = _modManager.ValidateBatMod(modName, EditorTextBox.Text);

            if (isValid)
            {
                SetEditorStatus("✓ Синтаксис корректен!", "#4ADE80");
            }
            else
            {
                SetEditorStatus("⚠ Ошибка в скрипте", "#F44336");
                ShowAlertDialog("Проверка синтаксиса Zapret", errMsg, isError: true);
            }
        }

        private void BtnCleanDomains_Click(object sender, RoutedEventArgs e)
        {
            AudioHelper.PlayClick();
            var rawLines = EditorTextBox.Text.Split(new[] { "\r\n", "\n" }, StringSplitOptions.RemoveEmptyEntries);
            var cleaned = new List<string>();

            foreach (var raw in rawLines)
            {
                var d = raw.Trim().ToLowerInvariant();
                if (string.IsNullOrWhiteSpace(d) || d.StartsWith("#") || d.StartsWith("//"))
                    continue;

                if (d.StartsWith("http://")) 
                    d = d.Substring(7);
                else if (d.StartsWith("https://")) 
                    d = d.Substring(8);

                if (d.StartsWith("www.")) d = d.
                        Substring(4);

                var slashIdx = d.IndexOf('/');
                if (slashIdx > 0) 
                    d = d.Substring(0, slashIdx);

                var colonIdx = d.IndexOf(':');
                if (colonIdx > 0) 
                    d = d.Substring(0, colonIdx);

                if (!string.IsNullOrWhiteSpace(d) && d.Contains('.'))
                    cleaned.Add(d);
            }

            var uniqueSorted = cleaned.Distinct(StringComparer.OrdinalIgnoreCase).OrderBy(x => x).ToList();
            var removedCount = rawLines.Length - uniqueSorted.Count;

            EditorTextBox.Text = string.Join("\r\n", uniqueSorted);
            SetEditorStatus($"Готово! Доменов: {uniqueSorted.Count} (удалено: {Math.Max(0, removedCount)})", "#60A5FA");
        }

        private void SetEditorStatus(string message, string hexColor)
        {
            TxtEditorStatusMsg.Text = message;
            TxtEditorStatusMsg.Foreground = UIHelper.GetBrushFromHex(hexColor);
        }


        private async void BtnImportMod_Click(object sender, RoutedEventArgs e)
        {
            AudioHelper.PlayClick();

            var openFileDialog = new Microsoft.Win32.OpenFileDialog
            {
                Filter = "Архивы модов (*.zip;*.netfix-mod)|*.zip;*.netfix-mod|Все файлы (*.*)|*.*",
                Title = "Выберите архив с модом"
            };

            if (openFileDialog.ShowDialog() == true)
            {
                var tempDir = Path.Combine(Path.GetTempPath(), "ZapretGUI_Mod_" + Guid.NewGuid().ToString("N"));
                try
                {
                    _isInternalFileOperation = true;
                    Directory.CreateDirectory(tempDir);
                    await Task.Run(() => ZipFile.ExtractToDirectory(openFileDialog.FileName, tempDir));

                    var jsonFiles = Directory.GetFiles(tempDir, "mod.json", SearchOption.AllDirectories);
                    if (jsonFiles.Length == 0)
                    {
                        ShowAlertDialog("Ошибка импорта", "В архиве не найден файл mod.json. Убедитесь, что это корректный мод.", isError: true);
                        return;
                    }

                    var jsonPath = jsonFiles[0];
                    var modRootPath = Path.GetDirectoryName(jsonPath)!;

                    var meta = JsonSerializer.Deserialize<ModMetaData>(
                        await File.ReadAllTextAsync(jsonPath),
                        new JsonSerializerOptions { PropertyNameCaseInsensitive = true }
                    );

                    if (meta == null)
                    {
                        ShowAlertDialog("Ошибка импорта", "Файл mod.json поврежден.", isError: true);
                        return;
                    }

                    var baseCandidate = !string.IsNullOrWhiteSpace(meta.UniqueId)
                        ? ModManager.SanitizeModId(meta.UniqueId)
                        : ModManager.SanitizeModId(meta.Name);

                    if (string.IsNullOrEmpty(baseCandidate))
                        baseCandidate = ModManager.SanitizeModId(Path.GetFileNameWithoutExtension(openFileDialog.FileName));

                    var finalUniqueId = _modManager.IsModIdTaken(baseCandidate)
                        ? _modManager.GenerateUniqueModId(baseCandidate)
                        : baseCandidate;

                    meta.UniqueId = finalUniqueId;
                    await File.WriteAllTextAsync(jsonPath, JsonSerializer.Serialize(meta, new JsonSerializerOptions { WriteIndented = true }));

                    var folderType = meta.IsBatStrategy ? "strategies" : "lists";
                    var destPath = Path.Combine(System.AppDomain.CurrentDomain.BaseDirectory, AppConstants.ModsDirectory, folderType, finalUniqueId);

                    Directory.CreateDirectory(destPath);

                    await Task.Run(() =>
                    {
                        foreach (var file in Directory.GetFiles(modRootPath, "*.*", SearchOption.AllDirectories))
                        {
                            var relativePath = file.Substring(modRootPath.Length + 1);
                            var targetPath = Path.Combine(destPath, relativePath);
                            Directory.CreateDirectory(Path.GetDirectoryName(targetPath)!);
                            File.Copy(file, targetPath, true);
                        }
                    });

                    if ((meta.IsBatStrategy && _currentTab != ModType.BatStrategy) || (!meta.IsBatStrategy && _currentTab != ModType.DomainList))
                        ShowAlertDialog("Импорт завершен", $"Мод «{meta.Name}» (ID: {finalUniqueId}) успешно установлен в соседнюю категорию.");
                    else
                        await LoadCurrentModsAsync();
                }
                catch (Exception ex)
                {
                    ShowAlertDialog("Ошибка импорта", $"Ошибка при импорте мода:\n{ex.Message}", isError: true);
                }
                finally
                {
                    _isInternalFileOperation = false;
                    if (Directory.Exists(tempDir))
                        try { Directory.Delete(tempDir, true); } catch { }
                }
            }
        }

        private async void BtnExportMod_Click(object sender, RoutedEventArgs e)
        {
            AudioHelper.PlayClick();

            if ((sender as FrameworkElement)?.DataContext is UIModItem mod)
            {
                var saveFileDialog = new Microsoft.Win32.SaveFileDialog
                {
                    Filter = "Архивы модов (*.zip)|*.zip|Мод NetFix (*.netfix-mod)|*.netfix-mod|Все файлы (*.*)|*.*",
                    Title = "Экспорт мода",
                    FileName = $"{mod.Id}_export.zip"
                };

                if (saveFileDialog.ShowDialog() == true)
                {
                    try
                    {
                        var folderName = _currentTab == ModType.BatStrategy ? "strategies" : "lists";
                        var modFolderPath = Path.Combine(System.AppDomain.CurrentDomain.BaseDirectory, AppConstants.ModsDirectory, folderName, mod.Id);

                        if (!Directory.Exists(modFolderPath))
                        {
                            ShowAlertDialog("Ошибка", "Папка мода не найдена на диске!", isError: true);
                            return;
                        }

                        if (File.Exists(saveFileDialog.FileName))
                            File.Delete(saveFileDialog.FileName);

                        await Task.Run(() => ZipFile.CreateFromDirectory(modFolderPath, saveFileDialog.FileName));

                        ShowAlertDialog("Экспорт завершен", $"Мод «{mod.Meta.Name}» (ID: {mod.Id}) успешно экспортирован и готов к отправке!");
                    }
                    catch (Exception ex)
                    {
                        ShowAlertDialog("Ошибка экспорта", $"Ошибка при экспорте мода:\n{ex.Message}", isError: true);
                    }
                }
            }
        }
    }
}