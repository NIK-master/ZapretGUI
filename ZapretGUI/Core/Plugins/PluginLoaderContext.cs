using System.IO;
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
            var dllPath = Path.Combine(_pluginDirectory, $"{assemblyName.Name}.dll");
            if (File.Exists(dllPath))
                return LoadFromAssemblyPath(dllPath);

            return null;
        }
    }
}