// 全サイト共通メニュー（日本を知る。｜声を届ける｜ほかのサイト ▾）
//
// 使い方：各サイトに次の1行を足すだけです（async なので、読み込みが遅くても失敗してもページの表示は止まりません）。
//   <script src="https://yumaki5555.github.io/shared/site-nav.js" async></script>
// 置く場所を決めたいときは、そこに <nihon-site-nav>読み込めなかったときに出すリンク</nihon-site-nav> を書きます。
// 書いていなければ「本文へ移動」のリンクの次（なければページのいちばん上）に自分で入ります。
// 読み込み失敗に備えて、各サイトには次の形で置きます（失敗しても「日本を知る。」へのリンクが残り、印刷には出ません）。
//   <style>nihon-site-nav:not(:defined){display:block;min-height:45px;padding:0 16px;background:#f4f6f6;border-bottom:1px solid #d5dcde;font:14px/44px system-ui,sans-serif}@media print{nihon-site-nav{display:none!important}}</style>
//   <nihon-site-nav><a href="https://yumaki5555.github.io/">日本を知る。</a></nihon-site-nav>
//   <script src="https://yumaki5555.github.io/shared/site-nav.js" data-place="manual" async></script>
//
// ・見た目は部品の中に閉じ込めています（Shadow DOM）。サイトのCSSと影響し合いません。
// ・印刷には出ません。リンクはすべて同じタブで開きます。
// ・サイトの一覧は入口サイトの sites.js から作ります（node _tools/build_cards.mjs）。下の印の間を手で直さないでください。
(function () {
  "use strict";

  var ORIGIN = "https://yumaki5555.github.io";
  var TAG = "nihon-site-nav";

  /* sites:start（_tools/build_cards.mjs が書きこみます） */
  var SITES = [
    {"id":"todokeru","name":"声を届ける。","url":"https://yumaki5555.github.io/todokeru/#/","category":"participate"},
    {"id":"policy-log","name":"政策ログJP","url":"https://policy-log.jp/","category":"research","other":true},
    {"id":"mou-map","name":"日本と世界のMOU・協定マップ","url":"https://yumaki5555.github.io/mou-map/","category":"research"},
    {"id":"zititai-karte","name":"自治体カルテ","url":"https://www.zititai-karte.com/","category":"research","other":true},
    {"id":"tabunka-yosan","name":"全国 多文化共生予算マップ","url":"https://yumaki5555.github.io/tabunka-yosan/","category":"research"},
    {"id":"zairyu","name":"数でみる在留外国人","url":"https://yumaki5555.github.io/zairyu/index.html","category":"research"},
    {"id":"nihongo-school-map","name":"日本語学校・留学生 全国マップ","url":"https://yumaki5555.github.io/nihongo-school-map/","category":"research"},
    {"id":"minpaku-map","name":"民泊・旅館業マップ","url":"https://yumaki5555.github.io/minpaku-map/","category":"research"},
    {"id":"mosque-map","name":"日本のモスク情報","url":"https://yumaki5555.github.io/mosque-map/","category":"research"},
    {"id":"kansensho","name":"世界の感染症と日本の水際対策","url":"https://yumaki5555.github.io/kansensho/","category":"research"},
    {"id":"mosque-guide","name":"日本のモスクを知る","url":"https://mosque-info-explorer.sunlitmole256.chatgpt.site/","category":"learn","other":true},
    {"id":"zairyu-guide","name":"図で見る、日本に住む外国人","url":"https://nihon-kurashi-zairyu-guide.sunlitmole256.chatgpt.site/","category":"learn","other":true},
    {"id":"pubcome","name":"パブコメ掲示板","url":"https://yumaki5555.github.io/pubcome/","category":"participate"},
    {"id":"shomei","name":"署名掲示板","url":"https://yumaki5555.github.io/shomei/","category":"participate"}
  ];
  /* sites:end */

  var GROUPS = [
    { id: "research", label: "調べる・比較する" },
    { id: "learn", label: "わかりやすく学ぶ" },
    { id: "participate", label: "声を届ける・参加する" }
  ];
  var PORTAL = { name: "日本を知る。", path: "/" };
  var TODOKERU = { name: "声を届ける", path: "/todokeru/" };

  var script = document.currentScript;

  // 公開先と手元の確認環境でだけ動く（同じページを上げている共有サイトには出さない）
  var host = location.hostname;
  if (location.origin !== ORIGIN && host !== "localhost" && host !== "127.0.0.1") return;
  if (!window.customElements || customElements.get(TAG)) return;

  /** 公開先のURLを、いま見ている場所（公開先または手元）のURLに読みかえる */
  function here(url) {
    return url.indexOf(ORIGIN + "/") === 0 ? location.origin + url.slice(ORIGIN.length) : url;
  }
  function firstFolder(pathname) {
    return pathname.split("/")[1] || "";
  }
  /** いま見ているサイトの名前（一覧にないページでは出さない） */
  function currentSiteName() {
    var folder = firstFolder(location.pathname);
    if (!folder || folder === "index.html") return PORTAL.name;
    for (var i = 0; i < SITES.length; i++) {
      var u = SITES[i].url;
      if (u.indexOf(ORIGIN + "/") === 0 && firstFolder(u.slice(ORIGIN.length)) === folder) return SITES[i].name;
    }
    return "";
  }
  function isCurrent(site) {
    return site.url.indexOf(ORIGIN + "/") === 0 && firstFolder(site.url.slice(ORIGIN.length)) === firstFolder(location.pathname);
  }

  // 「声を届ける」へ渡す戻り先：<a href="/todokeru/#/..." data-nihon-handoff data-item="項目名"> を押した瞬間の、このページのURLを足す。
  // 絞り込みの状態もURLごと渡せる。この部品が読み込めないときは、戻り先なしの通常のリンクとして動く。
  function addHandoff(e) {
    var a = e.target && e.target.closest ? e.target.closest("a[data-nihon-handoff]") : null;
    if (!a) return;
    var base = a.getAttribute("data-base") || a.getAttribute("href");
    a.setAttribute("data-base", base);
    var i = base.indexOf("#");
    if (i < 0) return;
    var hash = base.slice(i + 1);
    var j = hash.indexOf("?");
    var q = new URLSearchParams(j >= 0 ? hash.slice(j + 1) : "");
    q.set("from", location.href);
    var item = a.getAttribute("data-item");
    if (item) q.set("item", Array.from(item).slice(0, 60).join(""));
    a.setAttribute("href", base.slice(0, i) + "#" + (j >= 0 ? hash.slice(0, j) : hash) + "?" + q.toString());
  }
  ["click", "auxclick", "contextmenu"].forEach(function (t) {
    document.addEventListener(t, addHandoff, true);
  });

  var CSS =
    ":host{display:block;position:relative;font:14px/1.5 system-ui,-apple-system,'Hiragino Sans','Yu Gothic UI','Meiryo',sans-serif;color:#1f2a2e;text-align:left;letter-spacing:normal}" +
    "*{box-sizing:border-box}" +
    ".bar{background:#f4f6f6;border-bottom:1px solid #d5dcde}" +
    ".in{display:flex;flex-wrap:wrap;align-items:stretch;max-width:1056px;margin:0 auto;padding:0 16px}" +
    "a,button{color:inherit;font:inherit}" +
    ".item{display:inline-flex;align-items:center;min-height:44px;padding:0 10px;text-decoration:none;background:none;border:0;cursor:pointer;white-space:nowrap}" +
    ".item:first-child{padding-left:0;font-weight:700}" +
    ".item:hover{text-decoration:underline}" +
    ".item+.item{border-left:1px solid #d5dcde}" +
    ".item[aria-current]{font-weight:700}" +
    "a:focus-visible,button:focus-visible{outline:3px solid #b3541e;outline-offset:-3px}" +
    ".arrow{margin-left:.3em;font-size:1.15em;line-height:1}" +
    ".panel{position:absolute;z-index:1000;left:0;right:0;top:100%;background:#fff;border-bottom:1px solid #aeb9bc;box-shadow:0 8px 20px rgba(0,0,0,.14);max-height:calc(100vh - 60px);overflow-y:auto;overscroll-behavior:contain}" +
    ".panel[hidden]{display:none}" +
    ".panel-in{max-width:1056px;margin:0 auto;padding:12px 16px 16px}" +
    ".now{margin:0 0 10px;font-size:13px;color:#4c5b60}" +
    ".now b{color:#1f2a2e}" +
    ".groups{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px 24px}" +
    "h2{margin:0 0 4px;font-size:13px;font-weight:700;color:#4c5b60}" +
    "ul{list-style:none;margin:0;padding:0}" +
    ".panel a{display:flex;flex-wrap:wrap;align-items:center;gap:0 .5em;min-height:44px;padding:6px 8px;margin:0 -8px;border-radius:6px;text-decoration:none;overflow-wrap:anywhere}" +
    ".panel a:hover{background:#eef3f4;text-decoration:underline}" +
    ".panel a[aria-current]{font-weight:700;background:#eef3f4}" +
    ".mark{font-size:12px;font-weight:400;color:#4c5b60}" +
    "@media (max-width:480px){.in{padding:0 12px}.item{padding:0 8px;font-size:13px}.item:first-child{padding-left:0}}" +
    "@media print{:host{display:none!important}}";

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function panelHtml() {
    var name = currentSiteName();
    var groups = GROUPS.map(function (g) {
      var rows = SITES.filter(function (s) { return s.category === g.id; }).map(function (s) {
        var cur = isCurrent(s);
        return "<li><a href=\"" + esc(here(s.url)) + "\"" + (cur ? ' aria-current="page"' : "") + ">" + esc(s.name) +
          (cur ? '<span class="mark">（いま見ているサイト）</span>' : s.other ? '<span class="mark">（別の運営）</span>' : "") + "</a></li>";
      }).join("");
      return rows ? "<div><h2>" + esc(g.label) + "</h2><ul>" + rows + "</ul></div>" : "";
    }).join("");
    return '<div class="panel-in">' + (name ? '<p class="now">いま見ているサイト：<b>' + esc(name) + "</b></p>" : "") + '<div class="groups">' + groups + "</div></div>";
  }

  class SiteNav extends HTMLElement {
    connectedCallback() {
      if (this.shadowRoot) return;
      var folder = firstFolder(location.pathname);
      // 中に書かれた「読み込めなかったときのリンク」は、ここで隠れる（部品が動かなければ、そのまま見える）
      var root = this.attachShadow({ mode: "open" });
      root.innerHTML =
        "<style>" + CSS + "</style>" +
        '<nav class="bar" aria-label="サイト全体のメニュー"><div class="in">' +
        '<a class="item" href="' + esc(here(ORIGIN + PORTAL.path)) + '"' + (!folder || folder === "index.html" ? ' aria-current="page"' : "") + ">" + esc(PORTAL.name) + "</a>" +
        '<a class="item" href="' + esc(here(ORIGIN + TODOKERU.path)) + '"' + (folder === firstFolder(TODOKERU.path) ? ' aria-current="true"' : "") + ">" + esc(TODOKERU.name) + "</a>" +
        '<button class="item" type="button" aria-expanded="false" aria-controls="panel">ほかのサイト<span class="arrow" aria-hidden="true">▾</span></button>' +
        "</div></nav>" +
        '<div class="panel" id="panel" hidden>' + panelHtml() + "</div>";

      var self = this;
      var btn = root.querySelector("button");
      var panel = root.querySelector(".panel");
      function setOpen(open) {
        panel.hidden = !open;
        btn.setAttribute("aria-expanded", open ? "true" : "false");
        if (open) {
          document.addEventListener("click", onOutside, true);
          document.addEventListener("keydown", onKey, true);
        } else {
          document.removeEventListener("click", onOutside, true);
          document.removeEventListener("keydown", onKey, true);
        }
      }
      function onOutside(e) {
        if (e.composedPath().indexOf(self) < 0) setOpen(false);
      }
      function onKey(e) {
        if (e.key === "Escape") {
          setOpen(false);
          btn.focus();
        }
      }
      btn.addEventListener("click", function () {
        setOpen(panel.hidden);
      });
      // 同じサイトの中の移動（声を届けるの中で「声を届ける。」を押すなど）はページが読み直されないので、押したら閉じる
      panel.addEventListener("click", function (e) {
        if (e.target.closest("a")) setOpen(false);
      });
      // キーボードで部品の外へ移ったら閉じる
      root.addEventListener("focusout", function (e) {
        if (!panel.hidden && e.relatedTarget && !root.contains(e.relatedTarget)) setOpen(false);
      });
      // 「戻る」でこのページに帰ってきたときに開いたままにしない
      window.addEventListener("pagehide", function () {
        setOpen(false);
      });
    }
  }

  customElements.define(TAG, SiteNav);

  // data-place="manual"：サイトの側で置き場所を書く（React で作るページなど、読み込みの順番が決まらないサイト用）
  if (script && script.getAttribute("data-place") === "manual") return;

  /** サイトに置き場所がないときは「本文へ移動」の次（なければいちばん上）に入れる */
  function autoPlace() {
    if (document.querySelector(TAG)) return;
    var el = document.createElement(TAG);
    var first = document.body.querySelector("a[href]");
    var isSkip = first && first.parentNode === document.body && /本文/.test(first.textContent || "");
    if (isSkip) first.parentNode.insertBefore(el, first.nextSibling);
    else document.body.insertBefore(el, document.body.firstChild);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", autoPlace);
  else autoPlace();
})();
