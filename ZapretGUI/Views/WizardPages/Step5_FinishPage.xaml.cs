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
                try
                {
                    using (var key = Microsoft.Win32.Registry.CurrentUser.OpenSubKey("SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run", true))
                    {
                        if (key != null)
                        {
                            var exePath = System.Reflection.Assembly.GetExecutingAssembly().Location;
                            exePath = System.IO.Path.ChangeExtension(exePath, ".exe");
                            key.SetValue(AppConstants.AppRegistryName, $"\"{exePath}\"");
                        }
                    }
                }
                catch (Exception ex)
                {
                    Debug.WriteLine($"Ошибка при добавлении в автозагрузку (Wizard): {ex.Message}");
                    await AppendLog($"[Error] Не удалось добавить в автозагрузку: {ex.Message}", 0);
                }
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