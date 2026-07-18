using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Shapes;
using ZapretGUI.Views.WizardPages;

namespace ZapretGUI.Views
{
    public partial class WizardWindow : Window
    {
        private List<System.Windows.Controls.UserControl> _pages;
        private int _currentPageIndex = 0;
        private bool _isAnimating = false;

        public WizardWindow()
        {
            InitializeComponent();

            _pages = new List<System.Windows.Controls.UserControl>
            {
                new Step1_IntroPage(),
                new Step2_PrivacyPage(),
                new Step4_ServicesConfig(),
                new Step4_AdditionalSettings(),
                new Step5_FinishPage()
            };

            LoadCurrentPage(false);
        }

        private async void LoadCurrentPage(bool animate = true, bool isGoingBack = false)
        {
            if (animate)
            {
                _isAnimating = true;

                var fadeOut = new DoubleAnimation(1, 0, TimeSpan.FromMilliseconds(150));
                WizardContent.BeginAnimation(OpacityProperty, fadeOut);

                await Task.Delay(150);
            }

            WizardContent.Content = _pages[_currentPageIndex];
            UpdateProgressDots();

            if (_currentPageIndex == 0)
            {
                BtnNextStep.Content = "Начать настройку";
                BtnBack.Visibility = Visibility.Collapsed;
                BtnCloseWizard.Visibility = Visibility.Visible;
            }
            else if (_currentPageIndex == _pages.Count - 2)
            {
                BtnNextStep.Content = "Применить и завершить";
                BtnBack.Visibility = Visibility.Visible;
                BtnCloseWizard.Visibility = Visibility.Visible;
            }
            else if (_currentPageIndex == _pages.Count - 1)
            {
                BtnNextStep.Content = "Закрыть";
                BtnBack.Visibility = Visibility.Collapsed;
                BtnCloseWizard.Visibility = Visibility.Collapsed;
            }
            else
            {
                BtnNextStep.Content = "Далее";
                BtnBack.Visibility = Visibility.Visible;
                BtnCloseWizard.Visibility = Visibility.Visible;
            }

            if (animate)
            {
                ContentTranslate.X = 0;
                ContentTranslate.Y = 0;
                ContentScale.ScaleX = 1;
                ContentScale.ScaleY = 1;

                var fadeIn = new DoubleAnimation(0, 1, TimeSpan.FromMilliseconds(250))
                {
                    EasingFunction = new CubicEase { EasingMode = EasingMode.EaseOut }
                };
                WizardContent.BeginAnimation(OpacityProperty, fadeIn);

                if (isGoingBack)
                {
                    ContentTranslate.X = -30;
                    var slideRight = new DoubleAnimation(-30, 0, TimeSpan.FromMilliseconds(250))
                    {
                        EasingFunction = new CubicEase { EasingMode = EasingMode.EaseOut }
                    };
                    ContentTranslate.BeginAnimation(TranslateTransform.XProperty, slideRight);
                }
                else
                {
                    if (_currentPageIndex == 1)
                    {
                        ContentTranslate.Y = 40;
                        var slideUp = new DoubleAnimation(40, 0, TimeSpan.FromMilliseconds(350))
                        {
                            EasingFunction = new BackEase { Amplitude = 0.3, EasingMode = EasingMode.EaseOut }
                        };
                        ContentTranslate.BeginAnimation(TranslateTransform.YProperty, slideUp);
                    }
                    else if (_currentPageIndex == _pages.Count - 1)
                    {
                        ContentScale.ScaleX = 0.8;
                        ContentScale.ScaleY = 0.8;
                        var zoomIn = new DoubleAnimation(0.8, 1, TimeSpan.FromMilliseconds(350))
                        {
                            EasingFunction = new CircleEase { EasingMode = EasingMode.EaseOut }
                        };
                        ContentScale.BeginAnimation(ScaleTransform.ScaleXProperty, zoomIn);
                        ContentScale.BeginAnimation(ScaleTransform.ScaleYProperty, zoomIn);
                    }
                    else
                    {
                        ContentTranslate.X = 30;
                        var slideLeft = new DoubleAnimation(30, 0, TimeSpan.FromMilliseconds(250))
                        {
                            EasingFunction = new CubicEase { EasingMode = EasingMode.EaseOut }
                        };
                        ContentTranslate.BeginAnimation(TranslateTransform.XProperty, slideLeft);
                    }
                }

                await Task.Delay(350);
                _isAnimating = false;
            }
        }

        private void UpdateProgressDots()
        {
            ProgressDots.Children.Clear();
            for (var i = 0; i < _pages.Count; i++)
            {
                var dot = new Ellipse
                {
                    Width = 8,
                    Height = 8,
                    Margin = new Thickness(4, 0, 4, 0),
                    Fill = i == _currentPageIndex
                        ? new SolidColorBrush((System.Windows.Media.Color)System.Windows.Media.ColorConverter.ConvertFromString("#107C10"))
                        : new SolidColorBrush((System.Windows.Media.Color)System.Windows.Media.ColorConverter.ConvertFromString("#333333"))
                };
                ProgressDots.Children.Add(dot);
            }
        }

        private void BtnCloseWizard_Click(object sender, RoutedEventArgs e)
        {
            this.Close();
        }

        private async void BtnNextStep_Click(object sender, RoutedEventArgs e)
        {
            if (_isAnimating) return;

            if (_currentPageIndex == _pages.Count - 2)
            {
                _currentPageIndex++;
                LoadCurrentPage();

                BtnNextStep.IsEnabled = false;
                BtnCloseWizard.IsEnabled = false;

                var stepServices = _pages[2] as Step4_ServicesConfig;
                var stepSettings = _pages[3] as Step4_AdditionalSettings;
                var stepFinish = _pages[4] as Step5_FinishPage;

                var useZapret = stepServices?.UseZapret ?? true;
                var useTgProxy = stepServices?.UseTgProxy ?? true;

                var autoStart = stepSettings?.IsAutoStart ?? true;
                var focusMode = stepSettings?.IsFocusMode ?? false;
                var colorblind = stepSettings?.IsColorblind ?? false;

                if (stepFinish != null)
                    await stepFinish.RunSetupAsync(useZapret, useTgProxy, autoStart, focusMode, colorblind);

                BtnNextStep.IsEnabled = true;
                BtnNextStep.Content = "Закрыть";
            }
            else if (_currentPageIndex == _pages.Count - 1)
                this.Close();
            else if (_currentPageIndex < _pages.Count - 1)
            {
                _currentPageIndex++;
                LoadCurrentPage();
            }
        }

        private void BtnBack_Click(object sender, RoutedEventArgs e)
        {
            if (_isAnimating) 
                return;

            if (_currentPageIndex > 0)
            {
                _currentPageIndex--;
                LoadCurrentPage(true, true);
            }
        }
    }
}