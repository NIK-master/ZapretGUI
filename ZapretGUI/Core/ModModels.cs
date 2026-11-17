namespace ZapretGUI.Core
{
    public enum ModType
    {
        BatStrategy,
        DomainList
    }

    public class ModMetaData
    {
        public string UniqueId { get; set; } = "";
        public string Name { get; set; } = "Неизвестный мод";
        public string Author { get; set; } = "Аноним";
        public string Version { get; set; } = "1.0";
        public string Description { get; set; } = "Описание отсутствует.";
        public bool IsBatStrategy { get; set; } = false;
    }

    public class UIModItem
    {
        public string Id { get; set; } = "";
        public ModType Type { get; set; }
        public ModMetaData Meta { get; set; } = new ModMetaData();
        public bool IsActive { get; set; }
    }
}