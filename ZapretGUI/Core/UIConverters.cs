using System;
using System.Globalization;
using System.Windows.Data;
using System.Windows.Media;

namespace ZapretGUI.Core
{
    public class ActiveStatusToBrushConverter : IValueConverter
    {
        public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
        {
            if (value is bool isActive && isActive)
            {
                return SettingsManager.Current.ColorblindMode
                    ? UIHelper.GetBrushFromHex("#0078D7")
                    : UIHelper.GetBrushFromHex("#107C10");
            }
            return UIHelper.GetBrushFromHex("#333333");
        }

        public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture) => throw new NotImplementedException();
    }

    public class ActiveStatusToIconConverter : IValueConverter
    {
        public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
        {
            return (value is bool isActive && isActive) ? "\xE73E" : "\xE1D3"; // Галочка или блок
        }

        public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture) => throw new NotImplementedException();
    }
}