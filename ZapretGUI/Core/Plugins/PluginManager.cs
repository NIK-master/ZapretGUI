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

        public void LoadPlugins(List<ModMetaData> activeMods)
        {
            // 1. Сортируем моды по зависимостям
            var sortedMods = SortModsByDependencies(activeMods);

            // 2. Загружаем Библиотеки и Плагины в правильном порядке
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
                string dllPath = Path.Combine(modFolder, mod.EntryPoint);

                if (!File.Exists(dllPath))
                {
                    Debug.WriteLine($"[Mod Loader] Точка входа {dllPath} не найдена для {mod.UniqueId}");
                    return;
                }

                // Создаем изолированный контекст и загружаем сборку
                var context = new PluginLoaderContext(modFolder);
                _loadContexts[mod.UniqueId] = context;
                var assembly = context.LoadFromAssemblyPath(dllPath);

                // Если это плагин (не библиотека), ищем реализацию IZapretPlugin
                if (mod.Type == ModType.Plugin)
                {
                    var pluginType = assembly.GetTypes().FirstOrDefault(t =>
                        typeof(IZapretPlugin).IsAssignableFrom(t) && !t.IsInterface && !t.IsAbstract);

                    if (pluginType != null)
                    {
                        var pluginInstance = (IZapretPlugin)Activator.CreateInstance(pluginType)!;
                        pluginInstance.OnLoad(_api);
                        _activePlugins[mod.UniqueId] = pluginInstance;
                    }
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[Mod Loader] Ошибка загрузки {mod.UniqueId}: {ex.Message}");
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

            // Принудительно освобождаем память и выгружаем DLL-файлы
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

                // Рекурсивно обходим все зависимости мода перед ним самим
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