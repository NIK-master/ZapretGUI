namespace ZapretGUI.Core
{
    public static class AppConstants
    {
        // Основные
        public const string AppVersion = "v3.5";
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

        // Списки IPSet и Hosts
        public const string FlowsealIpSetUrl = "https://raw.githubusercontent.com/Flowseal/zapret-discord-youtube/refs/heads/main/.service/ipset-service.txt";
        public const string FlowsealHostsUrl = "https://raw.githubusercontent.com/Flowseal/zapret-discord-youtube/refs/heads/main/.service/hosts";
        public const string V3nillaHostsUrl = "https://raw.githubusercontent.com/V3nilla/IPSets-For-Bypass-in-Russia/refs/heads/main/%D0%A0%D0%B0%D0%B7%D0%B1%D0%BB%D0%BE%D0%BA%D0%B8%D1%80%D0%BE%D0%B2%D0%BA%D0%B0%20%D0%BC%D0%BD%D0%BE%D0%B6%D0%B5%D1%81%D1%82%D0%B2%D0%B0%20%D1%81%D0%B5%D1%80%D0%B2%D0%B8%D1%81%D0%BE%D0%B2(%D0%BF%D1%80%D0%B8%D0%BC%D0%B5%D1%80%20-%20ChatGPT)/hosts";

        // Мониторинг сети
        public const string DefaultPingUrl = "https://dynamodb.eu-central-1.amazonaws.com";
        public const string AwsPingHost = "ec2.eu-central-1.amazonaws.com";
        public const int AwsPingPort = 443;
    }
}