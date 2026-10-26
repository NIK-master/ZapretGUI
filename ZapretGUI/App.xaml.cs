using System.Windows;
using ZapretGUI.Core;

namespace ZapretGUI
{
    public partial class App : System.Windows.Application
    {
        private void Application_Startup(object sender, StartupEventArgs e)
        {
            SettingsManager.Load();

            var mainWindow = new MainWindow();
            this.MainWindow = mainWindow;

            if (SettingsManager.Current.StartMinimized)
            {
                mainWindow.WindowState = WindowState.Minimized;
                mainWindow.Hide();
            }
            else
            {
                mainWindow.Show();
            }
        }
    }
}