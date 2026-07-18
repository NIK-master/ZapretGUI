using System;
using System.Text;
using System.Windows;
using System.Windows.Threading;

namespace ZapretGUI.Views
{
    public partial class SplashWindow : Window
    {
        private DispatcherTimer _timer;
        private int _currentLineIndex = 0;
        private StringBuilder _consoleContent = new StringBuilder();
        private readonly Random _random = new Random();

        private readonly string[] _logLines = new string[]
        {
            "[ SYSTEM ] ADHD Engine initiated. Focus level: 4%",
            "[ OK     ] Coffee levels detected: Critical but acceptable.",
            "[ INFO   ] Inspecting deep internet blockages...",
            "[ SEARCH ] Looking for winws.exe...",
            "[ SEARCH ] Looking for tgwsproxy.exe...",
            "[ SEARCH ] Getting distracted by a random Wikipedia article...",
            "[ FIX    ] Focus restored! Files found.",
            "[ WARN   ] WinDivert64.sys loading... Please don't close this window or look at shiny objects.",
            "[ OK     ] WinDivert driver injected successfully.",
            "[ SOCKS5 ] tgwsproxy spinning up on port 1080...",
            "[ PACKET ] Fragmentation: ENABLED",
            "[ PACKET ] HTTP Host Spoofing: ACTIVE",
            "[ PACKET ] HTTPS SNI Trickery: ACTIVE",
            "[ BYPASS ] Shaking hands with forbidden packets...",
            "[ BYPASS ] Harder... Faster... Better... Stronger...",
            "[ OK     ] DPI bypassed! Access to the matrix granted.",
            "[ STATUS ] BYPASS ACTIVE. GO WATCH YOUTUBE IN 4K NOW!",
            "==========================================================================",
            "  ____   _    ____   ____   _____ _____   ______ ____   ____     ",
            " /_  /  / |  / __ \\ / __ \\ / ___//__  /   / ____// __ \\ / __ \\    ",
            "  / /  / /| |/ /_/ // /_/ // __/    / /   / /_   / / / // /_/ /    ",
            " / /_ / ___// ____// _, _// /___   / /   / __/  / /_/ // _, _/     ",
            "/____/_/  |_/_/   /_/ |_|/_____/  /_/   /_/     \\____//_/ |_|      ",
            "                                                                    ",
            "            ___     ____   _   _   ____                             ",
            "           /   |   / __ \\ / / / / / __ \\                            ",
            "          / /| |  / / / // /_/ / / / / /                            ",
            "         / ___ | / /_/ // __  / / /_/ /                             ",
            "        /_/  |_|/_____//_/ /_/ /_____/                              ",
            "=========================================================================="
        };

        public SplashWindow()
        {
            InitializeComponent();
            Loaded += SplashWindow_Loaded;
        }

        private void SplashWindow_Loaded(object sender, RoutedEventArgs e)
        {
            _timer = new DispatcherTimer();
            _timer.Tick += Timer_Tick;

            ChangeTimerInterval(10);
            _timer.Start();
        }

        private void Timer_Tick(object? sender, EventArgs e)
        {
            if (_currentLineIndex < _logLines.Length)
            {
                var currentLine = _logLines[_currentLineIndex];
                _consoleContent.AppendLine(currentLine);
                TerminalText.Text = _consoleContent.ToString();
                ConsoleScroll.ScrollToBottom();

                _currentLineIndex++;

                if (currentLine.Contains("Wikipedia"))
                    ChangeTimerInterval(1300);
                else if (currentLine.Contains("___") || currentLine.Contains("===") || currentLine.Contains("/_"))
                    ChangeTimerInterval(30);
                else
                    ChangeTimerInterval(_random.Next(15, 120));
            }
            else
            {
                _timer.Stop();

                var delayTimer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(1000) };
                delayTimer.Tick += (s, args) =>
                {
                    delayTimer.Stop();
                    this.Close();
                };
                delayTimer.Start();
            }
        }

        private void ChangeTimerInterval(int milliseconds)
        {
            _timer.Interval = TimeSpan.FromMilliseconds(milliseconds);
        }
    }
}