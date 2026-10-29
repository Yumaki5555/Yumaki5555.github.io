// 日本を知る。 「地域から調べる」の動き
// ・地域を選ぶ前は、日本地図・名前で探す・一覧から選ぶ を出す（選ぶ画面）
// ・地域を選んだら選ぶ画面を閉じ、選んだ地域の名前と8つのカードをすぐ見せる（情報の画面）。「地域を変える」で選ぶ画面に戻る
// ・選んだ地域は URL（?area=コード）に入る。共有・戻る・進むで同じ地域が開く
//   URL の読み書きは main.js の window.PortalState がまとめて行い、ここでは地域が変わったことを受け取って画面に出すだけ
// ・市区町村の一覧 data/municipalities.json は、必要になったときに1回だけ読む
// ・入口のタブで「地域から調べる」が開くまでは、地図なども作らない
(function () {
  "use strict";

  var MAP = window.JAPAN_MAP;
  var root = document.getElementById("area");
  if (!MAP || !root) return;

  var PREFS = MAP.prefs.map(function (p) { return { code: p[0], name: p[1], kana: "" }; });
  var prefByCode = {};
  PREFS.forEach(function (p) { prefByCode[p.code] = p; });

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // ---------- 市区町村の一覧（必要になったら読む） ----------
  var muniData = null;
  var muniPromise = null;
  function loadMunis() {
    if (!muniPromise) {
      muniPromise = fetch("data/municipalities.json?v=20261028")
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (d) {
          var kanaByPref = {};
          d.prefs.forEach(function (p) { kanaByPref[p[0]] = p[2]; });
          PREFS.forEach(function (p) { p.kana = kanaByPref[p.code] || ""; });
          var byCode = {};
          var byPref = {};
          var list = d.munis.map(function (m) {
            var o = { code: m[0], name: m[1], kana: m[2], pref: m[0].slice(0, 2), seirei: m[3] === 1 };
            byCode[o.code] = o;
            (byPref[o.pref] = byPref[o.pref] || []).push(o);
            return o;
          });
          muniData = { list: list, byCode: byCode, byPref: byPref };
          return muniData;
        })
        .catch(function (e) { muniPromise = null; throw e; });
    }
    return muniPromise;
  }

  // ---------- 選んでいる地域 ----------
  // area = null（全国）/ { pref: "13", muni: null } / { pref: "13", muni: { code, name, kana, seirei } }
  var area = null;

  function areaCode(a) { return !a ? "" : a.muni ? a.muni.code : a.pref; }
  function areaFromCode(code) {
    code = String(code || "").replace(/[^0-9]/g, "");
    if (/^\d{2}$/.test(code) && prefByCode[code]) return Promise.resolve({ pref: code, muni: null });
    if (/^\d{6}$/.test(code) && prefByCode[code.slice(0, 2)]) {
      return loadMunis().then(function (d) {
        var m = d.byCode[code];
        return m ? { pref: m.pref, muni: m } : { pref: code.slice(0, 2), muni: null };
      }, function () { return { pref: code.slice(0, 2), muni: null }; });
    }
    return Promise.resolve(null);
  }
  function fullName(a) {
    return !a ? "全国" : a.muni ? prefByCode[a.pref].name + " " + a.muni.name : prefByCode[a.pref].name;
  }

  // ---------- 画面の部品 ----------
  var picker = document.getElementById("area-picker");
  var svg = root.querySelector(".jmap");
  var hoverName = root.querySelector(".jmap-name");
  var prefSelect = document.getElementById("area-pref");
  var muniSelect = document.getElementById("area-muni");
  var narrow = root.querySelector(".area-narrow");
  var search = document.getElementById("area-search");
  var listbox = document.getElementById("area-search-list");
  var result = document.getElementById("area-result");
  var crumbs = document.getElementById("area-result-title");
  var mini = root.querySelector(".area-mini");
  var changeBtn = root.querySelector(".area-change");
  var prefAllBtn = root.querySelector(".area-pref-all");
  var shareBtn = root.querySelector(".area-share");
  var shareMsg = root.querySelector(".area-share-msg");
  var cardsBox = document.getElementById("area-cards");
  var BASE_TITLE = document.title;

  // 選ぶ画面（pick）と情報の画面（view）の切りかえ
  function setMode(mode) {
    root.setAttribute("data-mode", mode);
    var open = mode === "pick";
    picker.hidden = !open;
    changeBtn.setAttribute("aria-expanded", open ? "true" : "false");
    changeBtn.textContent = !area ? "地域を選ぶ" : open ? "地図を閉じる" : "地域を変える";
  }
  // 画面のガタつきを抑えるため、アニメーションなしで移動する（地域の画面が閉じているときは動かさない）
  function visible() { return root.getClientRects().length > 0; }
  function jumpTo(el) {
    if (!visible()) return;
    var headerH = document.querySelector(".site-header").offsetHeight;
    var y = el.getBoundingClientRect().top + window.pageYOffset - headerH - 8;
    window.scrollTo(0, Math.max(0, y));
  }
  function showCards() {
    // 選んだ地域の見出しが画面の上の方に見えていなければ、そこまで移動する
    if (!visible()) return;
    var top = result.getBoundingClientRect().top;
    var headerH = document.querySelector(".site-header").offsetHeight;
    if (top < headerH || top > window.innerHeight * 0.45) jumpTo(result);
  }

  // ---------- 地図 ----------
  var SVGNS = "http://www.w3.org/2000/svg";
  var pathByCode = {};
  function drawMap() {
    svg.setAttribute("viewBox", "0 0 " + MAP.w + " " + MAP.h);
    svg.style.aspectRatio = MAP.w + " / " + MAP.h;
    var frag = document.createDocumentFragment();
    var ins = MAP.inset;
    var box = document.createElementNS(SVGNS, "rect");
    box.setAttribute("x", ins[0]); box.setAttribute("y", ins[1]);
    box.setAttribute("width", ins[2]); box.setAttribute("height", ins[3]);
    box.setAttribute("rx", 6);
    box.setAttribute("class", "jmap-inset");
    box.setAttribute("data-code", "47");
    frag.appendChild(box);
    var label = document.createElementNS(SVGNS, "text");
    label.setAttribute("x", ins[0] + 10); label.setAttribute("y", ins[1] + 24);
    label.setAttribute("class", "jmap-inset-label");
    label.textContent = "沖縄県";
    frag.appendChild(label);
    PREFS.forEach(function (p, i) {
      var path = document.createElementNS(SVGNS, "path");
      path.setAttribute("d", MAP.prefs[i][2]);
      path.setAttribute("class", "jmap-pref");
      path.setAttribute("data-code", p.code);
      path.setAttribute("role", "button");
      path.setAttribute("tabindex", "-1");
      path.setAttribute("aria-label", p.name);
      pathByCode[p.code] = path;
      frag.appendChild(path);
    });
    svg.appendChild(frag);
    // キーボード：地図には1か所だけ Tab で入れる。矢印キーで北から南へ順に移り、Enter で選ぶ
    pathByCode["13"].setAttribute("tabindex", "0");

    svg.addEventListener("click", function (e) {
      var el = e.target.closest("[data-code]");
      if (el) pick({ pref: el.getAttribute("data-code"), muni: null });
    });
    // 押す前に、指している都道府県の名前を地図の上に出す（小さい県の押しまちがいを防ぐ）
    svg.addEventListener("pointerover", function (e) {
      var el = e.target.closest("[data-code]");
      hoverName.textContent = el ? prefByCode[el.getAttribute("data-code")].name : "";
    });
    svg.addEventListener("pointerleave", function () { hoverName.textContent = ""; });
    svg.addEventListener("focusin", function (e) {
      var el = e.target.closest("[data-code]");
      if (el) hoverName.textContent = prefByCode[el.getAttribute("data-code")].name;
    });
    svg.addEventListener("keydown", function (e) {
      var el = e.target.closest(".jmap-pref");
      if (!el) return;
      var idx = PREFS.findIndex(function (p) { return p.code === el.getAttribute("data-code"); });
      var next = null;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") next = PREFS[(idx + 1) % PREFS.length];
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = PREFS[(idx - 1 + PREFS.length) % PREFS.length];
      else if (e.key === "Home") next = PREFS[0];
      else if (e.key === "End") next = PREFS[PREFS.length - 1];
      else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        pick({ pref: el.getAttribute("data-code"), muni: null });
        return;
      }
      if (next) {
        e.preventDefault();
        Object.keys(pathByCode).forEach(function (c) { pathByCode[c].setAttribute("tabindex", c === next.code ? "0" : "-1"); });
        pathByCode[next.code].focus();
      }
    });

    // 地方ごとに地図を大きくする（小さい都道府県を選びやすくする）
    root.querySelectorAll("[data-zoom]").forEach(function (b) {
      b.addEventListener("click", function () { zoom(b.getAttribute("data-zoom")); });
    });

    // 選んだ地域の見出しに出す小さな地図（場所を示すだけ）
    mini.setAttribute("viewBox", "0 0 " + MAP.w + " " + MAP.h);
    mini.innerHTML = MAP.prefs.map(function (p) { return '<path data-code="' + p[0] + '" d="' + p[2] + '"/>'; }).join("");
  }
  function zoom(range) {
    var vb = "0 0 " + MAP.w + " " + MAP.h;
    if (range !== "all") {
      var r = range.split("-");
      var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      // 各都道府県のいちばん大きい島の範囲（data/japan-map.js の4つめ）を合わせる。離島で範囲が広がらないように
      for (var c = +r[0]; c <= +r[1]; c++) {
        var b = MAP.prefs[c - 1][3];
        x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]);
        x1 = Math.max(x1, b[0] + b[2]); y1 = Math.max(y1, b[1] + b[3]);
      }
      var pad = Math.max(x1 - x0, y1 - y0) * 0.06;
      vb = [x0 - pad, y0 - pad, x1 - x0 + pad * 2, y1 - y0 + pad * 2].map(Math.round).join(" ");
    }
    svg.setAttribute("viewBox", vb);
    svg.classList.toggle("is-zoomed", range !== "all");
    root.querySelectorAll("[data-zoom]").forEach(function (b) {
      b.setAttribute("aria-pressed", b.getAttribute("data-zoom") === range ? "true" : "false");
    });
  }
  function paintMap() {
    Object.keys(pathByCode).forEach(function (c) {
      var on = !!(area && area.pref === c);
      pathByCode[c].classList.toggle("is-on", on);
      pathByCode[c].setAttribute("aria-pressed", on ? "true" : "false");
    });
    svg.querySelector(".jmap-inset").classList.toggle("is-on", !!(area && area.pref === "47"));
    if (!svg.contains(document.activeElement)) {
      var keep = area ? area.pref : "13";
      Object.keys(pathByCode).forEach(function (c) { pathByCode[c].setAttribute("tabindex", c === keep ? "0" : "-1"); });
    }
    [].forEach.call(mini.querySelectorAll("path"), function (p) {
      p.classList.toggle("is-on", !!(area && area.pref === p.getAttribute("data-code")));
    });
  }

  // ---------- 選択欄 ----------
  function fillPrefSelect() {
    var html = '<option value="">都道府県を選ぶ</option>';
    PREFS.forEach(function (p) { html += '<option value="' + p.code + '">' + esc(p.name) + "</option>"; });
    prefSelect.innerHTML = html;
  }
  // 選んだ地域の見出しの下の「市区町村で絞り込む」
  function fillMuniSelect() {
    narrow.hidden = !area;
    if (!area) return;
    var pref = prefByCode[area.pref];
    var all = '<option value="">' + esc(pref.name) + "全体</option>";
    if (muniData) {
      muniSelect.innerHTML = all + (muniData.byPref[pref.code] || []).map(function (m) {
        return '<option value="' + m.code + '">' + esc(m.name) + "</option>";
      }).join("");
      muniSelect.value = area.muni ? area.muni.code : "";
      muniSelect.disabled = false;
      return;
    }
    muniSelect.innerHTML = all;
    muniSelect.disabled = true;
    loadMunis().then(function () { if (area && area.pref === pref.code) fillMuniSelect(); }, function () {
      muniSelect.innerHTML = '<option value="">市区町村の一覧を読み込めませんでした</option>';
    });
  }

  // ---------- 地域を決める ----------
  // opts.push … URL を履歴に足すか（戻る・進むのときは足さない）
  function setArea(next, opts) {
    opts = opts || {};
    var changed = areaCode(next) !== areaCode(area);
    area = next;
    paintMap();
    prefSelect.value = area ? area.pref : "";
    fillMuniSelect();
    renderCurrent();
    if (changed || !cardsBox.querySelector(".topic")) renderCards();
    // URL の書きかえは main.js の PortalState に頼む（表示モードはそのまま、地域だけ変わる）
    if (changed && opts.push !== false) State.set({ area: areaCode(area) }, "push");
    document.title = (area ? fullName(area) + "の情報｜" : "") + BASE_TITLE;
  }
  // 人が地域を選んだとき：選ぶ画面を閉じて、カードを見せる
  function pick(a) {
    setArea(a);
    setMode(a ? "view" : "pick");
    if (a) showCards();
  }

  // 選んだ地域の見出し
  function renderCurrent() {
    var pref = area && prefByCode[area.pref];
    crumbs.innerHTML = !area
      ? '<span class="crumb-now">全国</span>'
      : area.muni
        ? '<span class="crumb-pref">' + esc(pref.name) + '</span><span class="crumb-sep" aria-hidden="true">＞</span><span class="crumb-now">' + esc(area.muni.name) + "</span>"
        : '<span class="crumb-now">' + esc(pref.name) + "</span>";
    if (area) mini.removeAttribute("hidden"); else mini.setAttribute("hidden", ""); // SVG には hidden プロパティがない
    prefAllBtn.hidden = !(area && area.muni);
    if (area) prefAllBtn.textContent = pref.name + "全体に戻る";
    shareBtn.hidden = !area;
    shareMsg.textContent = "";
    changeBtn.textContent = !area ? "地域を選ぶ" : root.getAttribute("data-mode") === "pick" ? "地図を閉じる" : "地域を変える";
  }

  // ---------- 名前で探す ----------
  var results = [];
  var active = -1;
  function toHira(s) {
    return s.replace(/[ァ-ヶ]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0x60); });
  }
  function norm(s) {
    // 「ヶ」と「ケ」（鶴ヶ島・鎌ケ谷など）は、どちらで入れても見つかるようにする
    return toHira(String(s || "").normalize("NFKC").replace(/\s+/g, "")).replace(/ゖ/g, "け").toLowerCase();
  }
  function runSearch() {
    var q = norm(search.value);
    if (!q) { closeList(); return; }
    var out = [];
    PREFS.forEach(function (p) {
      if (norm(p.name).indexOf(q) >= 0 || (p.kana && p.kana.indexOf(q) === 0)) out.push({ type: "pref", pref: p });
    });
    if (muniData) {
      var starts = [];
      var inside = [];
      muniData.list.forEach(function (m) {
        var n = norm(m.name);
        if (n.indexOf(q) === 0 || m.kana.indexOf(q) === 0) starts.push({ type: "muni", muni: m });
        else if (n.indexOf(q) > 0) inside.push({ type: "muni", muni: m });
      });
      out = out.concat(starts, inside);
    }
    results = out.slice(0, 30);
    active = results.length ? 0 : -1;
    drawList(out.length);
  }
  function drawList(total) {
    if (!results.length) {
      listbox.innerHTML = '<li class="area-opt-empty" role="presentation">' +
        (muniData ? "見つかりませんでした。漢字かひらがなで入れてみてください。" : "市区町村の一覧を読み込んでいます…") + "</li>";
    } else {
      listbox.innerHTML = results.map(function (r, i) {
        var label = r.type === "pref"
          ? '<span class="opt-main"><span class="opt-name">' + esc(r.pref.name) + '</span><span class="opt-kana">' + esc(r.pref.kana) + '</span></span><span class="opt-sub is-pref">都道府県全体</span>'
          : '<span class="opt-main"><span class="opt-name">' + esc(r.muni.name) + '</span><span class="opt-kana">' + esc(r.muni.kana) + '</span></span><span class="opt-sub">' + esc(prefByCode[r.muni.pref].name) + "</span>";
        return '<li id="area-opt-' + i + '" role="option" class="area-opt" aria-selected="' + (i === active) + '" data-i="' + i + '">' + label + "</li>";
      }).join("") + (total > results.length ? '<li class="area-opt-empty" role="presentation">ほか ' + (total - results.length) + " 件。もう少し詳しく入れてください。</li>" : "");
    }
    listbox.hidden = false;
    search.setAttribute("aria-expanded", "true");
    search.setAttribute("aria-activedescendant", active >= 0 ? "area-opt-" + active : "");
  }
  function closeList() {
    listbox.hidden = true;
    search.setAttribute("aria-expanded", "false");
    search.removeAttribute("aria-activedescendant");
  }
  function choose(i) {
    var r = results[i];
    if (!r) return;
    closeList();
    search.value = "";
    search.blur();
    pick(r.type === "pref" ? { pref: r.pref.code, muni: null } : { pref: r.muni.pref, muni: r.muni });
  }
  search.addEventListener("focus", function () { loadMunis().then(function () { if (search.value) runSearch(); }, function () {}); });
  search.addEventListener("input", function () {
    runSearch();
    if (!muniData) loadMunis().then(runSearch, function () {});
  });
  search.addEventListener("keydown", function (e) {
    if (listbox.hidden && e.key === "ArrowDown" && search.value) { runSearch(); return; }
    if (e.key === "ArrowDown" && results.length) { e.preventDefault(); active = (active + 1) % results.length; drawList(results.length); scrollActive(); }
    else if (e.key === "ArrowUp" && results.length) { e.preventDefault(); active = (active - 1 + results.length) % results.length; drawList(results.length); scrollActive(); }
    else if (e.key === "Enter") { e.preventDefault(); if (active >= 0) choose(active); }
    else if (e.key === "Escape") { closeList(); }
  });
  function scrollActive() {
    var el = document.getElementById("area-opt-" + active);
    if (el) el.scrollIntoView({ block: "nearest" });
  }
  listbox.addEventListener("mousedown", function (e) { e.preventDefault(); });
  listbox.addEventListener("click", function (e) {
    var li = e.target.closest(".area-opt");
    if (li) choose(+li.getAttribute("data-i"));
  });
  search.addEventListener("blur", function () { setTimeout(closeList, 120); });
  root.querySelector(".area-search-form").addEventListener("submit", function (e) {
    e.preventDefault();
    if (active >= 0) choose(active);
  });

  // ---------- 選択欄・ボタン ----------
  prefSelect.addEventListener("change", function () {
    if (prefSelect.value) pick({ pref: prefSelect.value, muni: null });
  });
  muniSelect.addEventListener("change", function () {
    if (!area || !muniData) return;
    setArea({ pref: area.pref, muni: muniData.byCode[muniSelect.value] || null });
  });
  prefAllBtn.addEventListener("click", function () { if (area) setArea({ pref: area.pref, muni: null }); });
  changeBtn.addEventListener("click", function () {
    if (root.getAttribute("data-mode") === "pick" && area) {
      setMode("view");
      return;
    }
    setMode("pick");
    jumpTo(picker);
    // パソコンでは名前の入力欄へ。スマホではキーボードが急に出ないよう、見出しへ
    if (window.matchMedia("(pointer: fine)").matches) search.focus({ preventScroll: true });
    else picker.querySelector("h2").focus({ preventScroll: true });
  });
  root.querySelectorAll("[data-area]").forEach(function (b) {
    b.addEventListener("click", function () {
      areaFromCode(b.getAttribute("data-area")).then(pick);
    });
  });
  // URL をコピー
  shareBtn.addEventListener("click", function () {
    var url = location.origin + location.pathname + "?area=" + areaCode(area);
    var show = function (msg) { shareMsg.textContent = msg + url; };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(url).then(function () { show("この地域を開くURLをコピーしました："); }, function () { show("このURLを共有してください："); });
    } else {
      show("このURLを共有してください：");
    }
  });

  // ---------- カード ----------
  var cardCtx = null;
  function renderCards() {
    if (!window.RegionCards) return;
    if (!cardCtx) cardCtx = window.RegionCards.init(cardsBox, prefByCode);
    window.RegionCards.render(cardCtx, area);
  }

  // ---------- URL の地域に合わせる（開いたとき・戻る・進む） ----------
  // 地域は main.js の PortalState が URL から読んだものを使う（このファイルでは URL を読まない）
  function follow(code) {
    if (code === areaCode(area) && cardsBox.querySelector(".topic")) return; // 地域が変わらない（タブの切りかえなど）ときは何もしない
    // 地域つきの URL のときは、選ぶ画面を閉じて、その地域の情報をすぐ見せる
    setMode(code ? "view" : "pick");
    areaFromCode(code).then(function (a) {
      if (State.get().area !== code) return; // 読みこむ間に、別の地域が選ばれた
      setArea(a, { push: false });
      setMode(a ? "view" : "pick");
      // 市区町村の一覧にないコードは、都道府県のコードに直して URL に残す（一覧を読めなかったときは直さない）
      if (a && areaCode(a) !== code && (muniData || code.length === 2)) State.set({ area: areaCode(a), hash: State.get().hash }, "replace");
    });
  }

  // ---------- はじめ（地域の画面が初めて開いたとき） ----------
  // 地図などは「地域から調べる」が開くまで作らない。開いたあとは、地域が変わるたびに合わせる
  var State = window.PortalState;
  if (!State) return; // main.js が動かないときは、地図を出さない（「テーマから探す」の一覧は表示される）
  var started = false;
  function start() {
    if (started) return;
    started = true;
    drawMap();
    fillPrefSelect();
    root.setAttribute("data-ready", ""); // これがつくまでは、地図・地域の見出しを出さない（area.css）
  }
  function onState(s) {
    if (s.view === "area") start();
    if (!started) return;
    follow(s.area);
    // 最初の状態に戻ったとき（ロゴの「日本を知る。」など）：地図の拡大と、名前で探す欄の文字も元に戻す
    if (!s.view && !s.area) {
      zoom("all");
      closeList();
      search.value = "";
    }
  }
  State.on(onState);
  onState(State.get());
})();
