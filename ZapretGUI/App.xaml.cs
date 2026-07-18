using System;
using System.Windows;

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
                mainWindow.Show();

                this.ShutdownMode = ShutdownMode.OnMainWindowClose;
            };
        }
    }
}