using System.Windows;

namespace ZapretGUI.Views
{
    public partial class UpdateWindow : Window
    {
        public bool Result { get; private set; } = false;

        public UpdateWindow(string title, string message, string acceptButtonText = "Обновить")
        {
            InitializeComponent();
            TxtTitle.Text = title;
            TxtMessage.Text = message;
            BtnAccept.Content = acceptButtonText;
        }

        private void BtnAccept_Click(object sender, RoutedEventArgs e)
        {
            Result = true;
            this.Close();
        }

        private void BtnCancel_Click(object sender, RoutedEventArgs e)
        {
            Result = false;
            this.Close();
        }
    }
}