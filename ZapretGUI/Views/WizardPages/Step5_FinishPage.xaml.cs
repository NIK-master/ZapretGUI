using System;
using System.Diagnostics;
using System.Threading.Tasks;
using System.Windows.Controls;
using System.Windows.Media;
using ZapretGUI.Core;

namespace ZapretGUI.Views.WizardPages
{
    public partial class Step5_FinishPage : System.Windows.Controls.UserControl
    {
        private bool _isLastMessageProgress = false;

        public Step5_FinishPage()
        {
            InitializeComponent();
        }

        private async Task AppendLog(string message, int delay = 100)
        {
            bool isProgress = message.Contains("Скачивание:") || message.Contains("Скачано:");

            if (isProgress && _isLastMessageProgress)
            {
                var currentText = ConsoleLog.Text;
                var lastNewLine = currentText.LastIndexOf('\n', Math.Max(0, currentText.Length - 2));

                if (lastNewLine >= 0)
                    ConsoleLog.Text = currentText.Substring(0, lastNewLine + 1);
                else
                    ConsoleLog.Text = "";
            }

            ConsoleLog.Text += $"[{DateTime.Now:HH:mm:ss}] {message}\n";
            LogScroller.ScrollToEnd();

            _isLastMessageProgress = isProgress;

            if (delay > 0)
                await Task.Delay(delay);
        }

        public async Task RunSetupAsync(bool useZapret, bool useTgProxy, bool autoStart, bool focusMode, bool colorblind)
        {
            ConsoleLog.Text = "";

            await AppendLog("Инициализация модуля установки...", 200);

            SettingsManager.Current.ZapretEnabled = useZapret;
            SettingsManager.Current.TgProxyEnabled = useTgProxy;
            SettingsManager.Current.FocusMode = focusMode;
            SettingsManager.Current.ColorblindMode = colorblind;

            await AppendLog("[Config] Сохранение пользовательских настроек UI...", 100);
            SettingsManager.Save();

            if (autoStart)
            {
                await AppendLog("[System] Регистрация приложения в автозагрузке Windows...", 150);
                StartupHelper.SetAutoStart(true);
            }

            await AppendLog("Проверка директорий...", 150);
            var zapretDir = System.IO.Path.Combine(System.AppDomain.CurrentDomain.BaseDirectory, AppConstants.CoreFilesDirectory);

            if (!System.IO.Directory.Exists(zapretDir))
            {
                await AppendLog($"[FS] Создание директории: {zapretDir}", 150);
                System.IO.Directory.CreateDirectory(zapretDir);
            }

            if (useZapret || useTgProxy)
            {
                await AppendLog("=====================================", 0);
                await AppendLog("Запуск загрузки выбранных ядер...", 100);

                var progress = new Progress<string>(status =>
                {
                    _ = AppendLog($"[Download] {status}", 0);
                });

                try
                {
                    await UpdateManager.InstallModulesSilentAsync(useZapret, useTgProxy, progress);
                    await AppendLog("✅ Модули успешно загружены и распакованы.", 200);
                }
                catch (Exception ex)
                {
                    Debug.WriteLine($"Сбой скачивания при начальной настройке: {ex.Message}");
                    await AppendLog($"[ERROR] Ошибка при загрузке: {ex.Message}", 0);
                }

                await AppendLog("=====================================", 0);
            }

            await AppendLog("Сборка завершена.", 400);

            ProgBar.IsIndeterminate = false;
            ProgBar.Value = 100;
            TxtStatus.Text = "Всё готово!";
            TxtStatus.Foreground = UIHelper.GetBrushFromHex("#107C10");

            await AppendLog("✅ Настройка успешно завершена. Можно закрывать окно.", 0);
        }
    }
}