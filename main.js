// 日本を知る。 ページの動き
// ・sites.js の一覧からカードを作る
// ・スマホのメニュー開閉、上へ戻るボタン
// ・GitHub Pages のサイトだけ、ページ更新日を読み取って表示する
(function () {
  "use strict";

  // カードで使う線画アイコン（24×24の枠で描いています）
  var ICONS = {
    timeline: '<path d="M3.5 12h17"/><circle cx="6.5" cy="12" r="1.9" fill="currentColor"/><circle cx="12" cy="12" r="1.9" fill="currentColor"/><circle cx="17.5" cy="12" r="2.6" fill="#fff"/><path d="M6.5 8.5V6M12 8.5V6"/>',
    cityhall: '<path d="M3 20.5h18"/><path d="M4.5 9.5h15"/><path d="M12 3.5l8 4.5H4z"/><path d="M6.5 9.5v8M10 9.5v8M14 9.5v8M17.5 9.5v8"/>',
    bars: '<path d="M4 20h16"/><path d="M7 16.5v-5M12 16.5V6.5M17 16.5v-8"/>',
    pin: '<path d="M12 21s-6.5-5.8-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 15.2 12 21 12 21z"/><path d="M9.3 11.2 12 9l2.7 2.2v2.6H9.3z"/>',
    dome: '<path d="M3.5 20.5h17"/><path d="M6 20.5V14h12v6.5"/><path d="M6 14a6 6 0 0 1 12 0"/><path d="M12 8V4.5"/><path d="M10.2 20.5v-2.8a1.8 1.8 0 0 1 3.6 0v2.8"/>',
    pie: '<path d="M11 4.5a8 8 0 1 0 8.5 8.5H11z"/><path d="M14 3.5a7 7 0 0 1 6.5 6.5H14z"/>',
    bubble: '<path d="M4 5h16v11h-9.5L6 20v-4H4z"/><path d="M8 9h8M8 12.3h5"/>',
    pen: '<path d="M3.5 20.5h17"/><path d="M14.5 4.5l4 4-8.5 8.5H6v-4z"/>',
    pulse: '<path d="M3 12.5h4.5l2.2-5 4.4 10 2.2-5H21"/>',
    external: '<path d="M14 4.5h5.5V10"/><path d="M19.5 4.5 11 13"/><path d="M17.5 14v4.5a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1H10"/>'
  };

  function icon(name, extra) {
    return '<svg class="ico' + (extra ? " " + extra : "") + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (ICONS[name] || "") + "</svg>";
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var sites = window.SITES || [];
  var categories = window.CATEGORIES || [];
  var siteById = {};
  sites.forEach(function (s) { siteById[s.id] = s; });
  var catName = {};
  categories.forEach(function (c) { catName[c.id] = c.name; });

  function cardHTML(site) {
    var pair = "";
    var other = site.pair && siteById[site.pair.id];
    if (other) {
      pair =
        '<div class="pair">' +
          '<span class="pair-label">' + esc(site.pair.label) + "</span>" +
          '<a class="pair-link" href="' + esc(other.url) + '" target="_blank" rel="noopener noreferrer">' +
            esc(other.name) + icon("external") + '<span class="sr-only">（新しいタブで開きます）</span>' +
          "</a>" +
        "</div>";
    }
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
    return (
      '<article class="card cat-' + esc(site.category) + '" id="site-' + esc(site.id) + '">' +
        '<div class="card-head">' +
          '<span class="card-icon">' + icon(site.icon) + "</span>" +
          '<span class="card-cat">' + esc(catName[site.category] || "") + "</span>" +
          '<span class="card-ext" title="外部サイト（新しいタブで開きます）" aria-hidden="true">' + icon("external") + "</span>" +
        "</div>" +
        '<h3 class="card-title">' + esc(site.name) + "</h3>" +
        '<p class="card-desc">' + esc(site.desc) + "</p>" +
        credit +
        (site.checkUpdate ? '<p class="card-updated" data-update-url="' + esc(site.url) + '" hidden></p>' : "") +
        pair +
        '<div class="card-foot">' +
          '<a class="btn-site" href="' + esc(site.url) + '" target="_blank" rel="noopener noreferrer" aria-label="' + esc(site.name) + 'のサイトを見る（新しいタブで開きます）">' +
            "サイトを見る" + icon("external") +
          "</a>" +
        "</div>" +
      "</article>"
    );
  }

  document.querySelectorAll(".cards[data-category]").forEach(function (box) {
    var cat = box.getAttribute("data-category");
    box.innerHTML = sites.filter(function (s) { return s.category === cat; }).map(cardHTML).join("");
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
