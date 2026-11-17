using System;
using System.Text.Json;
using System.Threading.Tasks;

namespace ZapretGUI.Core.Plugins
{
    /// <summary>
    /// API, которое передается плагину при загрузке.
    /// Позволяет плагину безопасно общаться с UI и ядром.
    /// </summary>
    public interface IModAPI
    {
        // Регистрация кастомных команд от Web UI плагина
        void RegisterWebMessageRoute(string action, Func<JsonElement, Task> handler);

        // Отправка событий в Web UI
        void SendWebEvent(string eventName, object payload);

        // Хуки на события ядра обхода
        void HookBypassStart(Action<string> onStart);
        void HookBypassStop(Action onStop);

        // Доступ к настройкам
        AppSettings GetSettings();
        void SaveSettings();
    }
}