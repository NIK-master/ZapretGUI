# Antigravity Agent Rules: ZapretGUI Project

## 1. Project Overview & Role
You are assisting in the development and maintenance of ZapretGUI, a Windows desktop application (built with C# .NET 8, Photino, and web technologies) that serves as a graphical interface and launcher for the `zapret` (winws) DPI bypass tool and Telegram WebSocket Proxy.
The core task is managing the interaction between the C# backend (process management, file I/O, diagnostics) and the HTML/JS/CSS frontend (UI, visual effects, settings), ensuring system stability and accurate network configuration.

---

## 2. Process & WinDivert Lifecycle (Critical)
* **Elevation & Privileges**: The application requires Administrator rights (`requireAdministrator` in `app.manifest`)[cite: 1]. All interactions with `WinDivert` and system services must respect this.
* **Process Management**: 
  - Manage `winws.exe` and `TgWsProxy_windows.exe` processes carefully.
  - Never leave orphaned instances running. Use `KillOnJobClose` concepts or explicit tree termination via `ProcessHelper.KillProcessesByName`[cite: 1].
  - Cleanly terminate `winws.exe` so the WinDivert driver unhooks properly.
* **Protected Binaries**: Never modify, delete, or rewrite files in the binary payload directories (e.g., `ZapretFiles/winws.exe`, `WinDivert.dll`, `WinDivert.sys`, `WinDivert64.sys`)[cite: 1].

---

## 3. Architecture & Code Guidelines
* **Stack**: C# .NET 8, Photino.NET (WebView2 host), HTML, Tailwind CSS, Vanilla JS.
* **UI & Engine Separation**:
  - The C# backend handles system-level operations (process execution, network diagnostics, file management).
  - The Web UI (`wwwroot/index.html`, `js/app.js`) handles presentation and user interaction[cite: 1].
  - Communication happens via `WebBridge` (JSON serialization)[cite: 1].
* **Asynchronous Operations**:
  - All process execution, stdout/stderr reading, and network checks (ping, sockets) must run asynchronously (`async`/`await`, `Task.Run`) to prevent blocking the UI thread[cite: 1].
* **Output Streaming**:
  - Log output from `winws.exe` and `TgWsProxy` is streamed to the UI via `BypassController.Current.OnLog` and `WebBridge`[cite: 1].

---

## 4. File I/O & Encoding
* **Configuration Storage**:
  - User settings are saved in `config.json` next to the executable[cite: 1].
* **Domain Lists**:
  - Domain lists (`list-general.txt`, etc.) must be read and written in **UTF-8 without BOM**.
  - Preserve clean newline characters and ignore empty lines or comments starting with `#`.
* **Mod System**:
  - Mods are stored in the `Mods` directory (`strategies` or `lists`)[cite: 1].
  - Mod metadata is stored in `mod.json`[cite: 1].

---

## 5. Agent Constraints & Safety
* **Terminal Operations**:
  - Do NOT execute commands that modify system network adapters, reset DNS, or delete system drivers without explicit confirmation.
  - Do NOT commit generated logs, crash dumps, or temporary driver files to source control.
* **System Files**:
  - Editing the system `hosts` file requires care. Use the established markers (`# >>> ZAPRET FOR ADHD HOSTS START >>>`)[cite: 1].
* **Code Style**:
  - Follow the existing C# coding style (e.g., nullable reference types, async suffixes).
  - Ensure JS/HTML changes align with the existing Tailwind CSS usage and custom UI logic.