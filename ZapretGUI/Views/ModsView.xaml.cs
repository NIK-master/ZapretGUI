using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Diagnostics;
using System.IO;
using System.Windows;
using System.Windows.Controls;
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

        }

        private void BtnStrategies_Click(object sender, RoutedEventArgs e) { AudioHelper.PlayClick(); SwitchTab(ModType.BatStrategy); }
        private void BtnDomainLists_Click(object sender, RoutedEventArgs e) { AudioHelper.PlayClick(); SwitchTab(ModType.DomainList); }
        private void BtnGuide_Click(object sender, RoutedEventArgs e) { AudioHelper.PlayClick(); SwitchTab((ModType)99); /* 99 - фейковый Enum для Гайда */ }

        private void BtnOpenModsFolder_Click(object sender, RoutedEventArgs e)
        {
            AudioHelper.PlayClick();
            var path = Path.Combine(System.AppDomain.CurrentDomain.BaseDirectory, AppConstants.ModsDirectory);
            if (Directory.Exists(path)) Process.Start("explorer.exe", path);
        }

        private void BtnCreateMod_Click(object sender, RoutedEventArgs e)
        {
            AudioHelper.PlayClick();
            System.Windows.MessageBox.Show("Мастер создания модов будет добавлен позже. Вы можете создать папку мода вручную.", "Инфо", MessageBoxButton.OK, MessageBoxImage.Information);
        }

        private void BtnToggleMod_Click(object sender, RoutedEventArgs e)
        {
            AudioHelper.PlayClick();

            if ((sender as FrameworkElement)?.DataContext is UIModItem mod)
            {
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
            }
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
    }
}