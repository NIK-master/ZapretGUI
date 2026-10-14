using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;

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
            if (!Directory.Exists(_modsBasePath)) 
                Directory.CreateDirectory(_modsBasePath);

            if (!Directory.Exists(_strategiesPath)) 
                Directory.CreateDirectory(_strategiesPath);

            if (!Directory.Exists(_listsPath)) 
                Directory.CreateDirectory(_listsPath);
        }

        public bool IsModIdTaken(string id)
        {
            if (string.IsNullOrWhiteSpace(id)) return true;
            InitializeFolders();

            var normId = SanitizeModId(id);
            if (Directory.Exists(Path.Combine(_strategiesPath, normId)) ||
                Directory.Exists(Path.Combine(_listsPath, normId)))
            {
                return true;
            }

            foreach (var dir in Directory.GetDirectories(_strategiesPath).Concat(Directory.GetDirectories(_listsPath)))
            {
                var jsonPath = Path.Combine(dir, "mod.json");
                if (File.Exists(jsonPath))
                {
                    try
                    {
                        var meta = JsonSerializer.Deserialize<ModMetaData>(File.ReadAllText(jsonPath), new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                        if (meta != null && string.Equals(meta.UniqueId, normId, StringComparison.OrdinalIgnoreCase))
                            return true;
                    }
                    catch { }
                }
            }

            return false;
        }

        public static string SanitizeModId(string raw)
        {
            if (string.IsNullOrWhiteSpace(raw)) 
                return "";

            var clean = raw.Trim().ToLowerInvariant().Replace(" ", "_");
            clean = Regex.Replace(clean, @"[^a-z0-9_\-]", "");
            return clean.Trim('_');
        }

        public string GenerateUniqueModId(string baseName = "mod")
        {
            var prefix = SanitizeModId(baseName);
            if (string.IsNullOrEmpty(prefix)) 
                prefix = "mod";

            if (prefix.Length > 18) 
                prefix = prefix.Substring(0, 18).TrimEnd('_');

            while (true)
            {
                var shortHash = Guid.NewGuid().ToString("N").Substring(0, 4);
                var candidate = $"{prefix}_{shortHash}";
                if (!IsModIdTaken(candidate))
                    return candidate;
            }
        }

        public async Task<List<UIModItem>> GetAvailableModsAsync(ModType type)
        {
            var mods = new List<UIModItem>();
            var targetFolder = type == ModType.BatStrategy ? _strategiesPath : _listsPath;

            if (!Directory.Exists(targetFolder))
                return mods;

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
                        var json = await File.ReadAllTextAsync(jsonPath);
                        var meta = JsonSerializer.Deserialize<ModMetaData>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

                        if (meta != null)
                        {
                            if (string.IsNullOrWhiteSpace(meta.UniqueId))
                                meta.UniqueId = modId;

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

        public async Task ApplyListModsAsync()
        {
            var listsDir = Path.Combine(_zapretFilesPath, "lists");
            var targetFile = Path.Combine(listsDir, "list-general.txt");
            var backupBaseFile = Path.Combine(listsDir, "list-general.base.txt");

            if (!File.Exists(targetFile)) return;

            var allModDomains = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var activeModDomains = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            if (Directory.Exists(_listsPath))
            {
                foreach (var dir in Directory.GetDirectories(_listsPath))
                {
                    var modId = Path.GetFileName(dir);
                    var listPath = Path.Combine(dir, "list.txt");

                    if (File.Exists(listPath))
                    {
                        var lines = await File.ReadAllLinesAsync(listPath);
                        var domains = lines.Where(l => !string.IsNullOrWhiteSpace(l) && !l.TrimStart().StartsWith("#"))
                                           .Select(l => l.Trim());

                        foreach (var d in domains)
                        {
                            allModDomains.Add(d);
                            if (SettingsManager.Current.ActiveListMods.Contains(modId))
                                activeModDomains.Add(d);
                        }
                    }
                }
            }

            if (!File.Exists(backupBaseFile))
            {
                var currentRaw = await File.ReadAllLinesAsync(targetFile);
                var baseLinesOnly = currentRaw.Where(l => !string.IsNullOrWhiteSpace(l))
                                              .Select(l => l.Trim())
                                              .Where(l => !allModDomains.Contains(l))
                                              .Distinct(StringComparer.OrdinalIgnoreCase)
                                              .ToList();
                await File.WriteAllLinesAsync(backupBaseFile, baseLinesOnly);
            }

            var baseLines = (await File.ReadAllLinesAsync(backupBaseFile))
                            .Where(l => !string.IsNullOrWhiteSpace(l))
                            .Select(l => l.Trim())
                            .ToList();

            baseLines.AddRange(activeModDomains);

            await File.WriteAllLinesAsync(targetFile, baseLines.Distinct(StringComparer.OrdinalIgnoreCase));
        }

        public async Task SyncActiveBatModsAsync()
        {
            if (!Directory.Exists(_zapretFilesPath)) return;

            await Task.Run(() =>
            {
                foreach (var file in Directory.GetFiles(_zapretFilesPath, "mod_*.bat"))
                    try { File.Delete(file); } catch { }

                foreach (var modId in SettingsManager.Current.ActiveBatMods)
                {
                    var sourceBat = Path.Combine(_strategiesPath, modId, "strategy.bat");
                    if (File.Exists(sourceBat))
                    {
                        var destBat = Path.Combine(_zapretFilesPath, $"mod_{modId}.bat");
                        try { File.Copy(sourceBat, destBat, true); } catch { }
                    }
                }
            });
        }

        public (bool isValid, string errorMessage) ValidateBatMod(string modName, string batContent)
        {
            try
            {
                var lines = (batContent ?? "").Split(new[] { "\r\n", "\n" }, StringSplitOptions.None);
                ZapretManager.ParseAndValidateBatLines(lines, $"моде «{modName}»", _zapretFilesPath, checkReferencedFiles: true);
                return (true, "");
            }
            catch (Exception ex)
            {
                return (false, ex.Message);
            }
        }
    }
}