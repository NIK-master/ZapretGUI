using System;
using System.Threading.Tasks;
using System.Windows.Media;

namespace ZapretGUI.Core
{
    public static class UIHelper
    {
        private static readonly BrushConverter _brushConverter = new BrushConverter();

        public static Action<string, string, bool>? WebAlertHandler { get; set; }
        public static Func<string, string, string, bool, Task<bool>>? WebConfirmHandler { get; set; }

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
            WebAlertHandler?.Invoke(title, message, isError);
        }

        public static Task<bool> ShowConfirmAsync(string title, string message, string confirmText = "Да", bool isDanger = false)
        {
            if (WebConfirmHandler != null)
                return WebConfirmHandler.Invoke(title, message, confirmText, isDanger);

            return Task.FromResult(false);
        }
    }
}