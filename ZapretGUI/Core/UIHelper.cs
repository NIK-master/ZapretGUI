using System;
using System.Windows;
using System.Windows.Media;
using ZapretGUI.Views;

namespace ZapretGUI.Core
{
    public static class UIHelper
    {
        private static readonly BrushConverter _brushConverter = new BrushConverter();

        public static SolidColorBrush GetBrushFromHex(string hex)
            => (SolidColorBrush)_brushConverter.ConvertFromString(hex)!;

        public static SolidColorBrush GetSuccessBrush()
            => GetBrushFromHex(SettingsManager.Current.ColorblindMode ? "#0078D7" : "#107C10");

        public static SolidColorBrush GetErrorBrush()
            => GetBrushFromHex(SettingsManager.Current.ColorblindMode ? "#FF8C00" : "#D13438");

        public static void ApplyThemeColors()
        {
            var res = System.Windows.Application.Current?.Resources;
            if (res == null)
                return;

            res["BrandSuccessBrush"] = GetSuccessBrush();
            res["BrandErrorBrush"] = GetErrorBrush();
        }

        public static void ShowAlert(string title, string message, bool isError = false)
        {
            System.Windows.Application.Current.Dispatcher.Invoke(() =>
            {
                var accent = isError ? "#F44336" : "#107C10";
                var icon = isError ? "\xE783" : "\xE946";

                var mainWin = System.Windows.Application.Current.MainWindow;
                var dlg = new UpdateWindow(title, message, "ОК", showCancel: false, accentHex: accent, iconGlyph: icon);
                if (mainWin != null && mainWin.IsVisible)
                    dlg.Owner = mainWin;

                dlg.ShowDialog();
            });
        }

        public static bool ShowConfirm(string title, string message, string confirmText = "Да", bool isDanger = false)
        {
            return System.Windows.Application.Current.Dispatcher.Invoke(() =>
            {
                var accent = isDanger ? "#F44336" : "#107C10";
                var icon = isDanger ? "\xE7BA" : "\xE897";

                var mainWin = System.Windows.Application.Current.MainWindow;
                var dlg = new UpdateWindow(title, message, confirmText, showCancel: true, accentHex: accent, iconGlyph: icon);
                if (mainWin != null && mainWin.IsVisible)
                    dlg.Owner = mainWin;

                dlg.ShowDialog();
                return dlg.Result;
            });
        }
    }
}