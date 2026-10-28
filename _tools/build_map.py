# 都道府県の境界データ（TopoJSON）から、トップページ用の軽い日本地図（data/japan-map.js）を作ります。
#
# 使い方：python _tools/build_map.py <japan_prefectures.topojson のパス>
#   元データ：国土数値情報（行政区域データ）を、スマートニュース メディア研究所が簡略化したもの
#   （https://github.com/smartnews-smri/japan-topography ）。MOU・協定マップ（mou-map）の
#   data/geo/japan_prefectures.topojson と同じものを使います。
#
# やっていること
# ・県境の線（隣の県と共有している線）ごとに点を間引くので、県と県のすき間や重なりが出ません
# ・小さな島は省き、沖縄県は左上の枠に移します（地図を小さくまとめるため）
# ・東京都の小笠原諸島（北緯30度より南）は省きます
import json
import math
import sys
from pathlib import Path

from shapely.geometry import Polygon

TOLERANCE = 0.012       # 点を間引く細かさ（度）。大きいほど軽く、粗くなる
MIN_AREA_KM2 = 25       # これより小さい島は描かない
SCALE = 46              # 1度あたりの大きさ（地図の座標）
STD_LAT = 36            # 横方向の縮み具合を合わせる緯度
# 沖縄県は、日本海の左上の空いたところ（この経度・緯度が枠の左上）へ、この倍率で大きくして移す
# （大東諸島は東に離れていて枠が大きくなるので省く）
OKINAWA_TOPLEFT = (129.0, 44.8)
OKINAWA_ZOOM = 1.8
OKINAWA_CODE = "47"


def decode_arcs(topo):
    sx, sy = topo["transform"]["scale"]
    tx, ty = topo["transform"]["translate"]
    arcs = []
    for arc in topo["arcs"]:
        x = y = 0
        pts = []
        for dx, dy in arc:
            x += dx
            y += dy
            pts.append((x * sx + tx, y * sy + ty))
        arcs.append(pts)
    return arcs


