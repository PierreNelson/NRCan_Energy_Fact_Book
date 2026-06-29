"""One-off: generate page111_barrel_shell.svg from page111_bg.svg."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
src_path = ROOT / 'src/assets/page111_bg.svg'
out_path = ROOT / 'src/assets/page111_barrel_shell.svg'

src = src_path.read_text(encoding='utf-8')
IX1, IX2, IY1, IY2 = 26, 190, 25, 246


def in_interior(x, y, w, h):
    cx, cy = x + w / 2, y + h / 2
    return IX1 <= cx <= IX2 and IY1 <= cy <= IY2


out = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="331" height="260" viewBox="0 0 331 260" shape-rendering="crispEdges">',
    '  <rect width="331" height="260" fill="#ffffff"/>',
]

for m in re.finditer(r'<g fill="([^"]+)">\s*((?:\s*<rect[^/]*/>)+)\s*</g>', src):
    fill, rects_block = m.group(1), m.group(2)
    kept = []
    for rm in re.finditer(r'<rect x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)"/>', rects_block):
        x, y, w, h = map(int, rm.groups())
        if not in_interior(x, y, w, h):
            kept.append(rm.group(0))
    if kept:
        out.append(f'  <g fill="{fill}">')
        out.extend(f'    {r}' for r in kept)
        out.append('  </g>')

out.append('  <rect x="115" y="20" width="216" height="240" fill="#ffffff"/>')
out.append('</svg>')
out_path.write_text('\n'.join(out) + '\n', encoding='utf-8')
print(f'Wrote {out_path} ({len(out)} lines)')
