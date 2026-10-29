// 日本を知る。 ページの動き
// ・ページの状態（表示モード・選んでいる地域・ページ内の移動先）と URL を、1か所でまとめて扱う（window.PortalState）
// ・入口の2つのタブ（地域から調べる／テーマから探す）。選んだ方だけを表示し、URL・戻る／進むと合わせる
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

  // ---------- ページの状態（URL と画面の表示を、ここ1か所でまとめて扱う） ----------
  // 状態は3つに分けて持つ：
  //   view … 表示モード（null＝入口の2つのボタンだけ／"area"＝地域から調べる／"themes"＝テーマから探す）
  //   area … 選んでいる地域のコード（""＝全国、2けた＝都道府県、6けた＝市区町村）
  //   hash … ページ内の移動先（#top・#area・#themes・#research・#learn・#participate・#about・#policy）
  // URL から表示モードを決める順番：
  //   1. 表示モードを表すハッシュ（#area＝地域、#themes・#research・#learn・#participate＝テーマ）
  //   2. ?view=area / ?view=themes
  //   3. 正しい ?area= があれば地域
  //   4. どれもなければ、入口の2つのボタンだけ
  //   #top・#about・#policy は移動先だけを表し、表示モードは変えない
  // URL を書きかえるのも、画面に知らせるのもここだけ（region.js は PortalState.on で受け取り、PortalState.set で頼む）
  var MODE_OF_HASH = { area: "area", themes: "themes", research: "themes", learn: "themes", participate: "themes" };

  // 正しい地域コードだけを通す（2けた・6けたで、上2けたが 01〜47）。それ以外は「なし」として扱う
  function validArea(code) {
    code = String(code || "").trim();
    var p = +code.slice(0, 2);
    return /^(\d{2}|\d{6})$/.test(code) && p >= 1 && p <= 47 ? code : "";
  }
  function readURL() {
    var q = new URLSearchParams(location.search);
    var hash = "";
    try { hash = decodeURIComponent(location.hash.slice(1)); } catch (e) {}
    var view = q.get("view");
    var area = validArea(q.get("area"));
    return {
      view: MODE_OF_HASH[hash] || (view === "area" || view === "themes" ? view : null) || (area ? "area" : null),
      area: area,
      hash: hash
    };
  }
  // 状態から URL を作る。表示モードと合わないハッシュは残さず、上の読み方で同じ状態に戻る形にする
  function toURL(s) {
    var q = new URLSearchParams(location.search);
    q.delete("view");
    q.delete("area");
    var hash = s.hash;
    if (MODE_OF_HASH[hash] && MODE_OF_HASH[hash] !== s.view) hash = "";
    if (!hash && s.view === "themes") hash = "themes";
    if (!hash && s.view === "area" && !s.area) hash = "area";
    var implied = MODE_OF_HASH[hash] || (s.view && s.area ? "area" : null);
    if (s.view && implied !== s.view) q.set("view", s.view);
    if (s.view && s.area) q.set("area", s.area);
    var qs = q.toString();
    return { url: location.pathname + (qs ? "?" + qs : "") + (hash ? "#" + hash : ""), hash: hash };
  }

  var state = { view: null, area: "", hash: "" };
  var listeners = [];
  var lastHref = "";
  // how：push＝履歴に足す（人の操作）／replace＝今の履歴を書きかえる（URL を整えるだけ）／none＝URL はそのまま（戻る・進む）
  function commit(next, how) {
    var prev = state;
    if (how !== "none") {
      var u = toURL(next);
      next.hash = u.hash;
      // URL を書きかえられない環境でも、画面の切りかえは続ける
      try { history[how === "push" ? "pushState" : "replaceState"]({ portal: 1 }, "", u.url); } catch (e) {}
    }
    state = next;
    lastHref = location.href;
    listeners.forEach(function (fn) { fn(state, prev); });
  }
  window.PortalState = {
    get: function () { return { view: state.view, area: state.area, hash: state.hash }; },
    // patch：{ view } や { area } など変えるものだけ。hash を書かなければ、ページ内の移動先は消す
    set: function (patch, how) {
      var next = { view: state.view, area: state.area, hash: "" };
      Object.keys(patch).forEach(function (k) { next[k] = patch[k]; });
      next.area = validArea(next.area);
      commit(next, how || "push");
    },
    on: function (fn) { listeners.push(fn); }
  };

  // ---------- 入口のタブ ----------
  var TABS = {};
  document.querySelectorAll(".entry-tab").forEach(function (btn) {
    var name = btn.getAttribute("data-tab");
    TABS[name] = { btn: btn, panel: document.getElementById(btn.getAttribute("aria-controls")) };
  });
  var current = null;

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
  }
  // 画面のガタつきを抑えるため、アニメーションなしで移動する
  function jumpTo(el) {
    var headerH = document.querySelector(".site-header").offsetHeight;
    window.scrollTo(0, Math.max(0, el.getBoundingClientRect().top + window.pageYOffset - headerH - 8));
  }
  function jumpToHash(hash) {
    var el = hash && document.getElementById(hash);
    if (el) jumpTo(el);
  }
  // 切りかえたら、入口のボタンと中身の先頭が見える位置にする（もう見えていれば動かさない）
  function revealTabs() {
    var bar = document.querySelector(".entry-tabs");
    var headerH = document.querySelector(".site-header").offsetHeight;
    var top = bar.getBoundingClientRect().top;
    if (top < headerH || top > window.innerHeight * 0.5) jumpTo(bar);
  }

  // 戻る・進む、ページ内リンク（#themes・#about など）を押したとき
  function onHistory() {
    if (location.href === lastHref) return; // popstate と hashchange の両方が来ても1回だけ
    var u = readURL();
    if (history.state && history.state.portal) {
      // このページで作った履歴に戻った・進んだ：URL のとおりに戻す（スクロールの位置はブラウザが戻す）
      commit(u, "none");
      return;
    }
    // ページ内リンクで移動した：#top・#about・#policy なら表示モードはそのまま。URL を整えて、移動先を見せる
    var target = u.hash;
    if (!MODE_OF_HASH[target]) u.view = state.view;
    commit(u, "replace");
    jumpToHash(target);
  }

  if (TABS.area && TABS.themes) {
    window.PortalState.on(function (s) { showTab(s.view); });
    Object.keys(TABS).forEach(function (name) {
      TABS[name].btn.addEventListener("click", function () {
        if (current === name) { revealTabs(); return; }
        // 表示モードだけを変える（選んでいる地域はそのまま）。戻る・進む・共有でも同じタブが開く
        window.PortalState.set({ view: name }, "push");
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
    window.addEventListener("popstate", onHistory);
    window.addEventListener("hashchange", onHistory);
    // 開いたときの URL を読んで、整えた形に書きかえる（不正な地域コードなどは消える）
    var first = readURL();
    var firstTarget = first.hash;
    commit(first, "replace");
    jumpToHash(firstTarget);
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
