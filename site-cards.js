// 「テーマから探す」の12サイトのカードを作る（アイコンの形は brand-icons.js）
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

  // カードは「アイコンとサイト名 → 1行の要約 → 要点 → 補足 → サイトを見る」の5段
  function cardHTML(site, siteById) {
    var icon = root.brandIcon ? root.brandIcon(site.icon) : "";
    var points = (site.points || []).map(function (p) { return "<li>" + esc(p) + "</li>"; }).join("");
    var note = site.note ? '<p class="card-note">' + esc(site.note) + "</p>" : "";
    var credit = "";
    if (site.operator) {
      var handle = site.operator.x.replace(/^https?:\/\/(x|twitter)\.com\//, "@");
      credit =
        '<p class="card-credit">運営：' + esc(site.operator.name) +
          '（X <a href="' + esc(site.operator.x) + '" target="_blank" rel="noopener noreferrer">' +
            esc(handle) + '<span class="sr-only">（新しいタブで開きます）</span>' +
          "</a>）</p>";
    }
    // 「まず3分で知る」など、初心者向けの解説への補助リンク（同じ目的の「図で知る」案内がある場合は、どちらか一方だけ）
    var guide = site.guide
      ? '<p class="card-guide"><a class="pair-link" href="' + esc(site.guide.url) + '" target="_blank" rel="noopener noreferrer">' +
          esc(site.guide.label) + (site.guide.site ? "：" + esc(site.guide.site) : "") + EXTERNAL_ICON +
          '<span class="sr-only">（新しいタブで開きます）</span></a></p>'
      : "";
    var pair = "";
    var other = site.pair && siteById[site.pair.id];
    if (other) {
      pair =
        '<p class="pair"><span class="pair-label">' + esc(site.pair.label) + "：</span>" +
          '<a class="pair-link" href="' + esc(other.url) + '" target="_blank" rel="noopener noreferrer">' +
            esc(other.name) + EXTERNAL_ICON + '<span class="sr-only">（新しいタブで開きます）</span>' +
          "</a></p>";
    }
    return (
      '<article class="card cat-' + esc(site.category) + '" id="site-' + esc(site.id) + '">' +
        '<div class="card-head">' + icon + '<h3 class="card-title">' + esc(site.name) + "</h3></div>" +
        '<p class="card-summary">' + esc(site.summary || "") + "</p>" +
        '<ul class="card-points">' + points + "</ul>" +
        '<div class="card-extra">' +
          note +
          guide +
          credit +
          pair +
          // ページの更新日は、どのカードでも補足のいちばん下（ボタンのすぐ上）に置く
          (site.checkUpdate ? '<p class="card-updated" data-update-url="' + esc(site.url) + '" hidden></p>' : "") +
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
