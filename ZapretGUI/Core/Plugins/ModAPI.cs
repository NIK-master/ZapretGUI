using System;
using System.Text.Json;
using System.Threading.Tasks;

namespace ZapretGUI.Core.Plugins
{
    public class ModAPI : IModAPI
    {
        private readonly WebBridge _webBridge;

        public ModAPI(WebBridge webBridge)
        {
            _webBridge = webBridge;
        }

        public void RegisterWebMessageRoute(string action, Func<JsonElement, Task> handler)
        {
            // Регистрируем кастомный обработчик команд от интерфейса плагина
            _webBridge.RegisterPluginRoute(action, handler);
        }

        public void SendWebEvent(string eventName, object payload)
        {
            // Прокидываем отправку событий из плагина во Frontend
            _webBridge.SendEvent(eventName, payload);
        }

        public void HookBypassStart(Action<string> onStart)
        {
            BypassController.Current.OnLog += onStart;
        }

        public void HookBypassStop(Action onStop)
        {
            BypassController.Current.OnStop += onStop;
        }

        public AppSettings GetSettings() => SettingsManager.Current;

        public void SaveSettings() => SettingsManager.Save();
    }
}