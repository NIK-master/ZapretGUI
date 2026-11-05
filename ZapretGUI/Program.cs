using System;
using System.Windows.Forms;
using ZapretGUI.Core;

namespace ZapretGUI
{
    internal static class Program
    {
        [STAThread]
        static void Main()
        {
            Application.SetHighDpiMode(HighDpiMode.PerMonitorV2);
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            SettingsManager.Load();

            var mainWindow = new MainWindow();
            mainWindow.Run();
        }
    }
}