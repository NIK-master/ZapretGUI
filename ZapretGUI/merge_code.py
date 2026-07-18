import os
from pathlib import Path


def collect_project_files(source_dir, output_file):
    source_path = Path(source_dir)

    # Папки, которые парсер будет пропускать
    ignore_dirs = {'.git', '.vs', 'bin', 'obj', 'packages', 'Properties'}
    # Расширения файлов для сборки
    target_extensions = {'.cs', '.xaml'}

    files_processed = 0

    with open(output_file, 'w', encoding='utf-8') as outfile:
        # Проходим по всем папкам и файлам
        for root, dirs, files in os.walk(source_path):
            # Модифицируем список dirs, чтобы os.walk не заходил в игнорируемые папки
            dirs[:] = [d for d in dirs if d not in ignore_dirs]

            for file in files:
                file_path = Path(root) / file

                # Проверяем нужное ли это расширение
                if file_path.suffix.lower() in target_extensions:
                    # Получаем красивый относительный путь для заголовка
                    rel_path = file_path.relative_to(source_path)

                    # Создаем визуальный разделитель
                    outfile.write(f"\n\n{'/' * 80}\n")
                    outfile.write(f"// ФАЙЛ: {rel_path}\n")
                    outfile.write(f"{'/' * 80}\n\n")

                    # Читаем код и добавляем в общий файл
                    try:
                        with open(file_path, 'r', encoding='utf-8-sig') as infile:
                            outfile.write(infile.read())
                            files_processed += 1
                    except Exception as e:
                        outfile.write(f"// ОШИБКА ЧТЕНИЯ ФАЙЛА: {e}\n")

    return files_processed


if __name__ == "__main__":
    # Указываем текущую директорию как источник
    project_directory = "."
    output_filename = "_FullProjectCode.txt"

    print(f"Начинаю сборку файлов проекта...")
    count = collect_project_files(project_directory, output_filename)

    print(f"Готово! Успешно склеено файлов: {count}")
    print(f"Результат сохранен в: {output_filename}")