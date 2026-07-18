using System;
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

        // Замени на свой ник, когда выложишь интерфейс в общий доступ
        private const string RepoOwner = "YourGithubUsername";
        private const string RepoName = "ZapretForADHD";

        // ИСПРАВЛЕНИЕ: Добавлен модификатор static
        private static string CleanVersion(string version)
        {
            if (string.IsNullOrEmpty(version)) return "0.0.0";
            return version.Trim().TrimStart('v', 'V');
        }

        // 1. Проверка обновления самого графического интерфейса
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
                        var result = System.Windows.MessageBox.Show(
                            $"Доступна новая версия панели управления {latestVersion}!\n\nХотите скачать обновление?",
                            "Доступно обновление",
                            System.Windows.MessageBoxButton.YesNo,
                            System.Windows.MessageBoxImage.Information);

                        if (result == System.Windows.MessageBoxResult.Yes && !string.IsNullOrEmpty(releaseUrl))
                        {
                            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(releaseUrl) { UseShellExecute = true });
                        }
                    });
                }
            }
            catch { }
        }

        // 2. Проверка обновления ядра Zapret (winws.exe) от flowseal
        public static async Task CheckForZapretCoreUpdatesAsync(Action stopServicesCallback)
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
                    // ИСПРАВЛЕНИЕ: Разделяем логику UI и фоновой загрузки для устранения CS4014
                    bool shouldUpdate = false;

                    System.Windows.Application.Current.Dispatcher.Invoke(() =>
                    {
                        var result = System.Windows.MessageBox.Show(
                            $"Найдено обновление обхода Zapret от flowseal ({latestVersion})!\n\nТекущая версия: {currentVersion}\nОбновить автоматически?",
                            "Обновление ядра Zapret",
                            System.Windows.MessageBoxButton.YesNo,
                            System.Windows.MessageBoxImage.Information);

                        shouldUpdate = (result == System.Windows.MessageBoxResult.Yes);
                    });

                    // Загрузка происходит вне Invoke (в фоновом потоке), UI не будет зависать
                    if (shouldUpdate)
                    {
                        await DownloadAndInstallCoreAsync(doc.RootElement, latestVersion, "zapret-winws", stopServicesCallback, true);
                    }
                }
            }
            catch { }
        }

        // 3. Проверка обновления ядра TgWsProxy от flowseal
        public static async Task CheckForTgProxyCoreUpdatesAsync(Action stopServicesCallback)
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
                    // ИСПРАВЛЕНИЕ: Разделяем логику UI и фоновой загрузки для устранения CS4014
                    bool shouldUpdate = false;

                    System.Windows.Application.Current.Dispatcher.Invoke(() =>
                    {
                        var result = System.Windows.MessageBox.Show(
                            $"Найдено обновление прокси Telegram от flowseal ({latestVersion})!\n\nТекущая версия: {currentVersion}\nОбновить автоматически?",
                            "Обновление ядра TgWsProxy",
                            System.Windows.MessageBoxButton.YesNo,
                            System.Windows.MessageBoxImage.Information);

                        shouldUpdate = (result == System.Windows.MessageBoxResult.Yes);
                    });

                    if (shouldUpdate)
                    {
                        await DownloadAndInstallCoreAsync(doc.RootElement, latestVersion, "tg-ws-proxy", stopServicesCallback, false);
                    }
                }
            }
            catch { }
        }

        // Универсальный метод скачивания и распаковки zip-архивов для обоих репозиториев
        private static async Task DownloadAndInstallCoreAsync(JsonElement root, string latestVersion, string archivePrefix, Action stopServicesCallback, bool isZapret)
        {
            try
            {
                string? downloadUrl = null;
                foreach (var asset in root.GetProperty("assets").EnumerateArray())
                {
                    var name = asset.GetProperty("name").GetString();
                    if (name != null && name.EndsWith(".zip"))
                    {
                        downloadUrl = asset.GetProperty("browser_download_url").GetString();
                        break;
                    }
                }

                if (downloadUrl == null) return;

                // Останавливаем службы перед перезаписью бинарников
                stopServicesCallback?.Invoke();

                var tempZip = Path.Combine(Path.GetTempPath(), $"{archivePrefix}_update.zip");
                var extractPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "ZapretFiles");

                using var client = new HttpClient();
                var zipBytes = await client.GetByteArrayAsync(downloadUrl);
                await File.WriteAllBytesAsync(tempZip, zipBytes);

                using (var archive = ZipFile.OpenRead(tempZip))
                {
                    foreach (var entry in archive.Entries)
                    {
                        var entryName = entry.FullName;

                        // Избавляемся от корневых папок внутри zip-архивов flowseal, чтобы файлы ложились сразу в ZapretFiles
                        if (entryName.StartsWith("zapret-winws/"))
                            entryName = entryName.Substring("zapret-winws/".Length);
                        else if (entryName.StartsWith("tg-ws-proxy/"))
                            entryName = entryName.Substring("tg-ws-proxy/".Length);

                        if (string.IsNullOrEmpty(entryName)) continue;

                        var destinationPath = Path.GetFullPath(Path.Combine(extractPath, entryName));
                        Directory.CreateDirectory(Path.GetDirectoryName(destinationPath)!);

                        if (!string.IsNullOrEmpty(entry.Name))
                            entry.ExtractToFile(destinationPath, overwrite: true);
                    }
                }

                File.Delete(tempZip);

                // Сохраняем обновленную версию в соответствующее поле конфигурации
                if (isZapret)
                    SettingsManager.Current.ZapretCoreVersion = latestVersion;
                else
                    SettingsManager.Current.TgProxyCoreVersion = latestVersion;

                SettingsManager.Save();

                System.Windows.Application.Current.Dispatcher.Invoke(() =>
                {
                    System.Windows.MessageBox.Show($"Модуль {archivePrefix} успешно обновлен до версии {latestVersion}!", "Успех", System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Information);
                });
            }
            catch (Exception ex)
            {
                System.Windows.Application.Current.Dispatcher.Invoke(() =>
                {
                    System.Windows.MessageBox.Show($"Ошибка при установке обновления {archivePrefix}: {ex.Message}", "Ошибка", System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Error);
                });
            }
        }
        private static async Task DownloadFileWithProgressAsync(string downloadUrl, string destinationFilePath, IProgress<string> progress)
        {
            using var client = new HttpClient();

            // Запрашиваем только заголовки, чтобы узнать размер файла
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
                        // Если сервер не отдал размер файла
                        progress?.Report($"Скачано: {totalRead / 1024 / 1024} МБ");
                    }
                }
            }
            while (isMoreToRead);
        }
    }
}