using System;

namespace ZapretGUI.Core
{
    public interface IBypassService
    {
        bool IsRunning { get; }
        event Action<string>? LogMessage;
        void Start(string profileName = "");
        void Stop();
    }
}