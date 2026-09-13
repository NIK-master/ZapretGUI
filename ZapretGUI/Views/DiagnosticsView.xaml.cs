using System;
using System.Collections.Generic;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using ZapretGUI.Core;

namespace ZapretGUI.Views
{
    public partial class DiagnosticsView : System.Windows.Controls.UserControl
    {
        private int _discordClickCount = 0;
        private DateTime _lastDiscordClick = DateTime.MinValue;

        private int _tgClickCount = 0;
        private DateTime _lastTgClick = DateTime.MinValue;

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

            var dsSkeletons = new List<DiscordPingResult>
            {
                new DiscordPingResult { Label = "Gateway", IsLoading = true },
                new DiscordPingResult { Label = "Media", IsLoading = true },
                new DiscordPingResult { Label = "API", IsLoading = true }
            };
            DiscordItemsControl.ItemsSource = dsSkeletons;
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
            // Теперь мы вызываем методы прямо из этого же класса
            var tgVerdict = HumanVerdict(report);
            TxtTgMainStatus.Text = tgVerdict.title;
            TxtTgSubStatus.Text = tgVerdict.detail;
            TelegramCard.BorderBrush = UIHelper.GetBrushFromHex(tgVerdict.color);
            TxtTgEmoji.Foreground = UIHelper.GetBrushFromHex(tgVerdict.color);

            var dsVerdict = DiscordVerdict(report);
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
            DiscordItemsControl.ItemsSource = report.DiscordPing;
        }

        // --- ПЕРЕНЕСЕННЫЕ ИЗ ДВИЖКА МЕТОДЫ ОФОРМЛЕНИЯ ---
        private (string emoji, string title, string detail, string color) HumanVerdict(DiagReport r)
        {
            var blocks = new HashSet<BlockType>(r.BlockTypes);
            var app = r.AppStatus;
            int dcOk = r.DcResults.Count(x => x.Ok);
            int dcTot = r.DcResults.Count;
            bool pingOk = r.PingResults.Any(p => p.Ok);
            bool bypass = app != null && app.ZapretRunning;

            bool isCb = SettingsManager.Current.ColorblindMode;
            string successColor = isCb ? "#0078D7" : "#107C10";
            string errorColor = isCb ? "#FF8C00" : "#D13438";
            string warningColor = isCb ? "#FFB900" : "#FF8C00";

            if (app?.TgWsProxyRunning == true)
                return ("🟢", "tg-ws-proxy активен", "Telegram работает через прокси локально.", successColor);

            if (!pingOk && dcOk == 0)
                return ("🔴", "Интернета нет", "Ни один сервер не отвечает.", errorColor);

            if (blocks.Contains(BlockType.SniBlock))
                return bypass
                    ? ("🟢", "Telegram работает (обходчик активен)", "DPI обнаружен, но обходчик запущен.", successColor)
                    : ("🔴", "Telegram заблокирован (DPI)", "Нужен Zapret.", errorColor);

            if (blocks.Contains(BlockType.IpBlock))
                return bypass
                    ? ("🟢", "Telegram работает", "IP заблокированы, но обходчик компенсирует.", successColor)
                    : ("🔴", "Серверы заблокированы", "Нужен VPN.", errorColor);

            if (dcOk >= Math.Max(dcTot / 2, 1))
                return ("🟢", "Telegram работает нормально", "Серверы отвечают быстро.", successColor);

            return ("🟡", "Ситуация неоднозначная", "Проблемы со связью.", warningColor);
        }

        private (string emoji, string title, string detail, string color) DiscordVerdict(DiagReport r)
        {
            var app = r.AppStatus;
            bool bypass = app != null && app.ZapretRunning;

            bool isCb = SettingsManager.Current.ColorblindMode;
            string successColor = isCb ? "#0078D7" : "#107C10";
            string errorColor = isCb ? "#FF8C00" : "#D13438";
            string warningColor = isCb ? "#FFB900" : "#FF8C00";

            if (r.DiscordPing != null && r.DiscordPing.Count > 0 && r.DiscordPing.All(p => !p.Ok))
                return bypass
                    ? ("🟡", "Сбои в Discord", "Обходчик работает, но серверы недоступны. Возможно, стоит сменить профиль.", warningColor)
                    : ("🔴", "Discord полностью заблокирован", "API и Gateway не отвечают. Включи Zapret.", errorColor);

            if (r.UdpResult?.Blocked == true)
                return bypass
                    ? ("🟢", "Discord работает (обходчик активен)", "UDP заблокирован, но Zapret маршрутизирует трафик.", successColor)
                    : ("🟡", "Проблемы с голосом", "Чаты работают, но UDP заблокирован. Звонки не пройдут.", warningColor);

            return ("🟢", "Discord работает нормально", "Все нужные порты и серверы доступны.", successColor);
        }

        // --- ЛОГИКА ПАСХАЛОК ---

