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
        {
            return (SolidColorBrush)_brushConverter.ConvertFromString(hex)!;
        }

        public static T? FindParent<T>(DependencyObject? child, string? name = null) where T : FrameworkElement
        {
            if (child == null) return null;
            DependencyObject? parent = VisualTreeHelper.GetParent(child);
            while (parent != null)
            {
                if (parent is T typed && (name == null || typed.Name == name))
                    return typed;
                parent = VisualTreeHelper.GetParent(parent);
            }
            return null;
        }

        public static void ShowAlert(string title, string message, bool isError = false)
        {
            System.Windows.Application.Current.Dispatcher.Invoke(() =>
            {
                string accent = isError ? "#F44336" : "#107C10";
                string icon = isError ? "\xE783" : "\xE946";

                var mainWin = System.Windows.Application.Current.MainWindow;
                if (mainWin != null && mainWin.IsVisible)
                    AnimationHelper.ApplyBlur(mainWin, 8, TimeSpan.FromSeconds(0.15));

                var dlg = new UpdateWindow(title, message, "ОК", showCancel: false, accentHex: accent, iconGlyph: icon);
                if (mainWin != null && mainWin.IsVisible)
                    dlg.Owner = mainWin;

                dlg.ShowDialog();

                if (mainWin != null && mainWin.IsVisible)
                    AnimationHelper.RemoveBlur(mainWin, TimeSpan.FromSeconds(0.15));
            });
        }

        public static bool ShowConfirm(string title, string message, string confirmText = "Да", bool isDanger = false)
        {
            return System.Windows.Application.Current.Dispatcher.Invoke(() =>
            {
                string accent = isDanger ? "#F44336" : "#107C10";
                string icon = isDanger ? "\xE7BA" : "\xE897";

                var mainWin = System.Windows.Application.Current.MainWindow;
                if (mainWin != null && mainWin.IsVisible)
                    AnimationHelper.ApplyBlur(mainWin, 8, TimeSpan.FromSeconds(0.15));

                var dlg = new UpdateWindow(title, message, confirmText, showCancel: true, accentHex: accent, iconGlyph: icon);
                if (mainWin != null && mainWin.IsVisible)
                    dlg.Owner = mainWin;

                dlg.ShowDialog();

                if (mainWin != null && mainWin.IsVisible)
                    AnimationHelper.RemoveBlur(mainWin, TimeSpan.FromSeconds(0.15));

                return dlg.Result;
            });
        }
    }
}