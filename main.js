// 日本を知る。 ページの動き
// ・入口の2つのタブ（地域から調べる／テーマから探す）。選んだ方だけを表示し、URL（#area・#themes など）・戻る／進むと合わせる
// ・sites.js の一覧からカードを作り（作り方は site-cards.js）、分類ごとの件数と全体のサイト数を表示する
// ・スマホのメニュー開閉、上へ戻るボタン
// ・GitHub Pages のサイトだけ、ページ更新日を読み取って表示する
(function () {
  "use strict";

  var sites = window.SITES || [];

  // 「テーマから探す」を初めて開いたときに1回だけ、カードを sites.js の最新の内容で作り直し、ページの更新日を読む
  // （index.html にはカードを書きこんであるので、JavaScript が動かないときもカードは出る）
  var themesReady = false;
  function prepareThemes() {
    if (themesReady) return;
    themesReady = true;
    if (window.SiteCards && sites.length) {
      document.querySelectorAll(".cards[data-category]").forEach(function (box) {
        box.innerHTML = window.SiteCards.html(sites, box.getAttribute("data-category"));
      });
    }
    loadUpdateDates();
  }

  // 件数：data-count="all" は全体、それ以外は分類ごとの数
  document.querySelectorAll("[data-count]").forEach(function (el) {
    var cat = el.getAttribute("data-count");
    var n = cat === "all" ? sites.length : sites.filter(function (s) { return s.category === cat; }).length;
    el.textContent = String(n);
  });

  // ページ更新日：サイトから返ってくる「最終更新日時」をそのまま日本時間で表示する。
  // 読み取れなかったときは何も表示しない（推測の日付は出さない）。
  function toJapaneseDate(d) {
    var j = new Date(d.getTime() + 9 * 60 * 60 * 1000);
    return j.getUTCFullYear() + "年" + (j.getUTCMonth() + 1) + "月" + j.getUTCDate() + "日";
  }
  function loadUpdateDates() {
    if (!window.fetch) return;
    document.querySelectorAll("[data-update-url]").forEach(function (el) {
      fetch(el.getAttribute("data-update-url"), { method: "HEAD" })
        .then(function (res) {
          var lm = res.ok ? res.headers.get("Last-Modified") : null;
          var d = lm ? new Date(lm) : null;
          if (!d || isNaN(d.getTime())) return;
          el.textContent = "ページの更新日：" + toJapaneseDate(d);
          el.hidden = false;
        })
        .catch(function () {});
    });
  }

  // ---------- 入口のタブ ----------
  // URL との対応：#area＝地域から調べる、#themes・#research・#learn・#participate＝テーマから探す、
  // ?area=コード＝地域から調べる（その地域の情報）。どれでもないときは、どちらも開かない
  var TABS = {};
  document.querySelectorAll(".entry-tab").forEach(function (btn) {
    var name = btn.getAttribute("data-tab");
    TABS[name] = { btn: btn, panel: document.getElementById(btn.getAttribute("aria-controls")) };
  });
  var THEME_IDS = ["themes", "research", "learn", "participate"];
  var current = null;

  function tabFromURL() {
    var id = decodeURIComponent(location.hash.slice(1));
    if (THEME_IDS.indexOf(id) >= 0) return "themes";
    if (id === "area" || new URLSearchParams(location.search).has("area")) return "area";
    if (!id) return null;
    return undefined; // #top・#about など：今のタブのまま
  }
  function showTab(name) {
    if (name === current) return;
    current = name;
    Object.keys(TABS).forEach(function (k) {
      var on = k === name;
      TABS[k].btn.setAttribute("aria-selected", on ? "true" : "false");
      TABS[k].panel.classList.toggle("is-open", on);
    });
    // キーボード：タブには1か所だけ Tab で入れる（選んでいる方、なければ左）
    var focusable = name || "area";
    Object.keys(TABS).forEach(function (k) { TABS[k].btn.tabIndex = k === focusable ? 0 : -1; });
    if (name === "themes") prepareThemes();
    // region.js に、地域の画面が開いたことを知らせる（地図などは、開いたときに初めて作る）
    if (name === "area") document.dispatchEvent(new Event("area:open"));
  }
  // 画面のガタつきを抑えるため、アニメーションなしで移動する
  function jumpTo(el) {
    var headerH = document.querySelector(".site-header").offsetHeight;
    window.scrollTo(0, Math.max(0, el.getBoundingClientRect().top + window.pageYOffset - headerH - 8));
  }
  // 切りかえたら、入口のボタンと中身の先頭が見える位置にする（もう見えていれば動かさない）
  function revealTabs() {
    var bar = document.querySelector(".entry-tabs");
    var headerH = document.querySelector(".site-header").offsetHeight;
    var top = bar.getBoundingClientRect().top;
    if (top < headerH || top > window.innerHeight * 0.5) jumpTo(bar);
  }
  // URL に合わせてタブを開き、#research などの場所へ移動する
  function syncFromURL(scroll) {
    var t = tabFromURL();
    if (t === undefined) return;
    showTab(t);
    if (!scroll) return;
    var id = decodeURIComponent(location.hash.slice(1));
    var target = id && document.getElementById(id);
    if (target && t) jumpTo(target);
    else if (!t) window.scrollTo(0, 0);
  }

  if (TABS.area && TABS.themes) {
    Object.keys(TABS).forEach(function (name) {
      TABS[name].btn.addEventListener("click", function () {
        if (current === name) { revealTabs(); return; }
        showTab(name);
        // URL に残して、戻る・進む・共有でも同じタブが開くようにする（選んでいる地域 ?area= はそのまま）
        history.pushState(null, "", location.pathname + location.search + "#" + name);
        revealTabs();
      });
      // ← → キーでもう一方のタブへ
      TABS[name].btn.addEventListener("keydown", function (e) {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "Home" && e.key !== "End") return;
        e.preventDefault();
        var other = TABS[name === "area" ? "themes" : "area"].btn;
        var next = e.key === "Home" ? TABS.area.btn : e.key === "End" ? TABS.themes.btn : other;
        next.focus();
        next.click();
      });
    });
    // ページ内リンク（#themes・#research など）や、戻る・進むのとき
    window.addEventListener("hashchange", function () { syncFromURL(true); });
    window.addEventListener("popstate", function () { syncFromURL(false); });
    syncFromURL(true);
    window.ENTRY_READY = true;
  }

  // スマホのメニュー
  var toggle = document.querySelector(".menu-toggle");
  var nav = document.getElementById("site-nav");
  function setMenu(open) {
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-label", open ? "メニューを閉じる" : "メニューを開く");
    nav.classList.toggle("is-open", open);
  }
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      setMenu(toggle.getAttribute("aria-expanded") !== "true");
    });
    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) setMenu(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        setMenu(false);
        toggle.focus();
      }
    });
  }

  // 上へ戻るボタン：少しスクロールしたら出す
  var toTop = document.querySelector(".to-top");
  if (toTop) {
    var onScroll = function () { toTop.classList.toggle("is-visible", window.scrollY > 600); };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }
})();
