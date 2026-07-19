using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;

namespace ZapretGUI.Core
{
    public static class UpdateManager
    {
        public const string CurrentVersion = "v2.0";

        private const string RepoOwner = "NIK-master";
        private const string RepoName = "ZapretGUI";

        private static string CleanVersion(string version)
        {
            if (string.IsNullOrEmpty(version)) return "0.0.0";
            return version.Trim().TrimStart('v', 'V');
        }

        public static async Task CheckForUpdatesAsync()
        {
            try
            {
                using var client = new HttpClient();
                client.DefaultRequestHeaders.Add("User-Agent", "ZapretForADHD-App");

                var url = $"https://api.github.com/repos/{RepoOwner}/{RepoName}/releases/latest";
                var response = await client.GetStringAsync(url);

                using var doc = JsonDocument.Parse(response);
                var latestVersion = doc.RootElement.GetProperty("tag_name").GetString();
                var releaseUrl = doc.RootElement.GetProperty("html_url").GetString();

                if (latestVersion != null && CleanVersion(latestVersion) != CleanVersion(CurrentVersion))
                {
                    System.Windows.Application.Current.Dispatcher.Invoke(() =>
                    {
                        var prompt = new Views.UpdateWindow(
                            "Доступно обновление",
                            $"Доступна новая версия панели управления {latestVersion}!\n\nХотите скачать обновление?"
                        );
                        prompt.ShowDialog();

                        if (prompt.Result && !string.IsNullOrEmpty(releaseUrl))
                        {
                            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(releaseUrl) { UseShellExecute = true });
                        }
                    });
                }
            }
            catch { }
        }

        public static async Task CheckForZapretCoreUpdatesAsync(Action stopServicesCallback, IProgress<string>? progress = null)
        {
            try
            {
                using var client = new HttpClient();
                client.DefaultRequestHeaders.Add("User-Agent", "ZapretForADHD-App");

                var url = "https://api.github.com/repos/flowseal/zapret-discord-youtube/releases/latest";
                var response = await client.GetStringAsync(url);
                using var doc = JsonDocument.Parse(response);

                var latestVersion = doc.RootElement.GetProperty("tag_name").GetString();
                var currentVersion = SettingsManager.Current.ZapretCoreVersion;

                if (latestVersion != null && CleanVersion(latestVersion) != CleanVersion(currentVersion))
                {
                    bool shouldUpdate = false;

                    System.Windows.Application.Current.Dispatcher.Invoke(() =>
                    {
                        var prompt = new Views.UpdateWindow(
                            "Обновление ядра Zapret",
                            $"Найдено обновление обхода Zapret от flowseal ({latestVersion})!\n\nТекущая версия: {currentVersion}\nОбновить автоматически?"
                        );
                        prompt.ShowDialog();
                        shouldUpdate = prompt.Result;
                    });

                    if (shouldUpdate)
                    {
                        await DownloadAndInstallCoreAsync(doc.RootElement, latestVersion, "Zapret", stopServicesCallback, true, progress);
                    }
                }
            }
            catch { }
        }

        public static async Task CheckForTgProxyCoreUpdatesAsync(Action stopServicesCallback, IProgress<string>? progress = null)
        {
            try
            {
                using var client = new HttpClient();
                client.DefaultRequestHeaders.Add("User-Agent", "ZapretForADHD-App");

                var url = "https://api.github.com/repos/flowseal/tg-ws-proxy/releases/latest";
                var response = await client.GetStringAsync(url);
                using var doc = JsonDocument.Parse(response);

                var latestVersion = doc.RootElement.GetProperty("tag_name").GetString();
                var currentVersion = SettingsManager.Current.TgProxyCoreVersion;

                if (latestVersion != null && CleanVersion(latestVersion) != CleanVersion(currentVersion))
                {
                    bool shouldUpdate = false;

                    System.Windows.Application.Current.Dispatcher.Invoke(() =>
                    {
                        var prompt = new Views.UpdateWindow(
                            "Обновление ядра TgWsProxy",
                            $"Найдено обновление прокси Telegram от flowseal ({latestVersion})!\n\nТекущая версия: {currentVersion}\nОбновить автоматически?"
                        );
                        prompt.ShowDialog();
                        shouldUpdate = prompt.Result;
                    });

                    if (shouldUpdate)
                    {
                        await DownloadAndInstallCoreAsync(doc.RootElement, latestVersion, "TgWsProxy", stopServicesCallback, false, progress);
                    }
                }
            }
            catch { }
        }

