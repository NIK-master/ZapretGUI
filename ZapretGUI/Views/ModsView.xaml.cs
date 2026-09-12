using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Animation;
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

        private Action _pendingConfirmAction;

        public ModsView()
        {
            InitializeComponent();
            _modManager = new ModManager();

            AvailableModsList.ItemsSource = _availableMods;
            ActiveModsList.ItemsSource = _activeMods;

            SwitchTab(ModType.BatStrategy);
        }

        private void SwitchTab(ModType type)
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
                    TxtCategoryDesc.Text = "Списки сайтов и сервисов для маршрутизации трафика.";
                    BtnDomainLists.Background = UIHelper.GetBrushFromHex("#2A2A2A");
                    BtnDomainLists.Foreground = System.Windows.Media.Brushes.White;
                }

                LoadCurrentMods();
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

        private void LoadCurrentMods()
        {
            _availableMods.Clear();
            _activeMods.Clear();

            var allMods = _modManager.GetAvailableMods(_currentTab);

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

        private void BtnStrategies_Click(object sender, RoutedEventArgs e) { AudioHelper.PlayClick(); SwitchTab(ModType.BatStrategy); }
        private void BtnDomainLists_Click(object sender, RoutedEventArgs e) { AudioHelper.PlayClick(); SwitchTab(ModType.DomainList); }
        private void BtnGuide_Click(object sender, RoutedEventArgs e) { AudioHelper.PlayClick(); SwitchTab((ModType)99); }

        private void BtnOpenModsFolder_Click(object sender, RoutedEventArgs e)
        {
            AudioHelper.PlayClick();
            var path = Path.Combine(System.AppDomain.CurrentDomain.BaseDirectory, AppConstants.ModsDirectory);
            if (Directory.Exists(path)) Process.Start("explorer.exe", path);
        }

        private void BtnCreateMod_Click(object sender, RoutedEventArgs e)
        {
            AudioHelper.PlayClick();

            TxtNewModId.Text = $"mod_{DateTime.Now:HHmmss}";
            TxtNewModName.Text = "Мой новый мод";
            TxtNewModAuthor.Text = "You";
            TxtNewModDesc.Text = "Описание мода";

            CreateModOverlay.Visibility = Visibility.Visible;
        }

        private void BtnCloseCreateMod_Click(object sender, RoutedEventArgs e)
        {
            AudioHelper.PlayClick();
            CreateModOverlay.Visibility = Visibility.Collapsed;
        }

        private void BtnConfirmCreateMod_Click(object sender, RoutedEventArgs e)
        {
            AudioHelper.PlayClick();

            string id = TxtNewModId.Text.Trim().Replace(" ", "_").ToLower();
            var invalidChars = System.IO.Path.GetInvalidFileNameChars();
            id = new string(id.Where(c => !invalidChars.Contains(c)).ToArray());

            if (string.IsNullOrEmpty(id))
                id = $"mod_{DateTime.Now:HHmmss}";

            string folderName = _currentTab == ModType.BatStrategy ? "strategies" : "lists";
            string modFolderPath = Path.Combine(System.AppDomain.CurrentDomain.BaseDirectory, AppConstants.ModsDirectory, folderName, id);

            if (Directory.Exists(modFolderPath))
            {
                System.Windows.MessageBox.Show("Мод с таким ID (папкой) уже существует!", "Ошибка", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            try
            {
                Directory.CreateDirectory(modFolderPath);

                var meta = new ModMetaData
                {
                    Name = string.IsNullOrWhiteSpace(TxtNewModName.Text) ? id : TxtNewModName.Text,
                    Author = string.IsNullOrWhiteSpace(TxtNewModAuthor.Text) ? "Аноним" : TxtNewModAuthor.Text,
                    Version = "1.0",
                    Description = TxtNewModDesc.Text,
                    IsBatStrategy = _currentTab == ModType.BatStrategy
                };

                string jsonPath = Path.Combine(modFolderPath, "mod.json");
                File.WriteAllText(jsonPath, System.Text.Json.JsonSerializer.Serialize(meta, new System.Text.Json.JsonSerializerOptions { WriteIndented = true }));

                if (_currentTab == ModType.BatStrategy)
                    File.WriteAllText(Path.Combine(modFolderPath, "strategy.bat"), ":: Ваш код обхода здесь\r\n");
                else
                    File.WriteAllText(Path.Combine(modFolderPath, "list.txt"), "");

                CreateModOverlay.Visibility = Visibility.Collapsed;
                LoadCurrentMods();
            }
            catch (Exception ex)
            {
                System.Windows.MessageBox.Show($"Ошибка при создании мода: {ex.Message}", "Ошибка", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private async void BtnToggleMod_Click(object sender, RoutedEventArgs e)
        {
            AudioHelper.PlayClick();

            if ((sender as FrameworkElement)?.DataContext is UIModItem mod)
            {
                var btn = sender as System.Windows.Controls.Button;
                var border = FindParent<System.Windows.Controls.Border>(btn, "ModCardContainer");

                if (border != null)
                {
                    var fadeOut = new DoubleAnimation(1, 0, TimeSpan.FromMilliseconds(150));
                    var slideOut = new DoubleAnimation(0, mod.IsActive ? 30 : -30, TimeSpan.FromMilliseconds(150));

                    border.RenderTransform = new TranslateTransform();
                    border.BeginAnimation(OpacityProperty, fadeOut);
                    border.RenderTransform.BeginAnimation(TranslateTransform.XProperty, slideOut);

                    await Task.Delay(150);
                }

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

                SaveAndApplyMods();
                UpdateHeadersVisibility();
            }
        }

        private T? FindParent<T>(DependencyObject child, string? name = null) where T : FrameworkElement
        {
            DependencyObject parent = VisualTreeHelper.GetParent(child);
            while (parent != null)
            {
                if (parent is T typed && (name == null || typed.Name == name))
                {
                    return typed;
                }
                parent = VisualTreeHelper.GetParent(parent);
            }
            return null;
        }

        private void SaveAndApplyMods()
        {
            var activeStrategies = new List<string>();
            var activeLists = new List<string>();

            if (_currentTab == ModType.BatStrategy)
            {
                foreach (var mod in _activeMods) activeStrategies.Add(mod.Id);
                SettingsManager.Current.ActiveBatMods = activeStrategies;
                _modManager.SyncActiveBatMods();
            }
            else
            {
                foreach (var mod in _activeMods) activeLists.Add(mod.Id);
                SettingsManager.Current.ActiveListMods = activeLists;
                _modManager.ApplyListMods();
            }

            SettingsManager.Save();
        }

        // --- ЛОГИКА КАСТОМНЫХ ОКНА ПОДТВЕРЖДЕНИЯ ---

        private void ShowConfirmDialog(string title, string message, string confirmBtnText, System.Windows.Media.Brush confirmBtnBrush, Action onConfirm)
        {
            TxtConfirmTitle.Text = title;
            TxtConfirmMessage.Text = message;
            BtnExecuteConfirm.Content = confirmBtnText;
            BtnExecuteConfirm.Background = confirmBtnBrush;
            _pendingConfirmAction = onConfirm;
            ConfirmOverlay.Visibility = Visibility.Visible;
        }

        private void BtnCancelConfirm_Click(object sender, RoutedEventArgs e)
        {
            AudioHelper.PlayClick();
            ConfirmOverlay.Visibility = Visibility.Collapsed;
            _pendingConfirmAction = null;
        }

        private void BtnExecuteConfirm_Click(object sender, RoutedEventArgs e)
        {
            AudioHelper.PlayClick();
            ConfirmOverlay.Visibility = Visibility.Collapsed;
            _pendingConfirmAction?.Invoke();
            _pendingConfirmAction = null;
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
                () => {
                    var modsToDisable = _activeMods.ToList();
                    foreach (var mod in modsToDisable)
                    {
                        mod.IsActive = false;
                        _activeMods.Remove(mod);
                        _availableMods.Add(mod);
                    }
                    SaveAndApplyMods();
                    UpdateHeadersVisibility();
                });
        }

        private void BtnDeleteMod_Click(object sender, RoutedEventArgs e)
        {
            AudioHelper.PlayClick();
            if ((sender as FrameworkElement)?.DataContext is UIModItem mod)
            {
                ShowConfirmDialog(
                    "Удаление мода",
                    $"Удалить мод '{mod.Meta.Name}' навсегда?\nЭто удалит все файлы мода с диска.",
                    "Удалить",
                    UIHelper.GetBrushFromHex("#F44336"),
                    () => {
                        try
                        {
                            string folderName = _currentTab == ModType.BatStrategy ? "strategies" : "lists";
                            string modFolderPath = Path.Combine(System.AppDomain.CurrentDomain.BaseDirectory, AppConstants.ModsDirectory, folderName, mod.Id);

                            if (Directory.Exists(modFolderPath))
                                Directory.Delete(modFolderPath, true);

                            if (mod.IsActive)
                            {
                                _activeMods.Remove(mod);
                                SaveAndApplyMods();
                            }
                            else
                            {
                                _availableMods.Remove(mod);
                            }

                            UpdateHeadersVisibility();
                        }
                        catch (Exception ex)
                        {
                            System.Windows.MessageBox.Show($"Не удалось удалить мод.\nОшибка: {ex.Message}", "Ошибка", MessageBoxButton.OK, MessageBoxImage.Error);
                        }
                    });
            }
        }

        // --- ЛОГИКА ВСТРОЕННОГО РЕДАКТОРА ---

        private void BtnEditMod_Click(object sender, RoutedEventArgs e)
        {
            AudioHelper.PlayClick();

            if ((sender as FrameworkElement)?.DataContext is UIModItem mod)
            {
                string folderName = _currentTab == ModType.BatStrategy ? "strategies" : "lists";
                string fileName = _currentTab == ModType.BatStrategy ? "strategy.bat" : "list.txt";

                _currentEditingFilePath = Path.Combine(System.AppDomain.CurrentDomain.BaseDirectory, AppConstants.ModsDirectory, folderName, mod.Id, fileName);

                if (File.Exists(_currentEditingFilePath))
                {
                    TxtEditorTitle.Text = $"Редактор: {mod.Meta.Name} ({fileName})";
                    EditorTextBox.Text = File.ReadAllText(_currentEditingFilePath);
                    EditorOverlay.Visibility = Visibility.Visible;
                }
                else
                {
                    System.Windows.MessageBox.Show($"Файл {fileName} не найден в папке мода!", "Ошибка", MessageBoxButton.OK, MessageBoxImage.Error);
                }
            }
        }

        private void BtnSaveEditor_Click(object sender, RoutedEventArgs e)
        {
            AudioHelper.PlayClick();
            try
            {
                File.WriteAllText(_currentEditingFilePath, EditorTextBox.Text);
                SaveAndApplyMods();
                EditorOverlay.Visibility = Visibility.Collapsed;
            }
            catch (Exception ex)
            {
                System.Windows.MessageBox.Show($"Ошибка сохранения: {ex.Message}", "Ошибка", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private void BtnCloseEditor_Click(object sender, RoutedEventArgs e)
        {
            AudioHelper.PlayClick();
            EditorOverlay.Visibility = Visibility.Collapsed;
        }

        // --- ЛОГИКА ИМПОРТА ИЗ ZIP ---
        private void BtnImportMod_Click(object sender, RoutedEventArgs e)
        {
            AudioHelper.PlayClick();

            var openFileDialog = new Microsoft.Win32.OpenFileDialog
            {
                Filter = "Архивы модов (*.zip;*.netfix-mod)|*.zip;*.netfix-mod|Все файлы (*.*)|*.*",
                Title = "Выберите архив с модом"
            };

            if (openFileDialog.ShowDialog() == true)
            {
                string tempDir = Path.Combine(Path.GetTempPath(), "ZapretGUI_Mod_" + Guid.NewGuid().ToString());
                try
                {
                    Directory.CreateDirectory(tempDir);
                    ZipFile.ExtractToDirectory(openFileDialog.FileName, tempDir);

                    // Ищем mod.json рекурсивно (помогает, если файлы в архиве лежат внутри папки)
                    string[] jsonFiles = Directory.GetFiles(tempDir, "mod.json", SearchOption.AllDirectories);
                    if (jsonFiles.Length == 0)
                    {
                        System.Windows.MessageBox.Show("В архиве не найден файл mod.json. Убедитесь, что это корректный мод.", "Ошибка импорта", MessageBoxButton.OK, MessageBoxImage.Warning);
                        return;
                    }

                    string jsonPath = jsonFiles[0];
                    string modRootPath = Path.GetDirectoryName(jsonPath);

                    // Читаем метаданные
                    var meta = System.Text.Json.JsonSerializer.Deserialize<ModMetaData>(
                        File.ReadAllText(jsonPath),
                        new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true }
                    );

                    if (meta == null)
                    {
                        System.Windows.MessageBox.Show("Файл mod.json поврежден.", "Ошибка импорта", MessageBoxButton.OK, MessageBoxImage.Warning);
                        return;
                    }

                    // Формируем безопасное название папки из названия архива
                    string safeId = Path.GetFileNameWithoutExtension(openFileDialog.FileName).Replace(" ", "_").ToLower();
                    var invalidChars = Path.GetInvalidFileNameChars();
                    safeId = new string(safeId.Where(c => !invalidChars.Contains(c)).ToArray());
                    if (string.IsNullOrEmpty(safeId)) safeId = $"mod_{DateTime.Now:HHmmss}";

                    // Определяем конечную папку
                    string folderType = meta.IsBatStrategy ? "strategies" : "lists";
                    string destPath = Path.Combine(System.AppDomain.CurrentDomain.BaseDirectory, AppConstants.ModsDirectory, folderType, safeId);

                    // Защита от перезаписи (если мод с таким именем папки уже существует)
                    int counter = 1;
                    string originalId = safeId;
                    while (Directory.Exists(destPath))
                    {
                        safeId = $"{originalId}_{counter}";
                        destPath = Path.Combine(System.AppDomain.CurrentDomain.BaseDirectory, AppConstants.ModsDirectory, folderType, safeId);
                        counter++;
                    }

                    Directory.CreateDirectory(destPath);

                    // Рекурсивно копируем всё содержимое извлеченной папки в конечную
                    foreach (var file in Directory.GetFiles(modRootPath, "*.*", SearchOption.AllDirectories))
                    {
                        string relativePath = file.Substring(modRootPath.Length + 1);
                        string targetPath = Path.Combine(destPath, relativePath);
                        Directory.CreateDirectory(Path.GetDirectoryName(targetPath));
                        File.Copy(file, targetPath, true);
                    }

                    // Если тип загруженного мода не совпадает с текущей вкладкой, предупреждаем пользователя
                    if ((meta.IsBatStrategy && _currentTab != ModType.BatStrategy) || (!meta.IsBatStrategy && _currentTab != ModType.DomainList))
                    {
                        System.Windows.MessageBox.Show($"Мод '{meta.Name}' успешно установлен, но он относится к другой категории. Переключите вкладку, чтобы увидеть его.", "Успех", MessageBoxButton.OK, MessageBoxImage.Information);
                    }
                    else
                    {
                        LoadCurrentMods();
                    }
                }
                catch (Exception ex)
                {
                    System.Windows.MessageBox.Show($"Ошибка при импорте мода:\n{ex.Message}", "Ошибка", MessageBoxButton.OK, MessageBoxImage.Error);
                }
                finally
                {
                    if (Directory.Exists(tempDir))
                        try { Directory.Delete(tempDir, true); } catch { }
                }
            }
        }

        // --- ЛОГИКА ЭКСПОРТА МОДА В ZIP ---
        private void BtnExportMod_Click(object sender, RoutedEventArgs e)
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
                        string folderName = _currentTab == ModType.BatStrategy ? "strategies" : "lists";
                        string modFolderPath = Path.Combine(System.AppDomain.CurrentDomain.BaseDirectory, AppConstants.ModsDirectory, folderName, mod.Id);

                        if (!Directory.Exists(modFolderPath))
                        {
                            System.Windows.MessageBox.Show("Папка мода не найдена на диске!", "Ошибка", MessageBoxButton.OK, MessageBoxImage.Error);
                            return;
                        }

                        // Удаляем старый файл, если пользователь решил его перезаписать
                        if (File.Exists(saveFileDialog.FileName))
                            File.Delete(saveFileDialog.FileName);

                        // Упаковываем всю директорию мода в архив
                        System.IO.Compression.ZipFile.CreateFromDirectory(modFolderPath, saveFileDialog.FileName);

                        System.Windows.MessageBox.Show($"Мод '{mod.Meta.Name}' успешно экспортирован и готов к публикации!", "Успех", MessageBoxButton.OK, MessageBoxImage.Information);
                    }
                    catch (Exception ex)
                    {
                        System.Windows.MessageBox.Show($"Ошибка при экспорте мода:\n{ex.Message}", "Ошибка", MessageBoxButton.OK, MessageBoxImage.Error);
                    }
                }
            }
        }
    }
}