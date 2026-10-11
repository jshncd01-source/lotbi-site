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

def fill_mascot_rim(out, src, gap_a=490, strict_tol=6, inset=2):
    """Close the see-through crescents in the mascot's white rim.

    BRAND-MARK-CLEAN-ALPHA-01. The background flood above takes anything
    within 18 of white, and the robot's rim highlights are that white, so the
    flood runs into the helmet, ears, arms and body edge and leaves them
    transparent. On a white page nobody sees it; on a dark page (dark header
    lockup, a dark browser tab, the app in dark mode, the 3D fallback in dark
    theme) the robot shows black streaks.

    A flood that only takes near-pure white (within 6) never gets in, so every
    pixel ``inset`` steps inside that strict outline is robot. Those pixels get
    their own colour back, fully opaque. The fill stays inside the mascot's
    current bounding box, so every crop, size and the outline the flood above
    drew are unchanged; the wordmark is not touched (its counters and ink are
    the knock_out_counters / navy_to_light business below).
    """
    W, H = out.size
    sp = src.load()
    op = out.load()
    strict = bytearray(W * H)
    q = deque()
    def tight(p):
        r, g, b, _ = p
        return r >= 255 - strict_tol and g >= 255 - strict_tol and b >= 255 - strict_tol
    for x in range(W):
        for y in (0, H - 1):
            if tight(sp[x, y]) and not strict[y * W + x]:
                strict[y * W + x] = 1; q.append((x, y))
    for y in range(H):
        for x in (0, W - 1):
            if tight(sp[x, y]) and not strict[y * W + x]:
                strict[y * W + x] = 1; q.append((x, y))
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < W and 0 <= ny < H and not strict[ny * W + nx] and tight(sp[nx, ny]):
                strict[ny * W + nx] = 1; q.append((nx, ny))
    # `inset` steps inside the strict outline (4-neighbour erosion of the robot)
    robot = bytearray(1 if not v else 0 for v in strict)
    for _ in range(inset):
        shrunk = bytearray(robot)
        for y in range(H):
            for x in range(W):
                if robot[y * W + x] and (x == 0 or y == 0 or x == W - 1 or y == H - 1
                                         or not robot[y * W + x - 1] or not robot[y * W + x + 1]
                                         or not robot[(y - 1) * W + x] or not robot[(y + 1) * W + x]):
                    shrunk[y * W + x] = 0
        robot = shrunk
    left, top, right, bottom = out.getbbox()
    mark_box = out.crop((left, top, min(right, left + gap_a), bottom)).getbbox()
    x0, y0, x1, y1 = left + mark_box[0], top + mark_box[1], left + mark_box[2], top + mark_box[3]
    filled = 0
    for y in range(y0, y1):
        for x in range(x0, x1):
            if robot[y * W + x] and op[x, y][3] < 255:
                r, g, b, _ = sp[x, y]
                op[x, y] = (r, g, b, 255)
                filled += 1
    return filled

# The light lockup keeps the plain cut: it only ever sits on white, where the
# rim is invisible, and its bytes are the sealed header logo (validate_site.py).
# The dark lockup and the mark (dark pages, icons, the app) get the filled rim.
out_clean = out.copy()
print('mascot rim pixels filled:', fill_mascot_rim(out_clean, src))

lock = out.crop(out.getbbox())
lock_clean = out_clean.crop(out.getbbox())
GAP_A, GAP_B = 490, 528
mark = lock_clean.crop((0, 0, GAP_A, lock.height)); mark = mark.crop(lock.crop((0, 0, GAP_A, lock.height)).getbbox())
word = lock.crop((GAP_B+1, 0, lock.width, lock.height)); word = word.crop(word.getbbox())

def knock_out_counters(img, x_from=0, tol=18):
    """Open the enclosed holes in O and B — the letter counters.

    SITE-DARK-WORDMARK-COUNTERS-01. The background removal above floods inward
    from the image border, so it can only clear white that is connected to the
    outside. A counter is white fenced in by ink, so the flood never arrived and
    those pixels stayed fully opaque. On a white page that is invisible, which
    is why it shipped. On #151922 they light up with the rest of the wordmark:
    the O turns into a filled disc and the B into a filled block. 대표님 read
    that as "B자가 이상하다" — the glyph had stopped being a B.

    This is scoped to the wordmark (x >= x_from) deliberately. Near-white in
    there is always background: the letters are navy and the O is a pink/violet
    gradient, nothing in the wordmark is white ink. The mascot IS white ink, and
    that is exactly why the border flood above could not just be replaced with a
    global white knockout — it would dissolve the robot.

    The boundary is faded with the same ramp the outer edge uses above, so a
    counter edge and an outer edge are softened identically.
    """
    im = img.copy()
    p = im.load()
    W, H = im.size
    x_from = max(0, min(x_from, W))
    white = bytearray(W * H)
    for y in range(H):
        for x in range(x_from, W):
            r, g, b, a = p[x, y]
            if a > 8 and nw((r, g, b, a), tol):
                white[y * W + x] = 1
    for y in range(H):
        for x in range(x_from, W):
            if white[y * W + x]:
                p[x, y] = (255, 255, 255, 0)
    for y in range(H):
        for x in range(x_from, W):
            if white[y * W + x]:
                continue
            r, g, b, a = p[x, y]
            if a <= 8:
                continue
            if not any(
                0 <= x + dx < W and 0 <= y + dy < H and x + dx >= x_from
                and white[(y + dy) * W + (x + dx)]
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
            ):
                continue
            if nw((r, g, b, a), 30):
                lum = (r + g + b) / 3
                p[x, y] = (r, g, b, int(a * max(0.0, min(1.0, (255 - lum) / 12 + 0.35))))
    return im


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

word_dark = navy_to_light(knock_out_counters(word))
save(word, 'lotbi-wordmark.png')
save(word_dark, 'lotbi-wordmark-dark.png')

lock_dark = lock_clean.copy()
lock_dark.paste(
    navy_to_light(knock_out_counters(lock.crop((GAP_B+1,0,lock.width,lock.height)))),
    (GAP_B+1,0),
)
save(lock_dark, 'lotbi-lockup-dark.png')
for w in (480, 320, 160):
    save(lock_dark, f'lotbi-lockup-dark-{w}w.png', w)

# 마스코트 = 앱 아이콘/파비콘용 정사각 패딩
side = max(mark.size); pad = Image.new('RGBA',(side,side),(0,0,0,0))
pad.paste(mark, ((side-mark.width)//2, (side-mark.height)//2), mark)
save(mark, 'lotbi-mark.png')
for s in (512, 192, 96, 48, 32):
    save(pad, f'lotbi-mark-{s}.png', s)
