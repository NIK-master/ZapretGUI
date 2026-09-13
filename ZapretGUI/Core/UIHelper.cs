using System.Windows;
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

        public static T? FindParent<T>(DependencyObject child, string? name = null) where T : FrameworkElement
        {
            DependencyObject parent = VisualTreeHelper.GetParent(child);
            while (parent != null)
            {
                if (parent is T typed && (name == null || typed.Name == name))
                    return typed;
                parent = VisualTreeHelper.GetParent(parent);
            }
            return null;
        }
    }
}