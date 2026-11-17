using System.Collections.Generic;

namespace ZapretGUI.Core
{
    public enum ModType
    {
        BatStrategy,
        DomainList,
        Theme,
        Plugin,
        Library
    }

    public class ModDependency
    {
        public string ModId { get; set; } = "";
        public string MinVersion { get; set; } = "1.0";
    }

    public class ModMetaData
    {
        public string UniqueId { get; set; } = "";
        public string Name { get; set; } = "Неизвестный мод";
        public string Author { get; set; } = "Аноним";
        public string Version { get; set; } = "1.0";
        public string Description { get; set; } = "Описание отсутствует.";
        public ModType Type { get; set; } = ModType.BatStrategy;

        public string EntryPoint { get; set; } = "";

        public List<ModDependency> Dependencies { get; set; } = new();

        public bool IsBatStrategy
        {
            get => Type == ModType.BatStrategy;
            set { if (value) Type = ModType.BatStrategy; }
        }
    }

    public class UIModItem
    {
        public string Id { get; set; } = "";
        public ModType Type { get; set; }
        public ModMetaData Meta { get; set; } = new ModMetaData();
        public bool IsActive { get; set; }
    }
}