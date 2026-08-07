using System.ComponentModel;

namespace ZapretGUI.Core
{
    public enum ModType
    {
        BatStrategy,
        DomainList
    }

    public class ModMetaData
    {
        public string Name { get; set; } = "Неизвестный мод";
        public string Author { get; set; } = "Аноним";
        public string Version { get; set; } = "1.0";
        public string Description { get; set; } = "Описание отсутствует.";
        public bool IsBatStrategy { get; set; } = false;
    }

    public class UIModItem : INotifyPropertyChanged
    {
        public event PropertyChangedEventHandler? PropertyChanged;

        public string Id { get; set; } = "";
        public ModType Type { get; set; }
        public ModMetaData Meta { get; set; } = new ModMetaData();

        private bool _isActive;
        public bool IsActive
        {
            get => _isActive;
            set
            {
                if (_isActive != value)
                {
                    _isActive = value;
                    OnPropertyChanged(nameof(IsActive));
                }
            }
        }

        protected void OnPropertyChanged(string propertyName) =>
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
    }
}