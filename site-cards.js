// 「テーマから探す」の12サイトのカードを作る
// ブラウザでは main.js が、手元では _tools/build_cards.mjs が使う
// （build_cards.mjs で index.html にカードを書きこんでおくと、JavaScript が動かないときもカードが出る）
(function (root) {
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

  function cardHTML(site, siteById) {
    var shot = site.shot
      ? '<div class="card-shot"><img src="' + esc(site.shot) + '" alt="' + esc(site.alt || site.name + "の画面") +
        '" width="800" height="450" loading="lazy" decoding="async" fetchpriority="low"></div>'
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

  // category の分類のカードをまとめて作る
  function categoryHTML(sites, category) {
    var siteById = {};
    sites.forEach(function (s) { siteById[s.id] = s; });
    return sites.filter(function (s) { return s.category === category; })
      .map(function (s) { return cardHTML(s, siteById); }).join("");
  }

  root.SiteCards = { html: categoryHTML };
})(typeof window !== "undefined" ? window : globalThis);
