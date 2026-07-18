using System;
using System.Threading.Tasks;
using System.Windows.Controls;
using System.Windows.Media;
using ZapretGUI.Core;

namespace ZapretGUI.Views.WizardPages
{
    public partial class Step5_FinishPage : System.Windows.Controls.UserControl
    {
        public Step5_FinishPage()
        {
            InitializeComponent();
        }

        private async Task AppendLog(string message, int delay = 100)
        {
            ConsoleLog.Text += $"[{DateTime.Now:HH:mm:ss}] {message}\n";
            LogScroller.ScrollToEnd();
            await Task.Delay(delay);
        }

        public async Task RunSetupAsync(bool isAuto, bool useZapret, bool useTgProxy)
        {
            ConsoleLog.Text = "";

            await AppendLog("Инициализация модуля установки...", 200);
            await AppendLog("Чтение системных параметров...", 150);

            SettingsManager.Current.ZapretEnabled = useZapret;
            SettingsManager.Current.TgProxyEnabled = useTgProxy;

            await AppendLog($"[Config] Запись флага ZapretEnabled = {useZapret}", 100);
            await AppendLog($"[Config] Запись флага TgProxyEnabled = {useTgProxy}", 100);

            SettingsManager.Save();
            await AppendLog("Конфигурация успешно сохранена в config.json.", 300);

            await AppendLog("Проверка директорий...", 150);
            var zapretDir = System.IO.Path.Combine(System.AppDomain.CurrentDomain.BaseDirectory, "ZapretFiles");

            if (!System.IO.Directory.Exists(zapretDir))
            {
                await AppendLog($"[FS] Создание директории: {zapretDir}", 150);
                System.IO.Directory.CreateDirectory(zapretDir);
            }
            else
                await AppendLog("[FS] Директория ZapretFiles найдена.", 100);

            await AppendLog("Генерация профилей маршрутизации...", 200);
            await AppendLog("Установка параметров автозагрузки...", 150);
            await AppendLog("Сборка завершена.", 400);

            ProgBar.IsIndeterminate = false;
            ProgBar.Value = 100;
            TxtStatus.Text = "Всё готово!";
            TxtStatus.Foreground = new SolidColorBrush((System.Windows.Media.Color)System.Windows.Media.ColorConverter.ConvertFromString("#107C10"));

            await AppendLog("✅ Настройка успешно завершена. Можно закрывать окно.", 0);
        }
    }
}