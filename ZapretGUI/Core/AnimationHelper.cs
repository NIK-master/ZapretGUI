using System;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Media.Effects;

namespace ZapretGUI.Core
{
    public static class AnimationHelper
    {
        public static void PlayGlitchEffect(UIElement grid, TranslateTransform translate, SkewTransform skew, DropShadowEffect shadow)
        {
            var shakeAnim = new DoubleAnimation(0, 10, TimeSpan.FromMilliseconds(40)) { AutoReverse = true, RepeatBehavior = new RepeatBehavior(4) };
            var skewAnim = new DoubleAnimation(0, -3, TimeSpan.FromMilliseconds(30)) { AutoReverse = true, RepeatBehavior = new RepeatBehavior(5) };
            var opacityAnim = new DoubleAnimation(1, 0.6, TimeSpan.FromMilliseconds(50)) { AutoReverse = true, RepeatBehavior = new RepeatBehavior(4) };
            var shadowAnim = new DoubleAnimation(0, -15, TimeSpan.FromMilliseconds(40)) { AutoReverse = true, RepeatBehavior = new RepeatBehavior(4) };

            shadowAnim.Completed += (s, e) => shadow.Opacity = 0;
            shadow.Opacity = 1;

            translate.BeginAnimation(TranslateTransform.XProperty, shakeAnim);
            skew.BeginAnimation(SkewTransform.AngleXProperty, skewAnim);
            grid.BeginAnimation(UIElement.OpacityProperty, opacityAnim);
            shadow.BeginAnimation(DropShadowEffect.ShadowDepthProperty, shadowAnim);
        }

        public static void ShowOverlay(UIElement overlayGrid, FrameworkElement contentBorder)
        {
            overlayGrid.Visibility = Visibility.Visible;
            overlayGrid.Opacity = 0;

            overlayGrid.BeginAnimation(UIElement.OpacityProperty, new DoubleAnimation(0, 1, TimeSpan.FromSeconds(0.2)));

            if (contentBorder.RenderTransform is TransformGroup transformGroup)
            {
                var scale = transformGroup.Children[0] as ScaleTransform;
                var translate = transformGroup.Children[1] as TranslateTransform;

                if (scale != null && translate != null)
                {
                    var scaleUp = new DoubleAnimation(0.95, 1, TimeSpan.FromSeconds(0.2)) { EasingFunction = new CubicEase { EasingMode = EasingMode.EaseOut } };
                    var slideUp = new DoubleAnimation(10, 0, TimeSpan.FromSeconds(0.2)) { EasingFunction = new CubicEase { EasingMode = EasingMode.EaseOut } };
                    scale.BeginAnimation(ScaleTransform.ScaleXProperty, scaleUp);
                    scale.BeginAnimation(ScaleTransform.ScaleYProperty, scaleUp);
                    translate.BeginAnimation(TranslateTransform.YProperty, slideUp);
                }
            }
        }

        public static void HideOverlay(UIElement overlayGrid, FrameworkElement contentBorder)
        {
            var fadeOut = new DoubleAnimation(1, 0, TimeSpan.FromSeconds(0.15));
            fadeOut.Completed += (s, ev) => overlayGrid.Visibility = Visibility.Collapsed;
            overlayGrid.BeginAnimation(UIElement.OpacityProperty, fadeOut);

            if (contentBorder.RenderTransform is TransformGroup transformGroup)
            {
                var scale = transformGroup.Children[0] as ScaleTransform;
                var translate = transformGroup.Children[1] as TranslateTransform;

                if (scale != null && translate != null)
                {
                    var scaleDown = new DoubleAnimation(1, 0.95, TimeSpan.FromSeconds(0.15)) { EasingFunction = new CubicEase { EasingMode = EasingMode.EaseIn } };
                    var slideDown = new DoubleAnimation(0, 10, TimeSpan.FromSeconds(0.15)) { EasingFunction = new CubicEase { EasingMode = EasingMode.EaseIn } };
                    scale.BeginAnimation(ScaleTransform.ScaleXProperty, scaleDown);
                    scale.BeginAnimation(ScaleTransform.ScaleYProperty, scaleDown);
                    translate.BeginAnimation(TranslateTransform.YProperty, slideDown);
                }
            }
        }

        public static async Task SlideOutAndHideAsync(FrameworkElement element, bool isRightDirection, int durationMs = 150)
        {
            var fadeOut = new DoubleAnimation(1, 0, TimeSpan.FromMilliseconds(durationMs));
            var slideOut = new DoubleAnimation(0, isRightDirection ? 30 : -30, TimeSpan.FromMilliseconds(durationMs));

            element.RenderTransform = new TranslateTransform();
            element.BeginAnimation(UIElement.OpacityProperty, fadeOut);
            element.RenderTransform.BeginAnimation(TranslateTransform.XProperty, slideOut);

            await Task.Delay(durationMs);
        }
    }
}