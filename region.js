// 日本を知る。 「地域から調べる」の動き
// ・日本地図（data/japan-map.js）を描き、都道府県をクリック・キーボードで選べるようにする
// ・都道府県・市区町村の名前で検索できるようにする（市区町村の一覧 data/municipalities.json は、必要になったときに1回だけ読む）
// ・選んだ地域を URL（?area=コード）に入れる。共有・戻る・進むで同じ地域が開く
// ・選んだ地域に合わせて、8つの「調べられること」カード（region-topics.js）を作り直す
(function () {
  "use strict";

  var MAP = window.JAPAN_MAP;
  var TOPICS = window.REGION_TOPICS || [];
  var root = document.getElementById("area");
  if (!MAP || !root) return;

  var PREFS = MAP.prefs.map(function (p) { return { code: p[0], name: p[1] }; });
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
          muniData = { list: list, byCode: byCode, byPref: byPref, source: d.source, url: d.url };
          return muniData;
        })
        .catch(function (e) { muniPromise = null; throw e; });
    }
    return muniPromise;
  }

  // ---------- 選んでいる地域 ----------
  // area = null（全国）/ { pref: "13", muni: null } / { pref: "13", muni: { code, name, kana } }
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

  // ---------- 画面の部品 ----------
  var svg = root.querySelector(".jmap");
  var prefSelect = document.getElementById("area-pref");
  var muniSelect = document.getElementById("area-muni");
  var muniWrap = root.querySelector(".area-muni-field");
  var search = document.getElementById("area-search");
  var listbox = document.getElementById("area-search-list");
  var crumbs = root.querySelector(".area-current-name");
  var currentNote = root.querySelector(".area-current-note");
  var shareBtn = root.querySelector(".area-share");
  var shareMsg = root.querySelector(".area-share-msg");
  var prefAllBtn = root.querySelector(".area-pref-all");
  var cardsBox = document.getElementById("area-cards");

  // ---------- 地図 ----------
  var SVGNS = "http://www.w3.org/2000/svg";
  var pathByCode = {};
  function drawMap() {
    svg.setAttribute("viewBox", "0 0 " + MAP.w + " " + MAP.h);
    var frag = document.createDocumentFragment();
    var box = document.createElementNS(SVGNS, "rect");
    var ins = MAP.inset;
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
      var t = document.createElementNS(SVGNS, "title");
      t.textContent = p.name;
      path.appendChild(t);
      pathByCode[p.code] = path;
      frag.appendChild(path);
    });
    svg.appendChild(frag);
    // キーボード：地図には1か所だけ Tab で入れる。矢印キーで北から南へ順に移り、Enter で選ぶ
    pathByCode["13"].setAttribute("tabindex", "0");

    svg.addEventListener("click", function (e) {
      var el = e.target.closest("[data-code]");
      if (el) choosePref(el.getAttribute("data-code"), true);
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
        choosePref(el.getAttribute("data-code"), true);
        return;
      }
      if (next) {
        e.preventDefault();
        focusPath(next.code);
      }
    });
  }
  function focusPath(code) {
    Object.keys(pathByCode).forEach(function (c) { pathByCode[c].setAttribute("tabindex", c === code ? "0" : "-1"); });
    pathByCode[code].focus();
  }
  function paintMap() {
    Object.keys(pathByCode).forEach(function (c) {
      var on = area && area.pref === c;
      pathByCode[c].classList.toggle("is-on", !!on);
      pathByCode[c].setAttribute("aria-pressed", on ? "true" : "false");
    });
    var keep = area ? area.pref : "13";
    if (!svg.contains(document.activeElement)) {
      Object.keys(pathByCode).forEach(function (c) { pathByCode[c].setAttribute("tabindex", c === keep ? "0" : "-1"); });
    }
    svg.querySelector(".jmap-inset").classList.toggle("is-on", !!(area && area.pref === "47"));
  }

  // ---------- 選択欄 ----------
  function fillPrefSelect() {
    var html = '<option value="">都道府県を選ぶ</option>';
    PREFS.forEach(function (p) { html += '<option value="' + p.code + '">' + esc(p.name) + "</option>"; });
    prefSelect.innerHTML = html;
  }
  function fillMuniSelect() {
    if (!area) {
      muniWrap.hidden = true;
      return;
    }
    muniWrap.hidden = false;
    var pref = prefByCode[area.pref];
    muniSelect.innerHTML = '<option value="">' + esc(pref.name) + "全体</option>";
    muniSelect.disabled = true;
    loadMunis().then(function (d) {
      if (!area || area.pref !== pref.code) return;
      var html = '<option value="">' + esc(pref.name) + "全体</option>";
      (d.byPref[pref.code] || []).forEach(function (m) {
        html += '<option value="' + m.code + '">' + esc(m.name) + "</option>";
      });
      muniSelect.innerHTML = html;
      muniSelect.value = area.muni ? area.muni.code : "";
      muniSelect.disabled = false;
    }, function () {
      muniSelect.innerHTML = '<option value="">市区町村の一覧を読み込めませんでした</option>';
    });
  }

  // ---------- 地域を決める ----------
  function setArea(next, opts) {
    opts = opts || {};
    var changed = areaCode(next) !== areaCode(area);
    area = next;
    paintMap();
    prefSelect.value = area ? area.pref : "";
    fillMuniSelect();
    renderCurrent();
    renderCards();
    if (changed && opts.push !== false) {
      var url = new URL(location.href);
      if (area) url.searchParams.set("area", areaCode(area)); else url.searchParams.delete("area");
      history.pushState({ area: areaCode(area) }, "", url.pathname + url.search);
    }
    document.title = (area ? fullName(area) + "の情報｜" : "") + BASE_TITLE;
  }
  var BASE_TITLE = document.title;

  function fullName(a) {
    return !a ? "全国" : a.muni ? prefByCode[a.pref].name + " " + a.muni.name : prefByCode[a.pref].name;
  }

  function choosePref(code, fromMap) {
    if (!prefByCode[code]) return;
    if (area && area.pref === code && !area.muni && fromMap) return;
    setArea({ pref: code, muni: null });
    if (fromMap && window.matchMedia("(max-width: 860px)").matches) {
      muniSelect.focus({ preventScroll: true });
      root.querySelector(".area-panel").scrollIntoView({ behavior: smooth(), block: "start" });
    }
  }
  function smooth() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  }

  // 選んだ地域の表示（パンくず）
  function renderCurrent() {
    if (!area) {
      crumbs.innerHTML = '<span class="crumb-now">全国</span>';
      currentNote.textContent = "地域を選ぶと、カードがその地域の情報に切りかわります。いまは各サイトのトップを案内しています。";
      prefAllBtn.hidden = true;
      shareBtn.hidden = true;
      shareMsg.textContent = "";
      return;
    }
    var pref = prefByCode[area.pref];
    crumbs.innerHTML = area.muni
      ? '<span class="crumb-pref">' + esc(pref.name) + '</span><span class="crumb-sep" aria-hidden="true">＞</span><span class="crumb-now">' + esc(area.muni.name) + "</span>"
      : '<span class="crumb-now">' + esc(pref.name) + "</span>";
    currentNote.textContent = area.muni
      ? "下のカードから、" + area.muni.name + "について各専門サイトで調べられます。"
      : pref.name + "全体について調べられます。上の選択欄で市区町村も選べます。";
    prefAllBtn.hidden = !area.muni;
    prefAllBtn.textContent = pref.name + "全体";
    shareBtn.hidden = false;
    shareMsg.textContent = "";
  }

  // ---------- 検索 ----------
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
        (muniData ? "見つかりませんでした。漢字やひらがなで入れてみてください。" : "市区町村の一覧を読み込んでいます…") + "</li>";
    } else {
      listbox.innerHTML = results.map(function (r, i) {
        var label = r.type === "pref"
          ? '<span class="opt-name">' + esc(r.pref.name) + '</span><span class="opt-sub">都道府県全体</span>'
          : '<span class="opt-name">' + esc(r.muni.name) + '</span><span class="opt-sub">' + esc(prefByCode[r.muni.pref].name) + "</span>";
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
  function pick(i) {
    var r = results[i];
    if (!r) return;
    closeList();
    search.value = "";
    if (r.type === "pref") setArea({ pref: r.pref.code, muni: null });
    else setArea({ pref: r.muni.pref, muni: r.muni });
    goCards();
  }
  function goCards() {
    var head = document.getElementById("area-result");
    if (head) head.scrollIntoView({ behavior: smooth(), block: "start" });
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
    else if (e.key === "Enter") { e.preventDefault(); if (active >= 0) pick(active); }
    else if (e.key === "Escape") { closeList(); }
  });
  function scrollActive() {
    var el = document.getElementById("area-opt-" + active);
    if (el) el.scrollIntoView({ block: "nearest" });
  }
  listbox.addEventListener("mousedown", function (e) { e.preventDefault(); });
  listbox.addEventListener("click", function (e) {
    var li = e.target.closest(".area-opt");
    if (li) pick(+li.getAttribute("data-i"));
  });
  search.addEventListener("blur", function () { setTimeout(closeList, 120); });
  root.querySelector(".area-search-form").addEventListener("submit", function (e) {
    e.preventDefault();
    if (active >= 0) pick(active);
  });

  // ---------- 選択欄の操作 ----------
  prefSelect.addEventListener("change", function () {
    if (prefSelect.value) setArea({ pref: prefSelect.value, muni: null });
    else setArea(null);
  });
  muniSelect.addEventListener("change", function () {
    if (!area || !muniData) return;
    var m = muniData.byCode[muniSelect.value];
    setArea({ pref: area.pref, muni: m || null });
    if (m) goCards();
  });
  prefAllBtn.addEventListener("click", function () { if (area) setArea({ pref: area.pref, muni: null }); });

  // よく調べられている地域（ワンタップ）
  root.querySelectorAll("[data-area]").forEach(function (b) {
    b.addEventListener("click", function () {
      areaFromCode(b.getAttribute("data-area")).then(function (a) { setArea(a); goCards(); });
    });
  });

  // URL をコピー
  shareBtn.addEventListener("click", function () {
    var url = location.origin + location.pathname + "?area=" + areaCode(area);
    var done = function () { shareMsg.textContent = "この地域を開くURLをコピーしました：" + url; };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(url).then(done, function () { shareMsg.textContent = "このURLを共有してください：" + url; });
    } else {
      shareMsg.textContent = "このURLを共有してください：" + url;
    }
  });

  // ---------- 調べられることのカード ----------
  var cardCtx = null;
  function renderCards() {
    if (!cardsBox || !window.RegionCards) return;
    if (!cardCtx) cardCtx = window.RegionCards.init(cardsBox, { prefByCode: prefByCode });
    window.RegionCards.render(cardCtx, area);
  }

  // ---------- 戻る・進む ----------
  window.addEventListener("popstate", function () {
    var code = new URL(location.href).searchParams.get("area");
    areaFromCode(code).then(function (a) { setArea(a, { push: false }); });
  });

  // ---------- はじめ ----------
  drawMap();
  fillPrefSelect();
  var first = new URL(location.href).searchParams.get("area");
  if (first) {
    // 地域つきの URL で開いたとき（共有されたリンクなど）は、選んだ地域とカードのところから見せる
    setArea(null, { push: false });
    areaFromCode(first).then(function (a) {
      setArea(a, { push: false });
      history.replaceState({ area: areaCode(a) }, "", location.href);
      // 文字（Webフォント）が読み込まれて高さが変わったあとに移動する
      var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
      ready.then(function () {
        if (a && !location.hash) document.getElementById("area-result").scrollIntoView({ block: "start", behavior: "instant" });
      });
    });
  } else {
    setArea(null, { push: false });
  }
})();
