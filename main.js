// 日本を知る。 ページの動き
// ・sites.js の一覧からカードを作り、分類ごとの件数と全体のサイト数を表示する
// ・スマホのメニュー開閉、上へ戻るボタン
// ・GitHub Pages のサイトだけ、ページ更新日を読み取って表示する
(function () {
  "use strict";

  var EXTERNAL_ICON =
    '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path d="M14 4.5h5.5V10"/><path d="M19.5 4.5 11 13"/><path d="M17.5 14v4.5a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1H10"/>' +
    "</svg>";

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var sites = window.SITES || [];
  var siteById = {};
  sites.forEach(function (s) { siteById[s.id] = s; });

  function cardHTML(site) {
    var shot = site.shot
      ? '<div class="card-shot"><img src="' + esc(site.shot) + '" alt="' + esc(site.alt || site.name + "の画面") +
        '" width="800" height="450" loading="lazy" decoding="async"></div>'
      : "";
    var highlight = site.highlight ? '<p class="card-highlight">' + esc(site.highlight) + "</p>" : "";
    var credit = "";
    if (site.operator) {
      var handle = site.operator.x.replace(/^https?:\/\/(x|twitter)\.com\//, "@");
      credit =
        '<p class="card-credit">' +
          "<span>運営：" + esc(site.operator.name) + "</span>" +
          '<span>X：<a href="' + esc(site.operator.x) + '" target="_blank" rel="noopener noreferrer">' +
            esc(handle) + '<span class="sr-only">（新しいタブで開きます）</span>' +
          "</a></span>" +
        "</p>";
    }
    var pair = "";
    var other = site.pair && siteById[site.pair.id];
    if (other) {
      pair =
        '<div class="pair">' +
          '<span class="pair-label">' + esc(site.pair.label) + "</span>" +
          '<a class="pair-link" href="' + esc(other.url) + '" target="_blank" rel="noopener noreferrer">' +
            esc(other.name) + EXTERNAL_ICON + '<span class="sr-only">（新しいタブで開きます）</span>' +
          "</a>" +
        "</div>";
    }
    return (
      '<article class="card cat-' + esc(site.category) + '" id="site-' + esc(site.id) + '">' +
        '<h3 class="card-title">' + esc(site.name) + "</h3>" +
        (shot || '<div class="card-shot" aria-hidden="true"></div>') +
        '<p class="card-q">' + esc(site.q || "") + "</p>" +
        '<p class="card-desc">' + esc(site.desc) + "</p>" +
        '<div class="card-extra">' +
          highlight +
          credit +
          (site.checkUpdate ? '<p class="card-updated" data-update-url="' + esc(site.url) + '" hidden></p>' : "") +
          pair +
        "</div>" +
        '<div class="card-foot">' +
          '<a class="btn-site" href="' + esc(site.url) + '" target="_blank" rel="noopener noreferrer" aria-label="' + esc(site.name) + 'のサイトを見る（新しいタブで開きます）">' +
            "サイトを見る" + EXTERNAL_ICON +
          "</a>" +
        "</div>" +
      "</article>"
    );
  }

  document.querySelectorAll(".cards[data-category]").forEach(function (box) {
    var cat = box.getAttribute("data-category");
    box.innerHTML = sites.filter(function (s) { return s.category === cat; }).map(cardHTML).join("");
  });

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
          el.textContent = "ページ更新日：" + toJapaneseDate(d);
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