        // Универсальный метод скачивания и распаковки
        private static async Task DownloadAndInstallCoreAsync(JsonElement root, string latestVersion, string archivePrefix, Action? stopServicesCallback, bool isZapret, IProgress<string>? progress = null, bool isSilent = false)
        {
            try
            {
                string? downloadUrl = null;
                bool isZip = false;
                string? targetFileName = null;

                // Умный поиск файла в релизах
                foreach (var asset in root.GetProperty("assets").EnumerateArray())
                {
                    var name = asset.GetProperty("name").GetString();
                    if (string.IsNullOrEmpty(name)) continue;

                    if (isZapret && name.EndsWith(".zip", StringComparison.OrdinalIgnoreCase))
                    {
                        // Если находим архив, в названии которого есть winws - он в приоритете, иначе берем любой .zip
                        if (downloadUrl == null || name.Contains("winws", StringComparison.OrdinalIgnoreCase))
                        {
                            downloadUrl = asset.GetProperty("browser_download_url").GetString();
                            isZip = true;
                        }
                    }
                    else if (!isZapret)
                    {
                        // Для TgProxy ищем exe для винды
                        if (name.EndsWith(".exe", StringComparison.OrdinalIgnoreCase) && name.Contains("windows", StringComparison.OrdinalIgnoreCase))
                        {
                            downloadUrl = asset.GetProperty("browser_download_url").GetString();
                            targetFileName = "TgWsProxy_windows.exe";
                            isZip = false;
                            break;
                        }
                        else if (name.EndsWith(".zip", StringComparison.OrdinalIgnoreCase))
                        {
                            downloadUrl = asset.GetProperty("browser_download_url").GetString();
                            isZip = true;
                            break;
                        }
                    }
                }

                if (downloadUrl == null)
                {
                    if (progress != null) progress.Report($"[ОШИБКА] Подходящий файл релиза не найден.");
                    return;
                }

                stopServicesCallback?.Invoke();

                var extractPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "ZapretFiles");
                Directory.CreateDirectory(extractPath);

                if (isZip)
                {
                    var tempZip = Path.Combine(Path.GetTempPath(), $"{archivePrefix}_update.zip");

                    if (progress != null) progress.Report($"Загрузка {archivePrefix}...");
                    await DownloadFileWithProgressAsync(downloadUrl, tempZip, progress);
                    if (progress != null) progress.Report("Распаковка архива...");

                    using (var archive = ZipFile.OpenRead(tempZip))
                    {
                        // 1. Надежный поиск общей корневой папки внутри ZIP (если она есть)
                        string? rootDirToStrip = null;
                        bool hasFilesAtRoot = false;

                        foreach (var entry in archive.Entries)
                        {
                            if (string.IsNullOrEmpty(entry.FullName)) continue;

                            int slashIndex = entry.FullName.IndexOf('/');
                            if (slashIndex == -1)
                            {
                                hasFilesAtRoot = true;
                                break; // Нашли файл прямо в корне архива
                            }

                            string currentRoot = entry.FullName.Substring(0, slashIndex + 1);
                            if (rootDirToStrip == null)
                                rootDirToStrip = currentRoot;
                            else if (rootDirToStrip != currentRoot)
                            {
                                rootDirToStrip = null; // В архиве несколько папок в корне
                                break;
                            }
                        }

                        if (hasFilesAtRoot) rootDirToStrip = null;

                        // 2. Распаковка с обрезкой пути и принудительным обновлением даты
                        foreach (var entry in archive.Entries)
                        {
                            var entryName = entry.FullName;

                            if (rootDirToStrip != null && entryName.StartsWith(rootDirToStrip))
                                entryName = entryName.Substring(rootDirToStrip.Length);

                            // Пропускаем записи, которые являются самими директориями
                            if (string.IsNullOrEmpty(entryName) || string.IsNullOrEmpty(entry.Name))
                                continue;

                            var destinationPath = Path.GetFullPath(Path.Combine(extractPath, entryName));
                            Directory.CreateDirectory(Path.GetDirectoryName(destinationPath)!);

                            entry.ExtractToFile(destinationPath, overwrite: true);

                            // МАГИЯ ДЛЯ ПРОВОДНИКА: Ставим свежую дату, чтобы ты видел результат обновления
                            File.SetLastWriteTime(destinationPath, DateTime.Now);
                        }
                    }
                    File.Delete(tempZip);
                }
                else
                {
                    // Прямое скачивание .exe (TgWsProxy)
                    var destFilePath = Path.Combine(extractPath, targetFileName!);
                    if (progress != null) progress.Report($"Загрузка {archivePrefix}...");
                    await DownloadFileWithProgressAsync(downloadUrl, destFilePath, progress);
                }

                if (isZapret)
                    SettingsManager.Current.ZapretCoreVersion = latestVersion;
                else
                    SettingsManager.Current.TgProxyCoreVersion = latestVersion;

                SettingsManager.Save();

                if (!isSilent)
                {
                    System.Windows.Application.Current.Dispatcher.Invoke(() =>
                    {
                        var msg = new Views.UpdateWindow("Успех", $"Модуль {archivePrefix} успешно обновлен до версии {latestVersion}!", "ОК");
                        msg.ShowDialog();
                    });
                }

                if (progress != null) progress.Report("✅ Обновление успешно завершено.");
            }
            catch (Exception ex)
            {
                if (!isSilent)
                {
                    System.Windows.Application.Current.Dispatcher.Invoke(() =>
                    {
                        var msg = new Views.UpdateWindow("Ошибка", $"Ошибка при установке обновления {archivePrefix}: {ex.Message}", "ОК");
                        msg.ShowDialog();
                    });
                }
                if (progress != null) 
                    progress.Report("🛑 Ошибка загрузки обновления.");
            }
        }

        private static async Task DownloadFileWithProgressAsync(string downloadUrl, string destinationFilePath, IProgress<string>? progress)
        {
            using var client = new HttpClient();

            using var response = await client.GetAsync(downloadUrl, HttpCompletionOption.ResponseHeadersRead);
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
                if (read == 0)
                {
                    isMoreToRead = false;
                }
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
        public static async Task InstallModulesSilentAsync(bool installZapret, bool installProxy, IProgress<string> progress)
        {
            using var client = new HttpClient();
            client.DefaultRequestHeaders.Add("User-Agent", "ZapretForADHD-App");

            if (installZapret)
            {
                progress.Report("Поиск последней версии Zapret...");
                var zapretUrl = "https://api.github.com/repos/flowseal/zapret-discord-youtube/releases/latest";
                var zResponse = await client.GetStringAsync(zapretUrl);
                using var zDoc = JsonDocument.Parse(zResponse);
                var zLatest = zDoc.RootElement.GetProperty("tag_name").GetString();

                await DownloadAndInstallCoreAsync(zDoc.RootElement, zLatest!, "Zapret", null, true, progress, isSilent: true);
            }

            if (installProxy)
            {
                progress.Report("Поиск последней версии TgWsProxy...");
                var proxyUrl = "https://api.github.com/repos/flowseal/tg-ws-proxy/releases/latest";
                var pResponse = await client.GetStringAsync(proxyUrl);
                using var pDoc = JsonDocument.Parse(pResponse);
                var pLatest = pDoc.RootElement.GetProperty("tag_name").GetString();

                await DownloadAndInstallCoreAsync(pDoc.RootElement, pLatest!, "TgWsProxy", null, false, progress, isSilent: true);
            }
        }
    }
}