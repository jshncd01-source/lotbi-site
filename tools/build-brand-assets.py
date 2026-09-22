from PIL import Image
from collections import deque
import os

src = Image.open('assets/lotbi-main-logo.png').convert('RGBA')
W,H = src.size; px = src.load()
def nw(p, tol=18):
    r,g,b,_=p; return r>=255-tol and g>=255-tol and b>=255-tol
bg = bytearray(W*H); q=deque()
for x in range(W):
    for y in (0,H-1):
        if nw(px[x,y]) and not bg[y*W+x]: bg[y*W+x]=1; q.append((x,y))
for y in range(H):
    for x in (0,W-1):
        if nw(px[x,y]) and not bg[y*W+x]: bg[y*W+x]=1; q.append((x,y))
while q:
    x,y=q.popleft()
    for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
        nx,ny=x+dx,y+dy
        if 0<=nx<W and 0<=ny<H and not bg[ny*W+nx] and nw(px[nx,ny]):
            bg[ny*W+nx]=1; q.append((nx,ny))
out = src.copy(); op = out.load()
for y in range(H):
    for x in range(W):
        if bg[y*W+x]: op[x,y]=(255,255,255,0)
for y in range(1,H-1):
    for x in range(1,W-1):
        if bg[y*W+x]: continue
        if any(bg[(y+dy)*W+(x+dx)] for dx,dy in ((1,0),(-1,0),(0,1),(0,-1))):
            r,g,b,a = op[x,y]
            if nw((r,g,b,a),30):
                lum=(r+g+b)/3
                op[x,y]=(r,g,b,int(a*max(0.0,min(1.0,(255-lum)/12+0.35))))

lock = out.crop(out.getbbox())
GAP_A, GAP_B = 490, 528
mark = lock.crop((0, 0, GAP_A, lock.height)); mark = mark.crop(mark.getbbox())
word = lock.crop((GAP_B+1, 0, lock.width, lock.height)); word = word.crop(word.getbbox())

def navy_to_light(img):
    im = img.copy(); p = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r,g,b,a = p[x,y]
            if a > 8 and b > r and r < 110 and g < 110 and b < 160:
                # 네이비 계열만 밝게. 명암(그림자)은 보존
                k = 1.0 - (r+g+b)/(3*160)
                v = int(255 - 40*(1-k))
                p[x,y] = (v, v, min(255, v+4), a)
    return im

os.makedirs('assets/brand', exist_ok=True)
def save(img, name, w=None):
    if w:
        h = max(1, round(img.height * w / img.width))
        img = img.resize((w,h), Image.LANCZOS)
    path = f'assets/brand/{name}'
    img.save(path, optimize=True)
    print(f'{path:48s} {img.size}  {os.path.getsize(path)/1024:.1f}KB')

save(lock, 'lotbi-lockup.png')
for w in (480, 320, 160):
    save(lock, f'lotbi-lockup-{w}w.png', w)

word_dark = navy_to_light(word)
save(word, 'lotbi-wordmark.png')
save(word_dark, 'lotbi-wordmark-dark.png')

lock_dark = lock.copy()
lock_dark.paste(navy_to_light(lock.crop((GAP_B+1,0,lock.width,lock.height))), (GAP_B+1,0))
save(lock_dark, 'lotbi-lockup-dark.png')
for w in (480, 320, 160):
    save(lock_dark, f'lotbi-lockup-dark-{w}w.png', w)

# 마스코트 = 앱 아이콘/파비콘용 정사각 패딩
side = max(mark.size); pad = Image.new('RGBA',(side,side),(0,0,0,0))
pad.paste(mark, ((side-mark.width)//2, (side-mark.height)//2), mark)
save(mark, 'lotbi-mark.png')
for s in (512, 192, 96, 48, 32):
    save(pad, f'lotbi-mark-{s}.png', s)
