// 日本を知る。 ページの動き
// ・sites.js の一覧からカードを作り（作り方は site-cards.js）、分類ごとの件数と全体のサイト数を表示する
// ・スマホのメニュー開閉、上へ戻るボタン
// ・GitHub Pages のサイトだけ、ページ更新日を読み取って表示する
(function () {
  "use strict";

  var sites = window.SITES || [];

  // カード（index.html に書きこんだものを、sites.js の最新の内容で作り直す）
  if (window.SiteCards && sites.length) {
    document.querySelectorAll(".cards[data-category]").forEach(function (box) {
      box.innerHTML = window.SiteCards.html(sites, box.getAttribute("data-category"));
    });
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
  if (window.fetch) {
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
