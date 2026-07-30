using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;

namespace ZapretGUI.Core
{
    public class AppUpdateResult
    {
        public bool UpdateAvailable { get; set; }
        public string Version { get; set; } = "";
        public string DownloadUrl { get; set; } = "";
        public string ReleaseUrl { get; set; } = "";
    }

    public class CoreUpdateResult
    {
        public bool UpdateAvailable { get; set; }
        public string Version { get; set; } = "";
        public string CoreName { get; set; } = "";
        public string CurrentVersion { get; set; } = "";
        public string DownloadUrl { get; set; } = "";
        public string TargetFileName { get; set; } = "";
        public bool IsZip { get; set; }
    }

    public static class UpdateManager
    {
        public const string CurrentVersion = "v2.0";

        private static readonly HttpClient _httpClient = new HttpClient();

        static UpdateManager()
        {
            _httpClient.DefaultRequestHeaders.Add("User-Agent", AppConstants.GithubUserAgent);
        }

        private static string CleanVersion(string version)
        {
            if (string.IsNullOrEmpty(version)) return "0.0.0";
            return version.Trim().TrimStart('v', 'V');
        }

        public static async Task<AppUpdateResult> CheckForAppUpdateAsync()
        {
            try
            {
                var url = $"https://api.github.com/repos/{AppConstants.RepoOwner}/{AppConstants.RepoName}/releases/latest";
                var response = await _httpClient.GetStringAsync(url);

                using var doc = JsonDocument.Parse(response);
                var latestVersion = doc.RootElement.GetProperty("tag_name").GetString();

                if (latestVersion != null && CleanVersion(latestVersion) != CleanVersion(CurrentVersion))
                {
                    var downloadUrl = "";
                    foreach (var asset in doc.RootElement.GetProperty("assets").EnumerateArray())
                    {
                        var name = asset.GetProperty("name").GetString();
                        if (!string.IsNullOrEmpty(name) && name.EndsWith(".zip", StringComparison.OrdinalIgnoreCase))
                        {
                            downloadUrl = asset.GetProperty("browser_download_url").GetString() ?? "";
                            break;
                        }
                    }

                    return new AppUpdateResult
                    {
                        UpdateAvailable = true,
                        Version = latestVersion,
                        DownloadUrl = downloadUrl,
                        ReleaseUrl = doc.RootElement.GetProperty("html_url").GetString() ?? ""
                    };
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Ошибка при проверке обновлений GUI: {ex.Message}");
            }

            return new AppUpdateResult { UpdateAvailable = false };
        }

        public static async Task<CoreUpdateResult> CheckForCoreUpdateAsync(string repoUrl, string currentVersion, string coreName, bool isZapret)
        {
            try
            {
                var response = await _httpClient.GetStringAsync(repoUrl);
                using var doc = JsonDocument.Parse(response);

                var latestVersion = doc.RootElement.GetProperty("tag_name").GetString();

                if (latestVersion != null && CleanVersion(latestVersion) != CleanVersion(currentVersion))
                {
                    var downloadUrl = "";
                    var targetFileName = "";
                    var isZip = false;

                    foreach (var asset in doc.RootElement.GetProperty("assets").EnumerateArray())
                    {
                        var name = asset.GetProperty("name").GetString();
                        if (string.IsNullOrEmpty(name)) continue;

                        if (isZapret && name.EndsWith(".zip", StringComparison.OrdinalIgnoreCase))
                        {
                            if (string.IsNullOrEmpty(downloadUrl) || name.Contains("winws", StringComparison.OrdinalIgnoreCase))
                            {
                                downloadUrl = asset.GetProperty("browser_download_url").GetString() ?? "";
                                isZip = true;
                            }
                        }
                        else if (!isZapret)
                        {
                            if (name.EndsWith(".exe", StringComparison.OrdinalIgnoreCase) && name.Contains("windows", StringComparison.OrdinalIgnoreCase))
                            {
                                downloadUrl = asset.GetProperty("browser_download_url").GetString() ?? "";
                                targetFileName = $"{AppConstants.TgProxyProcessName}.exe";
                                isZip = false;
                                break;
                            }
                            else if (name.EndsWith(".zip", StringComparison.OrdinalIgnoreCase))
                            {
                                downloadUrl = asset.GetProperty("browser_download_url").GetString() ?? "";
                                isZip = true;
                                break;
                            }
                        }
                    }

                    if (!string.IsNullOrEmpty(downloadUrl))
                    {
                        return new CoreUpdateResult
                        {
                            UpdateAvailable = true,
                            Version = latestVersion,
                            CurrentVersion = currentVersion,
                            CoreName = coreName,
                            DownloadUrl = downloadUrl,
                            TargetFileName = targetFileName,
                            IsZip = isZip
                        };
                    }
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Ошибка при проверке обновлений {coreName}: {ex.Message}");
            }

            return new CoreUpdateResult { UpdateAvailable = false };
        }

        public static async Task InstallCoreAsync(CoreUpdateResult updateInfo, Action? stopServicesCallback, IProgress<string>? progress = null)
        {
            if (string.IsNullOrEmpty(updateInfo.DownloadUrl))
                throw new Exception("Подходящий файл релиза не найден.");

            stopServicesCallback?.Invoke();

            ProcessHelper.KillProcessesByName(AppConstants.ZapretProcessName);
            ProcessHelper.KillProcessesByName(AppConstants.TgProxyProcessName);

            await Task.Delay(500);

            var extractPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, AppConstants.CoreFilesDirectory);
            Directory.CreateDirectory(extractPath);

            if (updateInfo.IsZip)
            {
                var tempZip = Path.Combine(Path.GetTempPath(), $"{updateInfo.CoreName}_update.zip");

                progress?.Report($"Загрузка {updateInfo.CoreName}...");
                await DownloadFileWithProgressAsync(updateInfo.DownloadUrl, tempZip, progress);
                progress?.Report("Распаковка архива...");

                using (var archive = ZipFile.OpenRead(tempZip))
                {
                    string? rootDirToStrip = null;
                    var hasFilesAtRoot = false;

                    foreach (var entry in archive.Entries)
                    {
                        if (string.IsNullOrEmpty(entry.FullName)) continue;
                        var slashIndex = entry.FullName.IndexOf('/');
                        if (slashIndex == -1) { hasFilesAtRoot = true; break; }
                        var currentRoot = entry.FullName.Substring(0, slashIndex + 1);
                        if (rootDirToStrip == null) rootDirToStrip = currentRoot;
                        else if (rootDirToStrip != currentRoot) { rootDirToStrip = null; break; }
                    }

                    if (hasFilesAtRoot) rootDirToStrip = null;

                    foreach (var entry in archive.Entries)
                    {
                        var entryName = entry.FullName;
                        if (rootDirToStrip != null && entryName.StartsWith(rootDirToStrip))
                            entryName = entryName.Substring(rootDirToStrip.Length);

                        if (string.IsNullOrEmpty(entryName) || string.IsNullOrEmpty(entry.Name))
                            continue;

                        var destinationPath = Path.GetFullPath(Path.Combine(extractPath, entryName));
                        Directory.CreateDirectory(Path.GetDirectoryName(destinationPath)!);

                        entry.ExtractToFile(destinationPath, overwrite: true);
                        File.SetLastWriteTime(destinationPath, DateTime.Now);
                    }
                }
                File.Delete(tempZip);
            }
            else
            {
                var destFilePath = Path.Combine(extractPath, updateInfo.TargetFileName);
                progress?.Report($"Загрузка {updateInfo.CoreName}...");
                await DownloadFileWithProgressAsync(updateInfo.DownloadUrl, destFilePath, progress);
            }

            progress?.Report("✅ Обновление успешно завершено.");
        }

        public static async Task ApplyAppUpdateAsync(string downloadUrl, Action shutdownAppCallback)
        {
            var tempDir = Path.Combine(Path.GetTempPath(), "ZapretGUI_Update");
            var tempZip = Path.Combine(tempDir, "update.zip");
            var extractDir = Path.Combine(tempDir, "Extracted");

            if (Directory.Exists(tempDir)) Directory.Delete(tempDir, true);

            Directory.CreateDirectory(tempDir);
            Directory.CreateDirectory(extractDir);

            await DownloadFileWithProgressAsync(downloadUrl, tempZip, null);
            ZipFile.ExtractToDirectory(tempZip, extractDir, overwriteFiles: true);

            var extractedExe = Directory.GetFiles(extractDir, "*.exe").FirstOrDefault();
            var sourceExePath = extractedExe ?? Path.Combine(extractDir, "ZapretGUI.exe");

            var currentAppDir = AppDomain.CurrentDomain.BaseDirectory;
            var currentExePath = System.Reflection.Assembly.GetExecutingAssembly().Location;
            currentExePath = Path.ChangeExtension(currentExePath, ".exe");

            var batPath = Path.Combine(tempDir, "updater.bat");
            var batContent = $@"@echo off
chcp 65001 > nul
echo Обновление панели управления... Пожалуйста, подождите.
timeout /t 3 /nobreak > nul
copy /Y ""{sourceExePath}"" ""{currentExePath}""
if not exist ""{Path.Combine(currentAppDir, AppConstants.CoreFilesDirectory)}"" (
    xcopy /Y /E /I ""{Path.Combine(extractDir, AppConstants.CoreFilesDirectory)}"" ""{Path.Combine(currentAppDir, AppConstants.CoreFilesDirectory)}""
)
start """" ""{currentExePath}""
rmdir /S /Q ""{tempDir}""
del ""%~f0""
";
            File.WriteAllText(batPath, batContent, System.Text.Encoding.UTF8);

            Process.Start(new ProcessStartInfo { FileName = batPath, UseShellExecute = true, WindowStyle = ProcessWindowStyle.Hidden });

            shutdownAppCallback?.Invoke();
        }

        public static async Task InstallModulesSilentAsync(bool installZapret, bool installProxy, IProgress<string> progress)
        {
            if (installZapret)
            {
                progress.Report("Поиск последней версии Zapret...");
                var zapretUpdate = await CheckForCoreUpdateAsync("https://api.github.com/repos/flowseal/zapret-discord-youtube/releases/latest", "0.0.0", "Zapret", true);
                if (zapretUpdate.UpdateAvailable)
                {
                    await InstallCoreAsync(zapretUpdate, null, progress);
                    SettingsManager.Current.ZapretCoreVersion = zapretUpdate.Version;
                }
            }

            if (installProxy)
            {
                progress.Report("Поиск последней версии TgWsProxy...");
                var proxyUpdate = await CheckForCoreUpdateAsync("https://api.github.com/repos/flowseal/tg-ws-proxy/releases/latest", "0.0.0", "TgWsProxy", false);
                if (proxyUpdate.UpdateAvailable)
                {
                    await InstallCoreAsync(proxyUpdate, null, progress);
                    SettingsManager.Current.TgProxyCoreVersion = proxyUpdate.Version;
                }
            }
        }

        private static async Task DownloadFileWithProgressAsync(string downloadUrl, string destinationFilePath, IProgress<string>? progress)
        {
            using var response = await _httpClient.GetAsync(downloadUrl, HttpCompletionOption.ResponseHeadersRead);
            response.EnsureSuccessStatusCode();

            var totalBytes = response.Content.Headers.ContentLength ?? -1L;
            var canReportProgress = totalBytes != -1;

            using var contentStream = await response.Content.ReadAsStreamAsync();
            using var fileStream = new FileStream(destinationFilePath, FileMode.Create, FileAccess.Write, FileShare.None, 8192, true);

            var buffer = new byte[8192];
            var isMoreToRead = true;
            var totalRead = 0L;

            do
            {
                var read = await contentStream.ReadAsync(buffer, 0, buffer.Length);
                if (read == 0) isMoreToRead = false;
                else
                {
                    await fileStream.WriteAsync(buffer, 0, read);
                    totalRead += read;

                    if (canReportProgress)
                    {
                        var percentage = Math.Round((double)totalRead / totalBytes * 100, 1);
                        progress?.Report($"Скачивание: {percentage}%");
                    }
                    else
                    {
                        progress?.Report($"Скачано: {totalRead / 1024 / 1024} МБ");
                    }
                }
            }
            while (isMoreToRead);
        }
    }
}