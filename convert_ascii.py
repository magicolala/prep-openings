from pathlib import Path
import unicodedata

targets = [
    Path('src/ui/components/PrepSheetView.tsx'),
    Path('src/ui/components/AchievementPanel.tsx'),
]

for path in targets:
    text = path.read_text(encoding='latin-1')
    normalized = unicodedata.normalize('NFKD', text)
    ascii_text = normalized.encode('ascii', 'ignore').decode('ascii')
    path.write_text(ascii_text, encoding='utf-8')
