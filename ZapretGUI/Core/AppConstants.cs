namespace ZapretGUI.Core
{
    public static class AppConstants
    {
        // Основные
        public const string CoreFilesDirectory = "ZapretFiles";
        public const string ModsDirectory = "Mods";
        public const string ZapretProcessName = "winws";
        public const string TgProxyProcessName = "TgWsProxy_windows";
        public const string GithubUserAgent = "ZapretForADHD-App";
        public const string AppRegistryName = "ZapretForADHD";

        // GitHub Репозитории
        public const string RepoOwner = "NIK-master";
        public const string RepoName = "ZapretGUI";
        public const string ZapretCoreRepoUrl = "https://api.github.com/repos/flowseal/zapret-discord-youtube/releases/latest";
        public const string TgProxyCoreRepoUrl = "https://api.github.com/repos/flowseal/tg-ws-proxy/releases/latest";

        // Мониторинг сети
        public const string DefaultPingUrl = "https://dynamodb.eu-central-1.amazonaws.com";
        public const string AwsPingHost = "ec2.eu-central-1.amazonaws.com";
        public const int AwsPingPort = 443;
    }
}