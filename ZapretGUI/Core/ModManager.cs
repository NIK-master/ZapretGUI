using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text.Json;

namespace ZapretGUI.Core
{
    public class ModManager
    {
        private readonly string _modsBasePath;
        private readonly string _strategiesPath;
        private readonly string _listsPath;
        private readonly string _zapretFilesPath;

        public ModManager()
        {
            _modsBasePath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, AppConstants.ModsDirectory);
            _strategiesPath = Path.Combine(_modsBasePath, "strategies");
            _listsPath = Path.Combine(_modsBasePath, "lists");
            _zapretFilesPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, AppConstants.CoreFilesDirectory);
        }

        public void InitializeFolders()
        {
            if (!Directory.Exists(_modsBasePath)) Directory.CreateDirectory(_modsBasePath);
            if (!Directory.Exists(_strategiesPath)) Directory.CreateDirectory(_strategiesPath);
            if (!Directory.Exists(_listsPath)) Directory.CreateDirectory(_listsPath);
        }

        public List<UIModItem> GetAvailableMods(ModType type)
        {
            var mods = new List<UIModItem>();
            var targetFolder = type == ModType.BatStrategy ? _strategiesPath : _listsPath;

            if (!Directory.Exists(targetFolder)) return mods;

            var activeList = type == ModType.BatStrategy
                ? SettingsManager.Current.ActiveBatMods
                : SettingsManager.Current.ActiveListMods;

            foreach (var dir in Directory.GetDirectories(targetFolder))
            {
                var modId = Path.GetFileName(dir);
                var jsonPath = Path.Combine(dir, "mod.json");

                if (File.Exists(jsonPath))
                {
                    try
                    {
                        var json = File.ReadAllText(jsonPath);
                        var meta = JsonSerializer.Deserialize<ModMetaData>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

                        if (meta != null)
                        {
                            mods.Add(new UIModItem
                            {
                                Id = modId,
                                Type = type,
                                Meta = meta,
                                IsActive = activeList.Contains(modId)
                            });
                        }
                    }
                    catch (Exception ex)
                    {
                        Debug.WriteLine($"Ошибка чтения meta-данных мода {modId}: {ex.Message}");
                    }
                }
            }
            return mods;
        }

        public void ApplyListMods()
        {
            string listsDir = Path.Combine(_zapretFilesPath, "lists");
            string targetFile = Path.Combine(listsDir, "list-general.txt");

            if (!File.Exists(targetFile)) return;

            var allModDomains = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var activeModDomains = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            foreach (var dir in Directory.GetDirectories(_listsPath))
            {
                var modId = Path.GetFileName(dir);
                var listPath = Path.Combine(dir, "list.txt");

                if (File.Exists(listPath))
                {
                    var domains = File.ReadAllLines(listPath)
                                      .Where(l => !string.IsNullOrWhiteSpace(l))
                                      .Select(l => l.Trim());

                    foreach (var d in domains)
                    {
                        allModDomains.Add(d);
                        if (SettingsManager.Current.ActiveListMods.Contains(modId))
                        {
                            activeModDomains.Add(d);
                        }
                    }
                }
            }

            var currentLines = File.ReadAllLines(targetFile)
                                   .Where(l => !string.IsNullOrWhiteSpace(l))
                                   .Select(l => l.Trim())
                                   .ToList();

            var newLines = currentLines.Where(l => !allModDomains.Contains(l)).ToList();

            newLines.AddRange(activeModDomains);

            File.WriteAllLines(targetFile, newLines.Distinct(StringComparer.OrdinalIgnoreCase));
        }

        public void SyncActiveBatMods()
        {
            if (!Directory.Exists(_zapretFilesPath)) return;

            foreach (var file in Directory.GetFiles(_zapretFilesPath, "mod_*.bat"))
            {
                try { File.Delete(file); } catch { }
            }

            foreach (var modId in SettingsManager.Current.ActiveBatMods)
            {
                var sourceBat = Path.Combine(_strategiesPath, modId, "strategy.bat");
                if (File.Exists(sourceBat))
                {
                    var destBat = Path.Combine(_zapretFilesPath, $"mod_{modId}.bat");
                    try { File.Copy(sourceBat, destBat, true); } catch { }
                }
            }
        }
    }
}