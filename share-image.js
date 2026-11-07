// 地域の数を1枚の画像（PNG 1200×675、Xの画像と同じ横長）にする。投稿に添付する用
// 数は地域のカードに出たもの（region-topics.js の shareItems）だけを使う。画像はブラウザの中で作り、どこにも送らない
(function () {
  var W = 1200, H = 675, PAD = 40;
  var C = { navy: "#203750", blue: "#1F5FA6", tint: "#EAF1FA", line: "#B9CCE2", text: "#263238", muted: "#4E5C66", onNavy: "#A9C8EA", mapOff: "#55799F" };
  var FONT = '"Noto Sans JP", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic UI", "Meiryo", sans-serif';
  function font(weight, px) { return weight + " " + px + "px " + FONT; }

  // 幅に収まるまで文字を小さくする（いちばん小さくても min）
  function fit(ctx, text, weight, max, min, width) {
    var px = max;
    ctx.font = font(weight, px);
    while (px > min && ctx.measureText(text).width > width) ctx.font = font(weight, --px);
    return px;
  }
  // 1文字ずつ折り返す（日本語は単語の切れ目がないため）。行頭に来ない文字（、。）：・など）は前の行に残し、
  // 行末に残さない文字（（「）は次の行へ送る。maxLines を超えるときは、最後の行の終わりを「…」にする
  var NO_HEAD = "、。，．）」』・ー：", NO_TAIL = "（「『";
  // 数字とそのあとの単位（「336校」「26か所」）は1かたまりにして、途中で切らない
  var TOKEN = /[0-9][0-9,.]*(?:か所|[^\s0-9,.・、。（）「」：])?|[\s\S]/gu;
  function wrap(ctx, text, width, maxLines) {
    var lines = [], cur = "";
    (text.match(TOKEN) || []).forEach(function (tk) {
      if (cur && ctx.measureText(cur + tk).width > width && NO_HEAD.indexOf(tk.charAt(0)) < 0) {
        var carry = "";
        while (cur.length > 1 && NO_TAIL.indexOf(cur.slice(-1)) >= 0) { carry = cur.slice(-1) + carry; cur = cur.slice(0, -1); }
        lines.push(cur.replace(/\s+$/, ""));
        cur = (carry + tk).replace(/^\s+/, ""); // 行のはじめの空白は消す
      } else cur += tk;
    });
    if (cur) lines.push(cur);
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      var last = lines[maxLines - 1];
      while (last && ctx.measureText(last + "…").width > width) last = last.slice(0, -1);
      lines[maxLines - 1] = last + "…";
    }
    return lines;
  }
  function box(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // 右上の小さな日本地図（選んだ都道府県を白く）
  function drawMap(ctx, pref, x, y, h) {
    var MAP = window.JAPAN_MAP;
    if (!MAP || typeof Path2D !== "function") return;
    var s = h / MAP.h;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    var ins = MAP.inset;
    ctx.strokeStyle = C.mapOff;
    ctx.lineWidth = 1 / s; // 画像の上で1ピクセル
    ctx.strokeRect(ins[0], ins[1], ins[2], ins[3]); // 沖縄県の枠（ページの地図と同じ）
    MAP.prefs.forEach(function (p) {
      ctx.fillStyle = p[0] === pref ? "#FFFFFF" : C.mapOff;
      ctx.fill(new Path2D(p[2]));
    });
    ctx.restore();
  }

  // マスの並べ方を決める。見出し・数・補足の高さは全部のマスで共通にする（文字が小さいマスがあっても、行がそろう）
  //   L・V … いちばん大きい見出し・数の文字の大きさ（行の高さに使う）。1段で背の高いマスは、中身を上下のまん中あたりへ
  var PAD_IN = 20;
  function layout(ctx, items, w, h, big) {
    var inner = w - PAD_IN * 2;
    var npx = big ? 20 : 18, lh = Math.round(npx * 1.45);
    var ms = items.map(function (it) {
      return { lpx: fit(ctx, it.label, 700, big ? 26 : 21, 15, inner), vpx: fit(ctx, it.value, 700, big ? 66 : 50, 20, inner) };
    });
    var L = Math.max.apply(null, ms.map(function (m) { return m.lpx; }));
    var V = Math.max.apply(null, ms.map(function (m) { return m.vpx; }));
    var head = L + 14 + V; // 見出しの上から、数の下まで
    ctx.font = font(400, npx);
    var room = Math.max(1, Math.floor((h - PAD_IN * 2 - head - 12) / lh));
    var most = 0;
    items.forEach(function (it, i) {
      ms[i].notes = it.note ? wrap(ctx, it.note, inner, big ? Math.min(room, 6) : room) : [];
      most = Math.max(most, ms[i].notes.length);
    });
    var blockH = head + (most ? 12 + (most - 1) * lh + npx : 0);
    return { ms: ms, L: L, V: V, npx: npx, lh: lh, offset: big ? Math.max(PAD_IN, (h - blockH) / 2) : PAD_IN };
  }
  // 1マス：見出し → 大きな数 → 補足
  function drawItem(ctx, it, m, g, x, y, w, h) {
    var pad = PAD_IN, top = y + g.offset;
    ctx.fillStyle = C.tint;
    box(ctx, x, y, w, h, 16);
    ctx.fill();

    ctx.fillStyle = C.blue;
    ctx.fillRect(x, top + g.L - m.lpx - 2, 5, m.lpx + 8); // 見出しの左の印
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = C.navy;
    ctx.font = font(700, m.lpx);
    var ty = top + g.L;
    ctx.fillText(it.label, x + pad, ty);

    ctx.fillStyle = C.blue;
    ctx.font = font(700, m.vpx);
    ty += 14 + g.V;
    ctx.fillText(it.value, x + pad, ty);

    ctx.fillStyle = C.muted;
    ctx.font = font(400, g.npx);
    m.notes.forEach(function (l, i) { ctx.fillText(l, x + pad, ty + 12 + g.npx + i * g.lh); });
  }

  // o = { title: 地域名, pref: 都道府県コード, items: [{label, value, note}], date: "2026年11月8日", url: 表示するURL }
  function draw(o) {
    var cv = document.createElement("canvas");
    cv.width = W;
    cv.height = H;
    var ctx = cv.getContext("2d");

    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, W, H);

    // 上の帯：地域名と小さな地図
    var HEAD = 138;
    ctx.fillStyle = C.navy;
    ctx.fillRect(0, 0, W, HEAD);
    var mapH = 112;
    var mapW = window.JAPAN_MAP ? window.JAPAN_MAP.w * mapH / window.JAPAN_MAP.h : 0;
    drawMap(ctx, o.pref, W - PAD - mapW, (HEAD - mapH) / 2, mapH);
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = C.onNavy;
    ctx.font = font(700, 22);
    ctx.fillText("地域の数字", PAD, 46);
    ctx.fillStyle = "#FFFFFF";
    fit(ctx, o.title, 700, 58, 30, W - PAD * 2 - mapW - 30);
    ctx.fillText(o.title, PAD, 112);

    // まんなか：数のマス（4つまでは1段、5つ以上は2段）
    var items = o.items;
    var top = HEAD + 22, bottom = H - 76, gap = 16;
    if (!items.length) {
      ctx.fillStyle = C.muted;
      ctx.font = font(700, 26);
      ctx.fillText("この地域は、まだ数を出せる項目がありません。", PAD, top + 60);
    } else {
      var rows = items.length <= 4 ? 1 : 2;
      var cols = Math.ceil(items.length / rows);
      var w = (W - PAD * 2 - gap * (cols - 1)) / cols;
      var h = (bottom - top - gap * (rows - 1)) / rows;
      var g = layout(ctx, items, w, h, rows === 1);
      items.forEach(function (it, i) {
        var r = Math.floor(i / cols), c = i % cols;
        drawItem(ctx, it, g.ms[i], g, PAD + c * (w + gap), top + r * (h + gap), w, h);
      });
    }

    // 下：サイト名・URL・作った日
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(PAD, H - 58);
    ctx.lineTo(W - PAD, H - 58);
    ctx.stroke();
    ctx.fillStyle = C.navy;
    ctx.font = font(700, 26);
    ctx.fillText("日本を知る。", PAD, H - 20);
    var nameW = ctx.measureText("日本を知る。").width;
    ctx.fillStyle = C.muted;
    ctx.font = font(400, 19);
    ctx.fillText(o.url, PAD + nameW + 16, H - 21);
    ctx.textAlign = "right";
    ctx.fillText(o.date + "、各専門サイトの公開データから作成", W - PAD, H - 21);
    ctx.textAlign = "left";

    return new Promise(function (resolve, reject) {
      cv.toBlob(function (b) { if (b) resolve(b); else reject(new Error("toBlob")); }, "image/png");
    });
  }

  // 画像に書く文字の分だけ、ページと同じ文字の形（Noto Sans JP）を読みこんでから描く。読めなくても、端末の文字で描く
  function make(o) {
    var all = [o.title, "地域の数字日本を知る。", o.date, "、各専門サイトの公開データから作成…この地域は、まだ数を出せる項目がありません。"]
      .concat(o.items.map(function (it) { return it.label + it.value + it.note; })).join("");
    var wait = document.fonts && document.fonts.load
      ? Promise.all([document.fonts.load(font(700, 40), all), document.fonts.load(font(400, 20), all)]).catch(function () {})
      : Promise.resolve();
    var limit = new Promise(function (r) { setTimeout(r, 4000); });
    return Promise.race([wait, limit]).then(function () { return draw(o); });
  }

  window.ShareImage = { make: make };
})();
