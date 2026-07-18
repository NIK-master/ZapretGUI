using System.Windows.Controls;

namespace ZapretGUI.Views.WizardPages
{
    public partial class Step4_AdditionalSettings : System.Windows.Controls.UserControl
    {
        public bool IsAutoStart => ToggleAutoStart.IsChecked ?? true;
        public bool IsFocusMode => ToggleFocusMode.IsChecked ?? false;
        public bool IsColorblind => ToggleColorblind.IsChecked ?? false;

        public Step4_AdditionalSettings()
        {
            InitializeComponent();
        }
    }
}