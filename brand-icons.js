// 各専門サイトのアイコン（リンク先のファビコンと同じ形）
// 「テーマから探す」のカード（site-cards.js）と「地域から調べる」のカード（region-topics.js）の両方で使う。
// 32×32 の枠に白い形で描く。背景の四角と色は CSS（.brand-ico）で付けるので、ここでは色を決めない
// （形の切れ目は currentColor＝背景と同じ色で描く）。
//
// 形の出どころ（2026年10月29日に各サイトのファビコンを確認）：
//   policy … 政策ログJP（書類とクリップ）          karte … 自治体カルテ（右上がりの棒グラフ）
//   zairyu … 数でみる在留外国人（3本の棒グラフ）   tabunka … 全国 多文化共生予算マップ（円グラフ）
//   minpaku … 民泊・旅館業マップ（ベッド）          mosque … 日本のモスク情報（ドームと三日月）
//   kansensho … 世界の感染症と日本の水際対策（心拍の線）
//   pubcome … パブコメ掲示板（吹き出し）            shomei … 署名掲示板（署名用紙とペン）
//   mou … 日本と世界のMOU・協定マップ（地球。2026年10月29日夜にサイトのファビコンが「M」から地球に変わったのに合わせた）
//   people … 図で見る、日本に住む外国人（ファビコンがないため、内容に合わせた形）
//   日本のモスクを知る もファビコンがないため、日本のモスク情報と同じ mosque を使う
(function (root) {
  "use strict";

  root.BRAND_ICONS = {
    policy:
      '<rect x="9" y="11" width="14" height="17" rx="2" fill="#fff"/>' +
      '<rect x="13" y="7.5" width="6" height="5" rx="2" fill="#BFD7F2"/>' +
      '<path d="M12 17.8h8M12 20.8h6M12 23.8h7" stroke="currentColor" stroke-opacity=".45" stroke-width="1.5" stroke-linecap="round"/>',
    mou:
      '<g fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round"><circle cx="16" cy="16" r="11.5"/><ellipse cx="16" cy="16" rx="5.2" ry="11.5"/><path d="M4.5 16h23"/></g>',
    karte:
      '<g fill="#fff"><rect x="5.4" y="17.3" width="5.7" height="8.2" rx=".6"/><rect x="13.2" y="12.2" width="5.7" height="13.3" rx=".6"/><rect x="21" y="6.5" width="5.7" height="19" rx=".6"/></g>',
    zairyu:
      '<g fill="#fff"><rect x="5" y="16" width="6" height="10" rx="1"/><rect x="13" y="6" width="6" height="20" rx="1"/><rect x="21" y="12" width="6" height="14" rx="1"/></g>',
    tabunka:
      '<path fill="#fff" d="M14 18H24A10 10 0 1 1 14 8ZM18 14V4A10 10 0 0 1 28 14Z"/>',
    minpaku:
      '<g fill="#fff"><path d="M4 6h4v12h20v8h-4v-4H8v4H4z"/><rect x="10" y="12" width="6" height="4" rx="2"/><path d="M18 18v-4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v4z"/></g>',
    mosque:
      '<path d="M16.5 2.8a3 3 0 1 0 2.3 5a2.3 2.3 0 1 1-2.3-5z" fill="#BFD7F2"/>' +
      '<path d="M16 9C12.5 13 6 14 6 20h20c0-6-6.5-7-10-11z" fill="#fff"/>' +
      '<path d="M4.5 21h23v7h-23z" fill="#fff"/>' +
      '<path d="M13.8 28v-3.5a2.2 2.2 0 0 1 4.4 0V28z" fill="currentColor"/>',
    kansensho:
      '<path d="M5 17h5l3-7 5 13 3-6h6" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
    pubcome:
      '<path fill="#fff" d="M8.5 5.5h15a4 4 0 0 1 4 4v9a4 4 0 0 1-4 4H16l-6 5v-5H8.5a4 4 0 0 1-4-4v-9a4 4 0 0 1 4-4z"/>' +
      '<path fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" d="M10 11h12M10 17h7"/>',
    shomei:
      '<rect x="5.5" y="4.5" width="15.5" height="22.5" rx="1.8" fill="#fff"/>' +
      '<g transform="translate(15.5 23.5) rotate(45) scale(.5)">' +
        '<path d="M0 0L-5.5-10V-31A5.5 5.5 0 0 1 5.5-31V-10Z" fill="currentColor" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/>' +
        '<path d="M0 0L-5.5-10V-31A5.5 5.5 0 0 1 5.5-31V-10Z" fill="#fff"/>' +
      "</g>",
    people:
      '<g fill="#fff"><circle cx="12" cy="10.5" r="4"/><path d="M4.5 26c.5-5.2 3.4-8.3 7.5-8.3s7 3.1 7.5 8.3z"/>' +
      '<circle cx="21.8" cy="12.3" r="3.2"/><path d="M20.4 18.2c4 .1 6.4 2.8 7 7.8h-6.2c-.3-3-1.3-5.7-3.3-7.4z"/></g>'
  };

  // アイコン1つ分の HTML（飾りなので読み上げない）
  root.brandIcon = function (name) {
    var g = root.BRAND_ICONS[name];
    if (!g) return "";
    return '<span class="brand-ico" aria-hidden="true"><svg viewBox="0 0 32 32" focusable="false">' + g + "</svg></span>";
  };
})(typeof window !== "undefined" ? window : globalThis);
