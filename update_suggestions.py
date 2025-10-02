from pathlib import Path
import re

path = Path('src/App.tsx')
text = path.read_bytes()
text_str = text.decode('latin-1')
pattern = re.compile(r"suggestions=\{\[[\s\S]*?\]\}")
text_str, count = pattern.subn("suggestions={['mode sombre','chapitre analyse','relance analyse']}", text_str, count=1)
print('replacements', count)
path.write_text(text_str, encoding='utf-8')
