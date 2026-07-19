using System.Windows.Media;

namespace ZapretGUI.Core
{
    public static class UIHelper
    {
        private static readonly BrushConverter _brushConverter = new BrushConverter();

        public static SolidColorBrush GetBrushFromHex(string hex)
        {
            return (SolidColorBrush)_brushConverter.ConvertFromString(hex)!;
        }
    }
}