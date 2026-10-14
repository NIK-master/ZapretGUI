using System;
using System.Globalization;
using System.Windows.Data;

namespace ZapretGUI.Core
{
    public class ActiveStatusToBrushConverter : IValueConverter
    {
        public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
        {
            if (value is bool isActive && isActive)
                return UIHelper.GetSuccessBrush();

            return UIHelper.GetBrushFromHex("#333333");
        }

        public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture) => throw new NotImplementedException();
    }

    public class ActiveStatusToIconConverter : IValueConverter
    {
        public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
            => (value is bool isActive && isActive) ? "\xE73E" : "\xE1D3";

        public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture) 
            => throw new NotImplementedException();
    }

    public class PingToBrushConverter : IValueConverter
    {
        public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
        {
            if (value is double latency)
            {
                if (latency < 120)
                    return UIHelper.GetSuccessBrush();

                return UIHelper.GetBrushFromHex(SettingsManager.Current.ColorblindMode ? "#FFB900" : "#FF8C00");
            }

            return UIHelper.GetErrorBrush();
        }

        public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture) 
            => throw new NotImplementedException();
    }
}