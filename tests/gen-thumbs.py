# Cuts the white floor/background out of the rendered figures, crops to the figure and saves small webp portraits to img/ex/.
import glob, os
from PIL import Image, ImageFilter
import numpy as np
os.makedirs('img/ex', exist_ok=True)
for f in sorted(glob.glob('/tmp/ang/raw/*.png')):
    id = os.path.basename(f)[:-4]
    a = np.array(Image.open(f).convert('RGBA')).astype(float)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mx = np.maximum(np.maximum(r, g), b); mn = np.minimum(np.minimum(r, g), b); sat = (mx - mn) / (mx + 1); lum = .3 * r + .59 * g + .11 * b
    bg = (sat < .10) & (lum > 150); shadow = (sat < .07) & (lum > 90) & (lum <= 150)
    alpha = np.where(bg, 0, np.where(shadow, 0, 255)).astype(float)
    al = Image.fromarray(alpha.astype('uint8')).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.1))
    im = Image.fromarray(a.astype('uint8')); im.putalpha(al)
    bbox = al.point(lambda v: 255 if v > 40 else 0).getbbox()
    if bbox:
        pad = 14; bbox = (max(bbox[0]-pad, 0), max(bbox[1]-pad, 0), min(bbox[2]+pad, im.width), min(bbox[3]+pad, im.height)); im = im.crop(bbox)
    im.thumbnail((560, 560), Image.LANCZOS)
    im.save(f'img/ex/{id}.webp', 'WEBP', quality=84, method=6)
print(len(glob.glob('img/ex/*.webp')), 'portraits', round(sum(os.path.getsize(x) for x in glob.glob('img/ex/*.webp'))/1024), 'KB')
