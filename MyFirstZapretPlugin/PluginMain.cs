using System;
using System.Text.Json;
using System.Threading.Tasks;
using ZapretGUI.Core.Plugins;

namespace MyFirstZapretPlugin
{
    public class PluginMain : IZapretPlugin
    {
        private IModAPI _api;

        public void OnLoad(IModAPI api)
        {
            _api = api;

            // 1. Регистрируем обработчик кастомной команды от UI
            _api.RegisterWebMessageRoute("examplePluginAction", HandleMyActionAsync);

            // 2. Внедряем свою вкладку в боковое меню UI
            var html = @"
                <div class='p-5 text-white'>
                    <h2 class='text-xl font-bold mb-4'>Мой Первый Плагин</h2>
                    <p class='text-[#AAAAAA] mb-4'>Эта вкладка была добавлена динамически из C# DLL!</p>
                    <button onclick=""sendCmd('examplePluginAction', { param: 'Привет из WebUI!' })"" 
                            class='btn-brand px-4 py-2 rounded font-bold'>
                        Отправить команду в C#
                    </button>
                    <div id='plugin-response' class='mt-4 text-[#4CAF50] font-mono'></div>
                </div>";

            // Вызываем инжектор, который мы написали в app.js
            _api.SendWebEvent("injectPluginTab", new
            {
                id = "my_example",
                title = "Мой Плагин",
                iconGlyph = "&#xE710;",
                htmlContent = html,
                jsContent = "console.log('Скрипт плагина загружен!');"
            });

            // 3. Подписываемся на события ядра
            _api.HookBypassStart(logMessage =>
            {
                if (logMessage.Contains("Запуск"))
                {
                    _api.SendWebEvent("alert", new { title = "Плагин работает", message = "Ядро Zapret стартует!", isError = false });
                }
            });
        }

        private Task HandleMyActionAsync(JsonElement root)
        {
            var param = root.TryGetProperty("param", out var p) ? p.GetString() : "пусто";

            // Отправляем ответ обратно во Frontend, выполняя кастомный JS
            _api.SendWebEvent("alert", new
            {
                title = "Команда получена",
                message = $"C# плагин получил сообщение: {param}",
                isError = false
            });

            return Task.CompletedTask;
        }

        public void OnUnload()
        {
            // Очистка ресурсов при выключении плагина
            _api = null;
        }
    }
}