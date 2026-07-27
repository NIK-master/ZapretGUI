using System;
using System.Windows;
using ZapretGUI.Core;

namespace ZapretGUI
{
    public partial class App : System.Windows.Application
    {
        private void Application_Startup(object sender, StartupEventArgs e)
        {
            this.ShutdownMode = ShutdownMode.OnExplicitShutdown;

            var splash = new Views.SplashWindow();
            splash.Show();

            splash.Closed += (s, args) =>
            {
                var mainWindow = new MainWindow();
                this.MainWindow = mainWindow;

                if (SettingsManager.Current.StartMinimized)
                {
                    mainWindow.WindowState = WindowState.Minimized;
                    mainWindow.Hide();
                }
                else
                    mainWindow.Show();

                this.ShutdownMode = ShutdownMode.OnMainWindowClose;
            };
        }
    }
}