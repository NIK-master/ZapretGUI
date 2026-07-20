using System;
using System.Windows;
using System.Windows.Controls;
using ZapretGUI.Core;

namespace ZapretGUI.Views
{
    public partial class DiagnosticsView : System.Windows.Controls.UserControl
    {
        public DiagnosticsView()
        {
            InitializeComponent();
        }

        private async void BtnRunDiagnostics_Click(object sender, RoutedEventArgs e)
        {
            BtnRunDiagnostics.IsEnabled = false;
            MainProgress.Value = 0;

            Action<double, string> progressCallback = (p, text) =>
            {
                Dispatcher.Invoke(() =>
                {
                    MainProgress.Value = p * 100;
                    TxtStatus.Text = text;
                });
            };

            var report = await DiagnosticsEngine.RunFullDiagnosticsAsync(progressCallback);

            UpdateUI(report);

            TxtStatus.Text = "Проверка завершена.";
            BtnRunDiagnostics.IsEnabled = true;
        }

        private void UpdateUI(DiagReport report)
        {
            var tgVerdict = DiagnosticsEngine.HumanVerdict(report);
            TxtTgMainStatus.Text = tgVerdict.title;
            TxtTgSubStatus.Text = tgVerdict.detail;
            TelegramCard.BorderBrush = UIHelper.GetBrushFromHex(tgVerdict.color);
            TxtTgEmoji.Foreground = UIHelper.GetBrushFromHex(tgVerdict.color);

            var dsVerdict = DiagnosticsEngine.DiscordVerdict(report);
            TxtDiscordMainStatus.Text = dsVerdict.title;
            TxtDiscordSubStatus.Text = dsVerdict.detail;
            DiscordCard.BorderBrush = UIHelper.GetBrushFromHex(dsVerdict.color);

            var status = report.AppStatus ?? new AppStatus();
            DotTelegram.Fill = status.TelegramRunning ? UIHelper.GetBrushFromHex("#107C10") : UIHelper.GetBrushFromHex("#D13438");
            DotDiscord.Fill = status.DiscordRunning ? UIHelper.GetBrushFromHex("#107C10") : UIHelper.GetBrushFromHex("#D13438");
            DotZapret.Fill = status.ZapretRunning ? UIHelper.GetBrushFromHex("#107C10") : UIHelper.GetBrushFromHex("#D13438");
            DotTgProxy.Fill = status.TgWsProxyRunning ? UIHelper.GetBrushFromHex("#107C10") : UIHelper.GetBrushFromHex("#D13438");

            RecItemsControl.ItemsSource = report.Recommendations;
            DcItemsControl.ItemsSource = report.DcResults;
        }
    }
}