        private void TxtDiscordEmoji_MouseDown(object sender, System.Windows.Input.MouseButtonEventArgs e)
        {
            if ((DateTime.Now - _lastDiscordClick).TotalSeconds > 1.5)
                _discordClickCount = 0;

            _discordClickCount++;
            _lastDiscordClick = DateTime.Now;

            if (_discordClickCount >= 5)
            {
                _discordClickCount = 0;
                TriggerDiscordEasterEgg();
            }
        }

        private void TriggerDiscordEasterEgg()
        {
            AudioHelper.PlaySuccess();

            TxtDiscordMainStatus.Text = "Discord (Режим турбо-деда)";
            TxtDiscordMainStatus.Foreground = UIHelper.GetBrushFromHex("#FF00FF");
            TxtDiscordSubStatus.Text = "Никакие блокировки больше не страшны!";

            var anim = new System.Windows.Media.Animation.DoubleAnimation(0, 360, TimeSpan.FromSeconds(0.5))
            {
                EasingFunction = new System.Windows.Media.Animation.BackEase { Amplitude = 0.5, EasingMode = System.Windows.Media.Animation.EasingMode.EaseOut }
            };

            var storyboard = new System.Windows.Media.Animation.Storyboard();
            storyboard.Children.Add(anim);
            System.Windows.Media.Animation.Storyboard.SetTarget(anim, TxtDiscordEmoji);
            System.Windows.Media.Animation.Storyboard.SetTargetProperty(anim, new PropertyPath("(UIElement.RenderTransform).(RotateTransform.Angle)"));
            storyboard.Begin();

            DiscordCard.BorderBrush = UIHelper.GetBrushFromHex("#FF00FF");
            DiscordCard.Background = UIHelper.GetBrushFromHex("#1A001A");
        }

        private void TxtTgEmoji_MouseDown(object sender, System.Windows.Input.MouseButtonEventArgs e)
        {
            if ((DateTime.Now - _lastTgClick).TotalSeconds > 1.5)
                _tgClickCount = 0;

            _tgClickCount++;
            _lastTgClick = DateTime.Now;

            if (_tgClickCount >= 5)
            {
                _tgClickCount = 0;
                TriggerTelegramEasterEgg();
            }
        }

        private void TriggerTelegramEasterEgg()
        {
            AudioHelper.PlaySuccess();

            TxtTgMainStatus.Text = "Telegram (Режим Дурова)";
            TxtTgMainStatus.Foreground = UIHelper.GetBrushFromHex("#00E5FF");
            TxtTgSubStatus.Text = "Свободу интернету! Трафик летит напрямую.";

            var flyX = new System.Windows.Media.Animation.DoubleAnimation(0, 150, TimeSpan.FromSeconds(0.3))
            { EasingFunction = new System.Windows.Media.Animation.PowerEase { EasingMode = System.Windows.Media.Animation.EasingMode.EaseIn } };

            var flyY = new System.Windows.Media.Animation.DoubleAnimation(0, -150, TimeSpan.FromSeconds(0.3))
            { EasingFunction = new System.Windows.Media.Animation.PowerEase { EasingMode = System.Windows.Media.Animation.EasingMode.EaseIn } };

            var fadeOut = new System.Windows.Media.Animation.DoubleAnimation(1, 0, TimeSpan.FromSeconds(0.3));

            var transformGroup = TxtTgEmoji.RenderTransform as System.Windows.Media.TransformGroup;
            var translateTransform = transformGroup?.Children[0] as System.Windows.Media.TranslateTransform;

            if (translateTransform != null)
            {
                flyX.Completed += (s, ev) =>
                {
                    translateTransform.X = -50;
                    translateTransform.Y = 50;

                    var returnX = new System.Windows.Media.Animation.DoubleAnimation(-50, 0, TimeSpan.FromSeconds(0.4))
                    { EasingFunction = new System.Windows.Media.Animation.BackEase { Amplitude = 0.5, EasingMode = System.Windows.Media.Animation.EasingMode.EaseOut } };

                    var returnY = new System.Windows.Media.Animation.DoubleAnimation(50, 0, TimeSpan.FromSeconds(0.4))
                    { EasingFunction = new System.Windows.Media.Animation.BackEase { Amplitude = 0.5, EasingMode = System.Windows.Media.Animation.EasingMode.EaseOut } };

                    var fadeIn = new System.Windows.Media.Animation.DoubleAnimation(0, 1, TimeSpan.FromSeconds(0.4));

                    translateTransform.BeginAnimation(System.Windows.Media.TranslateTransform.XProperty, returnX);
                    translateTransform.BeginAnimation(System.Windows.Media.TranslateTransform.YProperty, returnY);
                    TxtTgEmoji.BeginAnimation(UIElement.OpacityProperty, fadeIn);
                };

                translateTransform.BeginAnimation(System.Windows.Media.TranslateTransform.XProperty, flyX);
                translateTransform.BeginAnimation(System.Windows.Media.TranslateTransform.YProperty, flyY);
                TxtTgEmoji.BeginAnimation(UIElement.OpacityProperty, fadeOut);
            }

            TelegramCard.BorderBrush = UIHelper.GetBrushFromHex("#00E5FF");
            TelegramCard.Background = UIHelper.GetBrushFromHex("#001A22");
        }
    }
}