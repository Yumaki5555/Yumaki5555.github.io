// 「地域から調べる」の8つのカード
// それぞれのカードは、選んだ地域を専門サイトへ引き継ぐリンクと、取れるときだけ代表的な数値を出します。
//
// ■ 地域の引き継ぎ（各サイトに実際にあるURLの形だけを使う。2026年10月28日に各サイトで確認）
//   exact … 選んだ地域（市区町村 or 都道府県）のページが開く   → 「地域を引き継ぎ」
//   wider … 市区町村のページがなく、都道府県のページが開く     → 「都道府県まで」
//   top   … 地域は引き継がれず、サイトのトップが開く           → 「引き継ぎなし」
//   all   … 地域を選ぶ前（全国）                               → 「全国」
//   リンクは、データを読む前に決められる「確実な形」を先に出し、データを読んで市区町村のページがあると分かったら差しかえる。
//   データが読めなかったときも、カードとリンクは残す（確実な形のまま）。
//
// ■ 数値（各サイトが公開しているデータファイルを、地域を選んだときに読み込む。
//   数値は各サイトの集計時点のもので、リアルタイムの値ではない。同じファイルはページを開いている間は読み直さない）
//   「0件」と、それ以外の状態を必ず分けて表示する：
//   確認済みで0件 ／ データ未掲載 ／ 調査対象外 ／ 未確認 ／ 取得失敗
(function () {
  "use strict";

  var GH = "https://yumaki5555.github.io/";
  var TIMEOUT = 15000; // これより長くかかったら「取得失敗」にする（ミリ秒）

  var STATE = {
    zero: "確認済みで0件",
    unlisted: "データ未掲載",
    outside: "調査対象外",
    unconfirmed: "未確認",
    error: "取得失敗"
  };
  var SCOPE = {
    exact: { tag: "地域を引き継ぎ", icon: '<path d="M5 12.5l4.5 4.5L19 7.5"/>' },
    wider: { tag: "都道府県まで", icon: '<path d="M12 5v9M12 18.5v.5"/>' },
    top: { tag: "引き継ぎなし", icon: '<path d="M6 12h12"/>' },
    all: { tag: "全国", icon: '<circle cx="12" cy="12" r="6.5"/>' },
    pending: { tag: "確認中", icon: '<circle cx="12" cy="12" r="1.2"/><circle cx="7" cy="12" r="1.2"/><circle cx="17" cy="12" r="1.2"/>' }
  };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function num(n) { return Number(n).toLocaleString("ja-JP"); }
  function jdate(s) {
    // "2026-10-28" / "2026/10/28" / "2026-10-28T10:00+09:00" → 2026年10月28日（時刻があれば付ける）
    var m = String(s || "").match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})(?:T(\d{1,2}):(\d{2}))?/);
    if (!m) return "";
    return m[1] + "年" + (+m[2]) + "月" + (+m[3]) + "日" + (m[4] ? " " + (+m[4]) + ":" + m[5] : "");
  }
  function mdate(s) {
    var m = String(s || "").match(/(\d{4})-(\d{2})-(\d{2})/);
    return m ? (+m[2]) + "月" + (+m[3]) + "日" : "";
  }
  function yen(a) {
    // 円 → 「3億4,976.7万円」「7,804.2万円」
    var man = a / 10000;
    if (man >= 10000) {
      var oku = Math.floor(man / 10000);
      var rest = man - oku * 10000;
      return oku + "億" + (rest >= 0.05 ? rest.toLocaleString("ja-JP", { maximumFractionDigits: 1 }) + "万" : "") + "円";
    }
    return man.toLocaleString("ja-JP", { maximumFractionDigits: 1 }) + "万円";
  }
  function today() {
    return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10); // 日本時間の日付
  }
  // 都道府県の6けたコード（団体コード＋検査数字）。例：13 → 130001
  function prefCode6(p) {
    var s = (+p[0]) * 6 + (+p[1]) * 5;
    return p + "000" + ((11 - (s % 11)) % 10);
  }
  // 都道府県のローマ字（数でみる在留外国人・日本のモスク情報のページ名。01 北海道 〜 47 沖縄県の順）
  var ROMA = ["hokkaido", "aomori", "iwate", "miyagi", "akita", "yamagata", "fukushima", "ibaraki", "tochigi", "gunma",
    "saitama", "chiba", "tokyo", "kanagawa", "niigata", "toyama", "ishikawa", "fukui", "yamanashi", "nagano", "gifu",
    "shizuoka", "aichi", "mie", "shiga", "kyoto", "osaka", "hyogo", "nara", "wakayama", "tottori", "shimane", "okayama",
    "hiroshima", "yamaguchi", "tokushima", "kagawa", "ehime", "kochi", "fukuoka", "saga", "nagasaki", "kumamoto", "oita",
    "miyazaki", "kagoshima", "okinawa"];

  // ---------- データの読み込み ----------
  // 同じファイルは1回だけ読む（失敗したときは覚えず、次に地域を選んだときに読み直す）
  var cache = {};
  function once(key, fn) {
    if (!cache[key]) cache[key] = fn().catch(function (e) { delete cache[key]; throw e; });
    return cache[key];
  }
  function get(url) {
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, TIMEOUT) : 0;
    return fetch(url, ctrl ? { signal: ctrl.signal } : undefined).then(function (r) {
      clearTimeout(timer);
      return r;
    }, function (e) {
      clearTimeout(timer);
      throw e;
    });
  }
  function ok(r) { if (!r.ok) throw new Error(r.status + " " + r.url); return r; }
  function getJSON(url) { return get(url).then(ok).then(function (r) { return r.json(); }); }
  function getText(url) { return get(url).then(ok).then(function (r) { return r.text(); }); }
  // ページに埋め込まれたデータ（<script id="…" type="application/json">）を、ページ全体を解析せずに取り出す
  function embedded(html, id) {
    var m = new RegExp('<script[^>]*\\bid="' + id + '"[^>]*>').exec(html);
    if (!m) throw new Error("no data " + id);
    var start = m.index + m[0].length;
    return JSON.parse(html.slice(start, html.indexOf("</script>", start)));
  }
  function parseCSV(text) {
    var rows = [], row = [], f = "", q = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
        else f += ch;
      } else if (ch === '"') q = true;
      else if (ch === ",") { row.push(f); f = ""; }
      else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(f); rows.push(row); row = []; f = "";
      } else f += ch;
    }
    if (f || row.length) { row.push(f); rows.push(row); }
    return rows;
  }

  var load = {
    minpaku: function () { return once("minpaku", function () { return getText(GH + "minpaku-map/").then(function (h) { return embedded(h, "site-data"); }); }); },
    tabunka: function () { return once("tabunka", function () { return getJSON(GH + "tabunka-yosan/data/dist/summary.json"); }); },
    mou: function () { return once("mou", function () { return getJSON(GH + "mou-map/data/build/summary.json"); }); },
    pubPref: function () { return once("pubPref", function () { return getText(GH + "pubcome/pref/").then(function (h) { return embedded(h, "data"); }); }); },
    pubCity: function () { return once("pubCity", function () { return getText(GH + "pubcome/city/").then(function (h) { return embedded(h, "data"); }); }); },
    pubCounts: function () { return once("pubCounts", function () { return getJSON(GH + "pubcome/counts.json"); }); },
    shomei: function () { return once("shomei", function () { return getText(GH + "shomei/").then(function (h) { return embedded(h, "data"); }); }); },
    mosque: function () {
      return once("mosque", function () {
        return get(GH + "mosque-map/mosque_locations.csv").then(ok).then(function (r) {
          var lm = r.headers.get("Last-Modified");
          return r.text().then(function (text) {
            var rows = parseCSV(text.replace(/^﻿/, ""));
            var head = rows.shift();
            var ix = { kind: head.indexOf("種類"), pref: head.indexOf("都道府県"), city: head.indexOf("市区町村") };
            if (ix.kind < 0 || ix.pref < 0 || ix.city < 0) throw new Error("csv columns");
            var d = lm ? new Date(lm) : null;
            return {
              updated: d && !isNaN(d) ? new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10) : "",
              rows: rows.filter(function (x) { return x.length > 2; }).map(function (x) {
                return { kind: x[ix.kind], pref: x[ix.pref], city: x[ix.city] };
              })
            };
          });
        });
      });
    },
    // 数でみる在留外国人：開くページそのもの（地域ごとに別のページ）
    zairyu: function (url) {
      return once("zairyu " + url, function () {
        return get(url).then(function (r) {
          if (r.status === 404) return { missing: true };
          ok(r);
          return r.text().then(function (html) {
            var re = /<script type="application\/json">([\s\S]*?)<\/script>/g, m;
            while ((m = re.exec(html))) {
              try {
                var d = JSON.parse(m[1]);
                if (d && d.dim === "nat" && typeof d.total === "number") return d;
              } catch (e) { /* ほかのデータは使わない */ }
            }
            return {};
          });
        });
      });
    }
  };

  // ---------- 8つのカード ----------
  // q / desc … 地域名を入れた問いかけと、そのサイトで分かること（n＝選んだ地域の名前、p＝都道府県名）
  // link(a)  … データを読まずに決められるリンク { href, scope, text }
  // resolve(a) … データを読んで { stat, href?, scope?, text? } を返す（なければ数値は出さない）
  //   stat … { value: 大きく出す文, sub: 数値の内わけ（なくてもよい）, note: 集計時点・対象範囲, state: STATE のどれか（ふつうの数値ならなし） }
  var GROUPS = [
    { id: "now", mark: "A", title: "地域の現状を知る" },
    { id: "gov", mark: "B", title: "行政の動きを調べる" },
    { id: "voice", mark: "C", title: "声を届ける・参加する" }
  ];
  var ICONS = {
    people: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19.5c.6-3.4 2.8-5.3 5.5-5.3s4.9 1.9 5.5 5.3"/><circle cx="17" cy="9" r="2.5"/><path d="M15.8 14.3c2.4.2 4 1.9 4.7 5.2"/>',
    mosque: '<path d="M12 3.5c2.6 2 4.5 3.6 4.5 6.2H7.5c0-2.6 1.9-4.2 4.5-6.2z"/><path d="M6 20.5v-8.3h12v8.3"/><path d="M10 20.5v-3.3a2 2 0 0 1 4 0v3.3"/><path d="M3.5 20.5h17M3.8 20.5V9.8M3.8 9.8l.9-2.3.9 2.3M20.2 20.5V9.8M20.2 9.8l-.9-2.3-.9 2.3"/>',
    house: '<path d="M3.5 11 12 4l8.5 7"/><path d="M5.5 9.6v10.4h13V9.6"/><path d="M10 20v-5.5h4V20"/>',
    yen: '<path d="M7 4.5l5 7 5-7M12 11.5v8.5M8 13h8M8 16.5h8"/>',
    chart: '<path d="M4 20h16"/><rect x="5.5" y="11" width="3" height="7" rx=".6"/><rect x="10.5" y="7" width="3" height="11" rx=".6"/><rect x="15.5" y="13" width="3" height="5" rx=".6"/>',
    handshake: '<path d="M2.5 11.5 6 8l3 1 3-2 3 .5 3.5 3.5"/><path d="M6 8v6l5 4.5c.8.7 2 .7 2.7-.1l4.3-4.4"/><path d="M12 7l-3.2 3.3c-.6.6-.6 1.5 0 2.1.6.6 1.5.6 2.1 0L13 10.5"/>',
    comment: '<path d="M4.5 5.5h15v10h-8l-4.5 3.8v-3.8H4.5z"/><path d="M8 9.5h8M8 12.5h5"/>',
    pen: '<path d="M4.5 19.5l1-4.2L15.8 5a1.8 1.8 0 0 1 2.6 0l.6.6a1.8 1.8 0 0 1 0 2.6L8.7 18.5z"/><path d="M13.8 7l3.2 3.2M4.5 19.5h15"/>'
  };

  var P = {}; // 都道府県コード → { name }（region.js から受け取る）
  function pname(a) { return P[a.pref].name; }
  function pshort(a) { return a.pref === "01" ? "北海道" : P[a.pref].name.replace(/[都府県]$/, ""); }
  function aname(a) { return a.muni ? a.muni.name : pname(a); }

  var TOPICS = [
    {
      id: "zairyu", group: "now", icon: "people", title: "在留外国人", site: "数でみる在留外国人",
      top: GH + "zairyu/index.html",
      q: function (n) { return n ? n + "には外国人が何人住んでいる？" : "日本には外国人が何人住んでいる？"; },
      desc: function (n) { return (n ? n + "の" : "") + "国籍別の人数・在留資格・年ごとの推移を見る"; },
      url: function (a) {
        var base = GH + "zairyu/";
        if (!a.muni) return base + "pref-" + ROMA[+a.pref - 1] + ".html";
        return a.muni.seirei ? base + "city-" + encodeURIComponent(a.muni.name) + ".html" : base + "muni-" + a.muni.code.slice(0, 5) + ".html";
      },
      link: function (a) { return { href: this.url(a), scope: "exact", text: aname(a) + "のページが開きます" }; },
      resolve: function (a) {
        var prefURL = GH + "zairyu/pref-" + ROMA[+a.pref - 1] + ".html";
        return load.zairyu(this.url(a)).then(function (d) {
          if (d.missing) {
            return {
              href: prefURL, scope: "wider", text: pname(a) + "のページが開きます（" + a.muni.name + "のページはありません）",
              stat: { state: "unlisted", value: "統計に載っていません", note: "外国人住民がいない町村は、国の在留外国人統計の表に載りません（2017年12月末から）。" }
            };
          }
          if (typeof d.total !== "number") return {};
          var w = String(d.when || "").match(/(\d{4})-(\d{2})/);
          var top3 = (d.items || []).slice(0, 3).map(function (x) { return x[0]; }).join("・");
          return {
            stat: {
              value: num(d.total) + "<small>人</small>",
              sub: top3 ? "多い国籍：" + top3 : "",
              note: (w ? w[1] + "年" + (+w[2]) + "月末時点。" : "") + "出典：出入国在留管理庁「在留外国人統計」"
            }
          };
        });
      }
    },
    {
      id: "mosque", group: "now", icon: "mosque", title: "モスク", site: "日本のモスク情報",
      top: GH + "mosque-map/",
      q: function (n) { return n ? n + "にモスクはある？" : "日本のどこにモスクがある？"; },
      desc: function (n) { return (n ? n + "の" : "") + "モスクの場所・運営する団体・建設計画・墓地の情報を見る"; },
      link: function (a) {
        if (a.muni) {
          return {
            href: GH + "mosque-map/area.html?pref=" + encodeURIComponent(pname(a)) + "&city=" + encodeURIComponent(a.muni.name),
            scope: "exact", text: a.muni.name + "を選んだ状態で開きます"
          };
        }
        return { href: GH + "mosque-map/pref-" + ROMA[+a.pref - 1] + ".html", scope: "exact", text: pname(a) + "のページが開きます" };
      },
      resolve: function (a) {
        return load.mosque().then(function (M) {
          var c = {};
          M.rows.forEach(function (r) {
            if (r.pref === pname(a) && (!a.muni || r.city === a.muni.name)) c[r.kind] = (c[r.kind] || 0) + 1;
          });
          var main = c["モスク・礼拝所"] || 0;
          var others = ["計画・建設中", "墓地", "学校", "状況確認中"].filter(function (k) { return c[k]; })
            .map(function (k) { return k + " " + c[k]; }).join("・");
          var when = "サイトが調べた施設の一覧" + (M.updated ? "（" + jdate(M.updated) + "更新）" : "") + "で数えています。";
          if (!main && !others) {
            return { stat: { state: "zero", value: "0<small>か所</small>", note: "サイトが調べた範囲では見つかっていません。" + when } };
          }
          return { stat: { value: "モスク・礼拝所 " + num(main) + "<small>か所</small>", sub: others ? "ほかに " + others : "", note: when } };
        });
      }
    },
    {
      id: "minpaku", group: "now", icon: "house", title: "民泊・旅館業", site: "民泊・旅館業マップ",
      top: GH + "minpaku-map/",
      q: function (n) { return n ? n + "に民泊やホテルはどれだけある？" : "民泊やホテルは、どこに多い？"; },
      desc: function (n) { return (n ? n + "の" : "") + "民泊・特区民泊・旅館業の施設の場所と件数、増減を見る"; },
      // 対象の15都道府県かどうかはデータを読まないと分からないので、読むまではトップ
      link: function () { return { href: GH + "minpaku-map/", scope: "top", text: "トップページが開きます（対象地域かどうか確認できていません）", pending: true }; },
      resolve: function (a) {
        var base = GH + "minpaku-map/";
        return load.minpaku().then(function (D) {
          var pi = D.prefs.indexOf(pname(a));
          var when = "サイトの更新：" + jdate(D.updated) + "。";
          if (pi < 0) {
            return {
              href: base, scope: "top", text: "トップページが開きます（" + pname(a) + "は掲載対象外です）",
              stat: { state: "outside", value: pname(a) + "は対象外", note: "このサイトの対象は" + D.prefs.slice(0, 4).join("・") + "など" + D.prefs.length + "都道府県です。" }
            };
          }
          var cats = D.cats; // [民泊, 特区民泊, 旅館・ホテル, 簡易宿所]
          function line(n) {
            var parts = [];
            if (n[0]) parts.push(cats[0] + " " + num(n[0]));
            if (n[1]) parts.push(cats[1] + " " + num(n[1]));
            if (n[2] + n[3]) parts.push("旅館業 " + num(n[2] + n[3]));
            return parts.join("・");
          }
          function missingIn(src) {
            return src.some(function (i) { var s = D.sources[i]; return s && s.count === 0 && s.memo; });
          }
          var prefURL = base + "?pref=" + encodeURIComponent(pname(a)) + "#map-sec";
          if (a.muni) {
            var city = D.cities.find(function (c) {
              return c.pref === pi && (c.name === a.muni.name || c.name === a.muni.name + "（" + pname(a) + "）");
            });
            if (!city) {
              return {
                href: prefURL, scope: "wider", text: pname(a) + "の地図が開きます（" + a.muni.name + "の施設は載っていません）",
                stat: { state: "unlisted", value: "掲載なし", note: "0件とは限りません（一覧が公表されていない・まだ取り込んでいない場合があります）。" + when }
              };
            }
            var total = city.n.reduce(function (s, x) { return s + x; }, 0);
            var dates = city.src.map(function (i) { return D.sources[i] && D.sources[i].date; }).filter(Boolean).sort();
            var span = dates.length ? (dates[0] === dates[dates.length - 1] ? jdate(dates[0]) : jdate(dates[0]) + "〜" + jdate(dates[dates.length - 1])) : "";
            return {
              href: base + "?pref=" + encodeURIComponent(pname(a)) + "&city=" + encodeURIComponent(city.name) + "#map-sec",
              scope: "exact", text: a.muni.name + "を選んだ状態で開きます",
              stat: {
                value: num(total) + "<small>件</small>",
                sub: line(city.n),
                note: "自治体が公表した一覧の件数" + (span ? "（" + span + "時点）" : "") + "。" +
                  (missingIn(city.src) ? "取得できていない一覧があります（その分は含みません）。" : "")
              }
            };
          }
          var sum = [0, 0, 0, 0];
          var srcs = [];
          D.cities.forEach(function (c) {
            if (c.pref !== pi) return;
            c.n.forEach(function (x, i) { sum[i] += x; });
            srcs = srcs.concat(c.src);
          });
          return {
            href: prefURL, scope: "exact", text: pname(a) + "を選んだ状態で開きます",
            stat: {
              value: num(sum[0] + sum[1] + sum[2] + sum[3]) + "<small>件</small>",
              sub: line(sum),
              note: "県内の掲載分の合計（資料の日付は自治体ごとに異なります）。" +
                (missingIn(srcs) ? "取得できていない一覧の分は含みません。" : "") + when
            }
          };
        });
      }
    },
    {
      id: "tabunka", group: "gov", icon: "yen", title: "多文化共生予算", site: "全国 多文化共生予算マップ",
      top: GH + "tabunka-yosan/",
      q: function (n) { return n ? n + "は多文化共生にいくら使っている？" : "自治体は多文化共生にいくら使っている？"; },
      desc: function (n) { return (n ? n + "の" : "") + "予算額・事業の内容・使い道を、年度やほかの自治体と比べる"; },
      code: function (a) { return a.muni ? a.muni.code : prefCode6(a.pref); },
      link: function (a) { return { href: GH + "tabunka-yosan/#/m/" + this.code(a), scope: "exact", text: aname(a) + "のページが開きます" }; },
      resolve: function (a) {
        var code = this.code(a);
        return load.tabunka().then(function (S) {
          var rec = S.sum[code];
          var when = "（" + jdate(S.generated) + "集計）";
          if (!rec) return { stat: { state: "unconfirmed", value: "未調査", note: "まだ調べていません（0円ではありません）。調べた自治体から順に公開しています" + when + "。" } };
          var pick = null;
          Object.keys(rec).sort().reverse().some(function (fy) {
            return ["当初予算", "補正後予算", "決算"].some(function (st) {
              var x = rec[fy][st];
              if (x && x.a != null) { pick = { fy: fy, st: st, x: x }; return true; }
              return false;
            });
          });
          if (!pick) return { stat: { state: "unconfirmed", value: "金額を確認中", note: "事業は見つかっていますが、合計額はまだ確認できていません" + when + "。" } };
          return {
            stat: {
              value: yen(pick.x.a),
              note: pick.fy + "年度" + pick.st + "のうち、多文化共生に直接関係する事業の合計。" +
                (pick.x.st === "一部確認" ? "一部の事業だけ確認済み" : "確認済み") + when + "。"
            }
          };
        });
      }
    },
    {
      id: "karte", group: "gov", icon: "chart", title: "自治体カルテ", site: "自治体カルテ",
      top: "https://www.zititai-karte.com/",
      q: function (n) { return n ? n + "のお金と人口は、どうなっている？" : "自治体のお金と人口は、どうなっている？"; },
      desc: function (n) { return (n ? n + "の" : "") + "人口・出生、歳入と歳出の内訳を、ほかの自治体と比べる"; },
      link: function (a) {
        var base = "https://www.zititai-karte.com/";
        return a.muni
          ? { href: base + "m/" + a.muni.code, scope: "exact", text: a.muni.name + "のページ（最新年度の決算）が開きます" }
          : { href: base + "pref/" + prefCode6(a.pref), scope: "exact", text: pname(a) + "のページ（最新年度の決算）が開きます" };
      },
      none: "ほかの方が運営するサイトのため、数値はリンク先で確認してください。"
    },
    {
      id: "mou", group: "gov", icon: "handshake", title: "MOU・海外との協定", site: "日本と世界のMOU・協定マップ",
      top: GH + "mou-map/",
      q: function (n, a) {
        if (!n) return "国や自治体は、海外とどんな協定を結んでいる？";
        return (a.muni ? n + "や" + pname(a) : n) + "は、海外とどんな協定を結んでいる？";
      },
      desc: function () { return "相手の国・分野・取り決めの内容と、有効・終了・未確認の区分を見る"; },
      // 市区町村のページは、サイトが調べた政令指定都市20市だけ。データを読むまでは都道府県のページ
      link: function (a) {
        var href = GH + "mou-map/#/pref/" + a.pref;
        if (a.muni) return { href: href, scope: "wider", text: pname(a) + "のページが開きます（" + a.muni.name + "のページがあるか確認できていません）", pending: true };
        return { href: href, scope: "exact", text: pname(a) + "のページが開きます" };
      },
      resolve: function (a) {
        var base = GH + "mou-map/";
        return load.mou().then(function (S) {
          var L = S.labels || {};
          var SL = S.survey_labels || {};
          var when = jdate(S.generated) + "時点の判定（MOUのみ。同じ協定の更新は1件、報道のみの情報は除く）。";
          // 有効確認を大きく出し、有効性未確認・終了確認は必ず別に並べる（混ぜて合計しない）
          function stat(c, note) {
            if (!c || !c.mou) return { state: "unconfirmed", value: "未調査", note: "まだ調べていません（0件ではありません）。" };
            var m = c.mou;
            var sub = ["unconfirmed", "ended_confirmed", "signed_not_started", "planned"].filter(function (k) { return m[k] || k === "unconfirmed" || k === "ended_confirmed"; })
              .map(function (k) { return (L[k] || k) + " " + num(m[k]) + "件"; }).join("・");
            return {
              state: !m.signed_total && !m.planned ? "zero" : undefined,
              value: (L.valid_confirmed || "有効確認") + " " + num(m.valid_confirmed) + "<small>件</small>",
              sub: sub,
              note: note + when
            };
          }
          if (a.muni) {
            var cm = S.municipalities && S.municipalities[a.muni.code];
            if (!cm) {
              return {
                href: base + "#/pref/" + a.pref, scope: "wider", text: pname(a) + "のページが開きます（" + a.muni.name + "の協定はまだ調べていません）",
                stat: { state: "unconfirmed", value: "未調査", note: "市区町村の協定は、政令指定都市20市の外国人材・労働分野だけを調べています（0件ではありません）。" }
              };
            }
            return {
              href: base + "#/city/" + a.muni.code, scope: "exact", text: a.muni.name + "のページが開きます",
              stat: stat(cm.counts, "調査：" + (SL[cm.survey] || cm.survey) + "。")
            };
          }
          var cp = S.prefectures && S.prefectures[a.pref];
          if (!cp) return {};
          var other = cp.survey && cp.survey.other_fields;
          return {
            stat: stat(cp.counts, pname(a) + "が結んだ協定（県内の市区町村の分は除く）。" +
              (other === "partial" || other === "not_surveyed" ? "外国人材以外の分野は" + SL[other] + "。" : ""))
          };
        });
      }
    },
    {
      id: "pubcome", group: "voice", icon: "comment", title: "パブリックコメント", site: "パブコメ掲示板",
      top: GH + "pubcome/",
      q: function (n, a) {
        if (!n) return "国や自治体は今、どんな意見を募集中？";
        return (a.muni ? n + "・" + pname(a) : n) + "では今、どんな意見を募集中？";
      },
      desc: function () { return "募集中の案件を締切が近い順に見て、公式の提出先へ進む"; },
      // 市区町村は105市区だけ。対象かどうかはデータを読まないと分からないので、読むまでは都道府県のページ
      link: function (a) {
        var href = GH + "pubcome/pref/?pref=" + encodeURIComponent(pname(a));
        if (a.muni) return { href: href, scope: "wider", text: pname(a) + "の募集が開きます（" + a.muni.name + "が収集対象か確認できていません）", pending: true };
        return { href: href, scope: "exact", text: pname(a) + "の募集が開きます" };
      },
      resolve: function (a) {
        var base = GH + "pubcome/";
        var t = today();
        // 募集中＝締切日が今日以降のもの（締切を過ぎた案件は数えない）
        function open(items, test) {
          var list = items.filter(function (i) { return i.dl && i.dl >= t && test(i); }).map(function (i) { return i.dl; }).sort();
          return { n: list.length, next: list[0] || "" };
        }
        var national = load.pubCounts().then(function (C) {
          var n = 0;
          Object.keys(C.counts.national).forEach(function (d) { if (d >= t) n += C.counts.national[d]; });
          return n;
        }, function () { return null; });
        var pn = pname(a);
        return Promise.all([load.pubPref(), a.muni ? load.pubCity() : null, national]).then(function (r) {
          var PD = r[0], CD = r[1], nat = r[2];
          var po = PD.officials.find(function (o) { return o.name === pn; });
          var pc = open(PD.items, function (i) { return i.body === pn; });
          var when = "集計：" + jdate(PD.updated) + "（毎朝更新）。";
          var natTxt = nat == null ? "" : "国 " + num(nat) + "件";
          var prefTxt = po && po.error ? pn + "（今日は取得できず）" : pn + " " + num(pc.n) + "件";
          if (a.muni) {
            var co = CD.officials.find(function (o) { return o.name === a.muni.name && o.pref === pn; });
            if (!co) {
              return {
                href: base + "pref/?pref=" + encodeURIComponent(pn), scope: "wider",
                text: pn + "の募集が開きます（" + a.muni.name + "は収集の対象外です）",
                stat: {
                  state: "outside", value: a.muni.name + "は対象外",
                  sub: "募集中：" + [prefTxt, natTxt].filter(Boolean).join("・"),
                  note: "市区町村は政令市・中核市・東京23区の105市区だけを集めています。" + when
                }
              };
            }
            var res = {
              href: base + "city/?pref=" + encodeURIComponent(pn) + "&city=" + encodeURIComponent(a.muni.name),
              scope: "exact", text: a.muni.name + "の募集が開きます"
            };
            if (co.error) {
              res.stat = { state: "error", value: "今日は取得できず", note: "パブコメ掲示板が今日の" + a.muni.name + "の取得に失敗しました（0件とは限りません）。" + when };
              return res;
            }
            var cc = open(CD.items, function (i) { return i.body === a.muni.name && i.area === pn; });
            res.stat = {
              state: cc.n ? undefined : "zero",
              value: "募集中 " + num(cc.n) + "<small>件</small>",
              sub: "ほかに " + [prefTxt, natTxt].filter(Boolean).join("・"),
              note: (cc.next ? "いちばん近い締切：" + mdate(cc.next) + "。" : "") + "締切を過ぎた案件は数えません。" + when
            };
            return res;
          }
          if (po && po.error) {
            return { stat: { state: "error", value: "今日は取得できず", note: "パブコメ掲示板が今日の" + pn + "の取得に失敗しました（0件とは限りません）。" + when } };
          }
          return {
            stat: {
              state: pc.n ? undefined : "zero",
              value: "募集中 " + num(pc.n) + "<small>件</small>",
              sub: natTxt ? "ほかに " + natTxt : "",
              note: (pc.next ? "いちばん近い締切：" + mdate(pc.next) + "。" : "") + "締切を過ぎた案件は数えません。" + when
            }
          };
        });
      }
    },
    {
      id: "shomei", group: "voice", icon: "pen", title: "署名活動", site: "署名掲示板",
      top: GH + "shomei/",
      q: function (n, a) { return n ? pname(a) + "に関係する署名はある？" : "全国で、どんな署名が集まっている？"; },
      desc: function (n, a) { return n ? pname(a) + "に関係する署名と、全国向けの署名を見る" : "活動の内容・提出先・署名の数を見て、署名ページへ進む"; },
      // 署名は都道府県ごとにだけ分けている。0件の県も「0件です」と表示される
      link: function (a) {
        var href = GH + "shomei/?pref=" + encodeURIComponent(pshort(a)) + "#results";
        return a.muni
          ? { href: href, scope: "wider", text: pname(a) + "の署名が開きます（市区町村ごとの分類はありません）" }
          : { href: href, scope: "exact", text: pname(a) + "の署名が開きます" };
      },
      resolve: function (a) {
        return load.shomei().then(function (D) {
          var t = today();
          var live = D.items.filter(function (i) { return !i.end || i.end >= t; });
          var none = live.filter(function (i) { return !i.pref; }).length;
          var n = live.filter(function (i) { return i.pref === pshort(a); }).length;
          return {
            stat: {
              state: n ? undefined : "zero",
              value: pname(a) + "に関係 " + num(n) + "<small>件</small>",
              sub: "地域の書かれていない署名（全国向けなど）" + num(none) + "件",
              note: jdate(D.updated) + "時点で掲載中の署名（地域はタイトルと提出先から判定）。"
            }
          };
        });
      }
    }
  ];

  // ---------- カードを描く ----------
  var EXT = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M14 4.5h5.5V10"/><path d="M19.5 4.5 11 13"/><path d="M17.5 14v4.5a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1H10"/></svg>';

  function cardHTML(t, a) {
    var n = a ? aname(a) : "";
    return (
      '<li class="topic" id="topic-' + t.id + '">' +
        '<div class="topic-head">' +
          '<span class="topic-icon"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + ICONS[t.icon] + "</svg></span>" +
          '<div><h4 class="topic-title">' + esc(t.title) + "</h4>" +
          '<p class="topic-site">' + esc(t.site) + "</p></div>" +
        "</div>" +
        '<div class="topic-about"><p class="topic-q">' + esc(t.q(n, a)) + '</p><p class="topic-desc">' + esc(t.desc(n, a)) + "</p></div>" +
        '<div class="topic-value" aria-live="polite"></div>' +
        '<p class="topic-note"></p>' +
        '<p class="topic-scope"></p>' +
        '<div class="topic-foot"><a class="btn-topic" href="' + esc(t.top) + '" target="_blank" rel="noopener noreferrer">詳しく調べる' + EXT +
          '<span class="sr-only">（' + esc(t.site) + "が新しいタブで開きます）</span></a></div>" +
      "</li>"
    );
  }
  function setLink(li, r) {
    var s = SCOPE[r.pending ? "pending" : r.scope];
    var scope = li.querySelector(".topic-scope");
    scope.className = "topic-scope is-" + (r.pending ? "pending" : r.scope);
    scope.innerHTML =
      '<span class="scope-tag"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + s.icon + "</svg>" + s.tag + "</span>" +
      '<span class="scope-text">' + esc(r.pending ? "確認しています…" : r.text) + "</span>";
    li.querySelector(".btn-topic").href = r.href;
  }
  function setStat(li, st, empty) {
    var v = li.querySelector(".topic-value");
    var note = li.querySelector(".topic-note");
    v.className = "topic-value" + (st && st.state ? " is-" + st.state : "") + (st ? "" : " is-empty");
    if (!st) {
      v.innerHTML = '<span class="topic-value-empty">' + esc(empty) + "</span>";
      note.textContent = "";
      return;
    }
    v.innerHTML = (st.state ? '<span class="state-tag">' + STATE[st.state] + "</span>" : "") + '<span class="topic-value-main">' + st.value + "</span>" +
      (st.sub ? '<span class="topic-value-sub">' + esc(st.sub) + "</span>" : "");
    note.textContent = st.note || "";
  }

  var token = 0;
  window.RegionCards = {
    // prefByCode：都道府県コード → { name }
    init: function (box, prefByCode) { P = prefByCode; return { box: box }; },
    render: function (c, a) {
      var my = ++token;
      c.box.innerHTML = GROUPS.map(function (g) {
        return '<section class="topic-group" aria-labelledby="tg-' + g.id + '">' +
          '<h3 class="topic-group-title" id="tg-' + g.id + '"><span class="tg-mark" aria-hidden="true">' + g.mark + "</span>" + esc(g.title) + "</h3>" +
          '<ul class="topic-cards">' +
          TOPICS.filter(function (t) { return t.group === g.id; }).map(function (t) { return cardHTML(t, a); }).join("") +
          "</ul></section>";
      }).join("");
      TOPICS.forEach(function (t) {
        var li = document.getElementById("topic-" + t.id);
        if (!a) {
          // 地域を選ぶまでは、データを読まずに各サイトのトップを案内する（ページを軽くするため）
          setLink(li, { href: t.top, scope: "all", text: "全国のページが開きます" });
          setStat(li, null, "地域を選ぶと、その地域の数が出ます");
          return;
        }
        var base = t.link(a);
        setLink(li, base);
        if (!t.resolve) {
          setStat(li, null, t.none || "数値はリンク先で確認してください。");
          return;
        }
        li.querySelector(".topic-value").innerHTML = '<span class="topic-value-loading">読み込み中…</span>';
        t.resolve(a).then(function (r) {
          if (my !== token) return;
          setLink(li, r.href ? { href: r.href, scope: r.scope, text: r.text } : { href: base.href, scope: base.scope, text: base.text });
          setStat(li, r.stat || null, "数値はリンク先で確認してください。");
        }, function () {
          if (my !== token) return;
          // 読めなかったとき：数値は出さず「取得失敗」と書く。リンクはデータに頼らない形のまま残す
          setLink(li, { href: base.href, scope: base.scope, text: base.text });
          setStat(li, { state: "error", value: "読み込めませんでした", note: "時間をおいて、ページを読み込み直してください（0件という意味ではありません）。" });
        });
      });
    }
  };
})();
