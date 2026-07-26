using System;
using System.Collections.Generic;
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
            PrepareSkeletons();
        }

        private void PrepareSkeletons()
        {
            var skeletons = new List<DcResult>();
            int[] dcs = { 1, 2, 3, 4, 5 };
            int[] ports = { 443, 80, 5222 };

            foreach (var dc in dcs)
            {
                foreach (var port in ports)
                {
                    skeletons.Add(new DcResult { DcId = dc, Port = port, IsLoading = true });
                }
            }
            DcItemsControl.ItemsSource = skeletons;
        }

        private async void BtnRunDiagnostics_Click(object sender, RoutedEventArgs e)
        {
            AudioHelper.PlayClick();

            BtnRunDiagnostics.IsEnabled = false;
            MainProgress.Value = 0;
            MainProgress.Visibility = Visibility.Visible;

            PrepareSkeletons(); 

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
            MainProgress.Visibility = Visibility.Collapsed;
            BtnRunDiagnostics.IsEnabled = true;

            AudioHelper.PlaySuccess();
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

            var successColor = (System.Windows.Media.SolidColorBrush)System.Windows.Application.Current.Resources["BrandSuccessBrush"];
            var errorColor = (System.Windows.Media.SolidColorBrush)System.Windows.Application.Current.Resources["BrandErrorBrush"];

            DotTelegram.Fill = status.TelegramRunning ? successColor : errorColor;
            DotDiscord.Fill = status.DiscordRunning ? successColor : errorColor;
            DotZapret.Fill = status.ZapretRunning ? successColor : errorColor;
            DotTgProxy.Fill = status.TgWsProxyRunning ? successColor : errorColor;

            RecItemsControl.ItemsSource = report.Recommendations;
            DcItemsControl.ItemsSource = report.DcResults; 
        }
    }
}