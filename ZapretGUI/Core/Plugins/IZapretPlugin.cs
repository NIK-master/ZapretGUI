namespace ZapretGUI.Core.Plugins
{
    /// <summary>
    /// Точка входа для любого C# плагина.
    /// DLL плагина должна содержать один класс, реализующий этот интерфейс.
    /// </summary>
    public interface IZapretPlugin
    {
        void OnLoad(IModAPI api);
        void OnUnload();
    }
}