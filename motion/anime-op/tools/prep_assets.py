#!/usr/bin/env python3
"""Prepare opening assets from the book's character cards: crops (JPEG) and keyed cut-outs (PNG with alpha).
Run from the repo root: python3 motion/anime-op/tools/prep_assets.py"""
import os
import numpy as np
from PIL import Image, ImageFilter
Image.MAX_IMAGE_PIXELS = None
CARDS = 'Аниме/Карты персонажей книга'
BGS = 'Аниме/1 серия - демка'
OUT = 'motion/anime-op/assets'
os.makedirs(OUT, exist_ok=True)

def load(p):
    im = Image.open(p); im.draft('RGB', (4000, 4000)); return im.convert('RGB')

def crop(src, box, name, long=1500, q=88):
    im = load(src); W, H = im.size
    c = im.crop((int(box[0] * W), int(box[1] * H), int(box[2] * W), int(box[3] * H)))
    c.thumbnail((long, long), Image.LANCZOS)
    c.save(f'{OUT}/{name}.jpg', quality=q, optimize=True); print(name, c.size)

def largest_only(alpha, grow=6):
    """Keep the biggest connected blob (drops neighbouring figures that leak into a crop)."""
    from scipy import ndimage
    lab, n = ndimage.label(alpha > 0.08)
    if n <= 1: return alpha
    sizes = ndimage.sum(np.ones_like(alpha), lab, range(1, n + 1))
    keep = ndimage.binary_dilation(lab == (1 + int(np.argmax(sizes))), iterations=grow)
    return alpha * ndimage.gaussian_filter(keep.astype(np.float32), 1.5)

def key_dark(src, box, name, long=1500, gain=1.6, color=None, lo=0.06, largest=False, flip=False):
    """Dark subject on light paper → alpha from darkness. color=None keeps original RGB, else flat fill."""
    im = load(src); W, H = im.size
    c = im.crop((int(box[0] * W), int(box[1] * H), int(box[2] * W), int(box[3] * H)))
    c.thumbnail((long, long), Image.LANCZOS)
    a = np.asarray(c).astype(np.float32) / 255
    bg = np.percentile(a.reshape(-1, 3), 97, axis=0)            # paper colour
    dist = np.clip(1 - (a / np.maximum(bg, 1e-3)).min(axis=2), 0, 1)  # how much darker than paper
    alpha = np.clip((dist - lo) * gain / (1 - lo), 0, 1)
    if largest: alpha = largest_only(alpha)
    rgb = (a * 255).astype(np.uint8) if color is None else np.broadcast_to(np.array(color, np.uint8), a.shape).copy()
    if color is None:  # un-premultiply against paper so edges do not keep a white halo
        un = (a - (1 - alpha[..., None]) * bg) / np.maximum(alpha[..., None], 1e-3)
        rgb = (np.clip(un, 0, 1) * 255).astype(np.uint8)
    out = Image.fromarray(np.dstack([rgb, (alpha * 255).astype(np.uint8)]), 'RGBA')
    if flip: out = out.transpose(Image.FLIP_LEFT_RIGHT)
    out = out.crop(out.getbbox() or (0, 0, *out.size))
    out.save(f'{OUT}/{name}.png', optimize=True); print(name, out.size)

# --- backgrounds (Eltarion, episode-1 demo) ---
for f, n in [('Бескрайняя красная пустыня под алым солнцем.png', 'bg_desert'),
             ('Столица, высеченная в багровой скале.png', 'bg_capital'),
             ('Зерр выходит из красных песков.png', 'bg_zerr'),
             ('Алый утёс над чёрным морем.png', 'bg_cliff')]:
    crop(f'{BGS}/{f}', (0, 0, 1, 1), n, long=1920, q=90)

# --- character crops (panels) ---
C = CARDS
crop(f'{C}/Лиам сзади.png', (0.05, 0.0, 1.0, 1.0), 'liam_back', long=1920)
crop(f'{C}/Лиам 3.png', (0.47, 0.02, 0.86, 0.66), 'liam_profile')
crop(f'{C}/Лиам.png', (0.0, 0.72, 0.5, 1.0), 'liam_face')
crop(f'{C}/Повелитель лицо3.png', (0.0, 0.05, 1.0, 0.95), 'lord_face')
crop(f'{C}/Диана Эльтар.png', (0.575, 0.03, 0.83, 0.5), 'diana')
crop(f'{C}/Мефи.png', (0.04, 0.0, 0.96, 0.78), 'meph')
crop(f'{C}/Циан.png', (0.17, 0.03, 0.73, 0.8), 'cyan')
crop(f'{C}/Себастьян.png', (0.4, 0.02, 0.62, 0.4), 'sebastian')
crop(f'{C}/Крис.png', (0.55, 0.0, 0.81, 0.45), 'kris')
crop(f'{C}/Нокс.png', (0.54, 0.0, 0.81, 0.47), 'nox')
crop(f'{C}/Аластор.png', (0.6, 0.0, 0.85, 0.42), 'alastor')
crop(f'{C}/Обложка книги copy.png', (0.27, 0.06, 0.72, 0.96), 'logo', long=1600, q=92)

# --- keyed cut-outs ---
key_dark(f'{C}/Мрак.png', (0.0, 0.46, 0.35, 0.71), 'dragon_fly', long=1600, gain=1.5, largest=True, flip=True)
key_dark(f'{C}/Мрак.png', (0.52, 0.06, 1.0, 0.37), 'dragon_head', long=1400, gain=1.4, largest=True)
key_dark(f'{C}/Меч Лиама.png', (0.08, 0.0, 0.45, 1.0), 'sword', long=1600, gain=1.3, lo=0.1, largest=True)
key_dark(f'{C}/ChatGPT Image 17 июн. 2026 г., 21_37_12.png', (0.12, 0.05, 0.88, 0.93), 'emblem', long=1400, gain=3.0, color=(233, 210, 160), lo=0.04)
key_dark(f'{C}/рух.png', (0.47, 0.02, 0.98, 0.4), 'rukh_fly', long=1400, gain=2.2, lo=0.08, largest=True)
