using System;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Runtime.Loader;

namespace ZapretGUI.Core.Plugins
{
    public class PluginLoaderContext : AssemblyLoadContext
    {
        private readonly string _pluginDirectory;

        public PluginLoaderContext(string pluginDirectory) : base(isCollectible: true)
        {
            _pluginDirectory = pluginDirectory;
        }

        protected override Assembly? Load(AssemblyName assemblyName)
        {
            // 1. Если запрашивается сборка самого приложения или уже загруженная системная сборка —
            // возвращаем её из основного контекста, чтобы интерфейсы (IZapretPlugin, IModAPI) совпадали по типам!
            var existing = Default.Assemblies.FirstOrDefault(a =>
                string.Equals(a.GetName().Name, assemblyName.Name, StringComparison.OrdinalIgnoreCase));
            if (existing != null)
                return existing;

            // 2. Иначе ищем стороннюю зависимость рядом с DLL плагина
            var dllPath = Path.Combine(_pluginDirectory, $"{assemblyName.Name}.dll");
            if (File.Exists(dllPath))
                return LoadFromAssemblyPath(dllPath);

            return null;
        }
    }
}