def simplify(pts, tol):
    # ダグラス・ポーカー法（両端は必ず残す＝隣の県と線がずれない）
    if len(pts) < 3:
        return pts
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        ax, ay = pts[a]
        bx, by = pts[b]
        dx, dy = bx - ax, by - ay
        L = math.hypot(dx, dy)
        far, idx = -1.0, -1
        for i in range(a + 1, b):
            px, py = pts[i]
            if L == 0:
                d = math.hypot(px - ax, py - ay)
            else:
                d = abs(dy * px - dx * py + bx * ay - by * ax) / L
            if d > far:
                far, idx = d, i
        if far > tol and idx > 0:
            keep[idx] = True
            stack.append((a, idx))
            stack.append((idx, b))
    out = [p for p, k in zip(pts, keep) if k]
    # 輪になった線（島）が三角形未満にならないように
    if pts[0] == pts[-1] and len(out) < 4:
        step = max(1, len(pts) // 4)
        out = pts[::step] + [pts[-1]]
    return out


def ring_coords(ring_arcs, arcs):
    pts = []
    for i in ring_arcs:
        a = arcs[i] if i >= 0 else list(reversed(arcs[~i]))
        if pts:
            a = a[1:]
        pts.extend(a)
    return pts


def area_km2(ring):
    if len(ring) < 4:
        return 0
    lat = sum(p[1] for p in ring) / len(ring)
    poly = Polygon([(x * 111.32 * math.cos(math.radians(lat)), y * 110.57) for x, y in ring])
    return abs(poly.area)


def main():
    src = Path(sys.argv[1])
    out = Path(__file__).resolve().parent.parent / "data" / "japan-map.js"
    topo = json.loads(src.read_text(encoding="utf-8"))
    arcs = decode_arcs(topo)
    simple = [simplify(a, TOLERANCE) for a in arcs]
    geoms = topo["objects"]["prefectures"]["geometries"]

    kx = SCALE * math.cos(math.radians(STD_LAT))
    ky = SCALE
    prefs = []
    for g in geoms:
        code = g["properties"]["code"].zfill(2)
        name = g["properties"]["name"]
        polys = g["arcs"] if g["type"] == "MultiPolygon" else [g["arcs"]]
        rings = []
        for poly in polys:
            outer = ring_coords(poly[0], arcs)
            a = area_km2(outer)
            if code == "13" and min(p[1] for p in outer) < 30:
                continue
            rings.append((a, [ring_coords(r, simple) for r in poly]))
        biggest = max(a for a, _ in rings)
        shapes = [r for a, r in rings if a >= MIN_AREA_KM2 or a == biggest]
        if code == OKINAWA_CODE:
            shapes = [s for s in shapes if min(x for x, _ in s[0]) < 130]
            ox = min(x for s in shapes for x, _ in s[0])
            oy = max(y for s in shapes for _, y in s[0])
            X0, Y0 = OKINAWA_TOPLEFT
            z = OKINAWA_ZOOM
            shapes = [[[(X0 + (x - ox) * z, Y0 - (oy - y) * z) for x, y in r] for r in s] for s in shapes]
        prefs.append({"code": code, "name": name, "shapes": shapes})

    xs = [x for p in prefs for s in p["shapes"] for r in s for x, _ in r]
    ys = [y for p in prefs for s in p["shapes"] for r in s for _, y in r]
    minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
    pad = 12

    def proj(x, y):
        return (round((x - minx) * kx) + pad, round((maxy - y) * ky) + pad)

    W = round((maxx - minx) * kx) + pad * 2
    H = round((maxy - miny) * ky) + pad * 2

    def path_d(shapes):
        parts = []
        for s in shapes:
            for r in s:
                pts = [proj(x, y) for x, y in r]
                # 同じ点が続くところを省く
                dedup = [pts[0]]
                for p in pts[1:]:
                    if p != dedup[-1]:
                        dedup.append(p)
                if len(dedup) < 4:
                    continue
                d = "M%d %d" % dedup[0]
                px, py = dedup[0]
                for x, y in dedup[1:-1]:
                    d += "l%d %d" % (x - px, y - py)
                    px, py = x, y
                parts.append(d + "z")
        return "".join(parts).replace(" -", "-")

    # 沖縄の枠（左上）
    ok = next(p for p in prefs if p["code"] == OKINAWA_CODE)
    oxs = [x for s in ok["shapes"] for r in s for x, _ in r]
    oys = [y for s in ok["shapes"] for r in s for _, y in r]
    bx0, by0 = proj(min(oxs), max(oys))
    bx1, by1 = proj(max(oxs), min(oys))
    m = 7
    inset = [bx0 - m, by0 - m, bx1 - bx0 + m * 2, by1 - by0 + m * 2]

    # 地方ごとに地図を大きくするときに使う、各都道府県の「いちばん大きい島」の範囲（離島で範囲が広がらないように）
    def main_box(shapes):
        best = max(shapes, key=lambda s: area_km2(s[0]))
        pts = [proj(x, y) for x, y in best[0]]
        xs2, ys2 = [q[0] for q in pts], [q[1] for q in pts]
        return [min(xs2), min(ys2), max(xs2) - min(xs2), max(ys2) - min(ys2)]

    data = {
        "w": W,
        "h": H,
        "inset": inset,
        "prefs": [[p["code"], p["name"], path_d(p["shapes"]), main_box(p["shapes"])] for p in sorted(prefs, key=lambda p: p["code"])],
    }
    js = (
        "// 都道府県の地図（_tools/build_map.py で作成。手で直さないでください）\n"
        "// 出典：国土数値情報（行政区域データ）国土交通省 をもとに、スマートニュース メディア研究所が簡略化したデータを加工\n"
        "window.JAPAN_MAP=" + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n"
    )
    out.write_text(js, encoding="utf-8", newline="\n")
    print(out, len(js.encode("utf-8")), "bytes", W, "x", H, "inset", inset)


if __name__ == "__main__":
    main()
