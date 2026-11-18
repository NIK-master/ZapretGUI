using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Reflection;

namespace ZapretGUI.Core.Plugins
{
    public class PluginManager
    {
        private readonly Dictionary<string, PluginLoaderContext> _loadContexts = new();
        private readonly Dictionary<string, IZapretPlugin> _activePlugins = new();
        private readonly IModAPI _api;

        public PluginManager(IModAPI api)
        {
            _api = api;
        }

        private void LogToUI(string message)
        {
            Debug.WriteLine(message);
            _api.SendWebEvent("log", new
            {
                message,
                time = DateTime.Now.ToString("HH:mm:ss"),
                isProgress = false
            });
        }

        public void LoadPlugins(List<ModMetaData> activeMods)
        {
            UnloadAll();

            if (activeMods.Count == 0)
            {
                LogToUI("🧩 [ModLoader] Нет активных C# плагинов для загрузки.");
                return;
            }

            var sortedMods = SortModsByDependencies(activeMods);

            foreach (var mod in sortedMods)
            {
                if (mod.Type == ModType.Plugin || mod.Type == ModType.Library)
                {
                    LoadSinglePlugin(mod);
                }
            }
        }

        private void LoadSinglePlugin(ModMetaData mod)
        {
            try
            {
                string folderName = mod.Type == ModType.Library ? "libraries" : "plugins";
                string modFolder = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, AppConstants.ModsDirectory, folderName, mod.UniqueId);

                // Если EntryPoint не указан в mod.json — берем первую попавшуюся .dll в папке мода
                string entryDll = mod.EntryPoint;
                if (string.IsNullOrWhiteSpace(entryDll) && Directory.Exists(modFolder))
                {
                    var firstDll = Directory.GetFiles(modFolder, "*.dll")
                        .FirstOrDefault(f => !Path.GetFileName(f).Equals("ZapretGUI.dll", StringComparison.OrdinalIgnoreCase));
                    if (firstDll != null)
                        entryDll = Path.GetFileName(firstDll);
                }

                string dllPath = Path.Combine(modFolder, entryDll);

                if (!File.Exists(dllPath))
                {
                    LogToUI($"❌ [ModLoader] DLL не найдена для мода «{mod.UniqueId}»: {dllPath}");
                    return;
                }

                var context = new PluginLoaderContext(modFolder);
                _loadContexts[mod.UniqueId] = context;
                var assembly = context.LoadFromAssemblyPath(dllPath);

                if (mod.Type == ModType.Plugin)
                {
                    var pluginType = assembly.GetTypes().FirstOrDefault(t =>
                        typeof(IZapretPlugin).IsAssignableFrom(t) && !t.IsInterface && !t.IsAbstract);

                    if (pluginType != null)
                    {
                        var pluginInstance = (IZapretPlugin)Activator.CreateInstance(pluginType)!;
                        pluginInstance.OnLoad(_api);
                        _activePlugins[mod.UniqueId] = pluginInstance;
                        LogToUI($"✅ [ModLoader] Плагин «{mod.Name}» ({mod.UniqueId}) успешно загружен!");
                    }
                    else
                    {
                        LogToUI($"⚠ [ModLoader] В {entryDll} не найден класс, реализующий IZapretPlugin.");
                    }
                }
            }
            catch (Exception ex)
            {
                LogToUI($"❌ [ModLoader] Ошибка загрузки «{mod.UniqueId}»: {ex.Message}");
            }
        }

        public void UnloadAll()
        {
            foreach (var kvp in _activePlugins)
            {
                try { kvp.Value.OnUnload(); } catch { }
            }
            _activePlugins.Clear();

            foreach (var kvp in _loadContexts)
            {
                try { kvp.Value.Unload(); } catch { }
            }
            _loadContexts.Clear();

            GC.Collect();
            GC.WaitForPendingFinalizers();
        }

        private List<ModMetaData> SortModsByDependencies(List<ModMetaData> activeMods)
        {
            var sorted = new List<ModMetaData>();
            var visited = new HashSet<string>();
            var visiting = new HashSet<string>();

            void Visit(ModMetaData mod)
            {
                if (visited.Contains(mod.UniqueId)) return;
                if (visiting.Contains(mod.UniqueId))
                    throw new Exception($"Обнаружена циклическая зависимость мода: {mod.UniqueId}");

                visiting.Add(mod.UniqueId);

                foreach (var dep in mod.Dependencies)
                {
                    var depMod = activeMods.FirstOrDefault(m => m.UniqueId == dep.ModId);
                    if (depMod != null) Visit(depMod);
                }

                visiting.Remove(mod.UniqueId);
                visited.Add(mod.UniqueId);
                sorted.Add(mod);
            }

            foreach (var mod in activeMods) Visit(mod);
            return sorted;
        }
    }
}