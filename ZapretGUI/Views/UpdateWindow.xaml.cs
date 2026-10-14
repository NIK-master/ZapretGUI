using System.Windows;
using ZapretGUI.Core;

namespace ZapretGUI.Views
{
    public partial class UpdateWindow : Window
    {
        public bool Result { get; private set; } = false;

        public UpdateWindow(string title, string message, string acceptButtonText = "Обновить", bool showCancel = true, string accentHex = "#107C10", string iconGlyph = "\xE896")
        {
            InitializeComponent();
            TxtTitle.Text = title;
            TxtMessage.Text = message;
            BtnAccept.Content = acceptButtonText;

            if (!showCancel || acceptButtonText == "ОК" || acceptButtonText == "Понятно")
                BtnCancel.Visibility = Visibility.Collapsed;

            var accentBrush = UIHelper.GetBrushFromHex(accentHex);
            BtnAccept.Background = accentBrush;
            TxtIcon.Foreground = accentBrush;
            TxtIcon.Text = iconGlyph;
            IconBadge.Background = UIHelper.GetBrushFromHex("#1F1F24");
        }

        private void BtnAccept_Click(object sender, RoutedEventArgs e)
        {
            AudioHelper.PlayClick();
            Result = true;
            this.Close();
        }

        private void BtnCancel_Click(object sender, RoutedEventArgs e)
        {
            AudioHelper.PlayClick();
            Result = false;
            this.Close();
        }
    }
}