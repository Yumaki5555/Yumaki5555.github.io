// 「地域から調べる」のカード（地域の8分野＋全国共通の2サイト）
// それぞれのカードは、選んだ地域を専門サイトへ引き継ぐリンクと、取れるときだけ代表的な数値を出します。
// 全国共通の2サイト（政策ログJP・世界の感染症と日本の水際対策）は地域を引き継がず、数値も出しません（「全国共通」と表示）。
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
  // 初心者向けの解説（「まず3分で知る」「図で知る」の補助リンク）。2026年10月29日に、開いて該当の解説が出ることを確認したものだけ
  var GUIDE = {
    zairyu: "https://nihon-kurashi-zairyu-guide.sunlitmole256.chatgpt.site/#region",  // 図で見る、日本に住む外国人「地域を比べる」
    mosque: "https://mosque-info-explorer.sunlitmole256.chatgpt.site/",               // 日本のモスクを知る（region.html?pref=県名 で県の要約）
    tabunka: GH + "tabunka-yosan/#/guide",                                             // 3分でわかる 多文化共生予算
    mou: GH + "mou-map/#/guide",                                                       // 3分でわかるMOU
    kansensho: GH + "kansensho/#sanpun-tb"                                             // まず3分でわかる（結核編。HIV/エイズ編へも切りかえられる）
  };
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
    nation: { tag: "全国共通", icon: '<circle cx="12" cy="12" r="7.5"/><path d="M4.5 12h15M12 4.5c2.2 2.2 2.2 12.8 0 15M12 4.5c-2.2 2.2-2.2 12.8 0 15"/>' },
    pending: { tag: "確認中", icon: '<circle cx="12" cy="12" r="1.2"/><circle cx="7" cy="12" r="1.2"/><circle cx="17" cy="12" r="1.2"/>' }
  };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function num(n) { return Number(n).toLocaleString("ja-JP"); }
  function signed(n) { return (n > 0 ? "+" : n < 0 ? "−" : "±") + num(Math.abs(n)); }
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
            // 国籍の内わけ（合計人数と時点）と、人数の移り変わり（前年との比較に使う）だけを取り出す
            var re = /<script type="application\/json">([\s\S]*?)<\/script>/g, m, nat = null, trend = null;
            while ((m = re.exec(html))) {
              try {
                var d = JSON.parse(m[1]);
                if (d && d.dim === "nat" && typeof d.total === "number" && !nat) nat = d;
                else if (d && d.per && d.vals && !trend) trend = d;
              } catch (e) { /* ほかのデータは使わない */ }
            }
            if (!nat) return {};
            nat.trend = trend;
            return nat;
          });
        });
      });
    }
  };

  // ---------- 8つのカード ----------
  // icon   … アイコンの形（brand-icons.js の名前。リンク先のファビコンと同じ形）
  // q      … 地域名を入れた1行の問いかけ（n＝選んだ地域の名前、a＝選んだ地域）
  // see    … そのサイトで見られることを短く（文字列、または n・a を受け取る関数）
  // link(a)  … データを読まずに決められるリンク { href, scope, text }
  // resolve(a) … データを読んで { stat, href?, scope?, text? } を返す（なければ数値は出さない）
  //   stat … { value: 大きく出す文, extra: 数値の意味が分かる補足を1行（同じ条件で比べられるときだけ。なくてもよい）,
  //            sub: 数値の内わけ（なくてもよい）, note: 集計時点・対象範囲, state: STATE のどれか（ふつうの数値ならなし） }
  // guide(a) … 「まず3分で知る」「図で知る」の補助リンク { label, href, site }（実際にある解説だけ。なくてもよい）
  var GROUPS = [
    { id: "now", mark: "A", title: "地域の現状を知る" },
    { id: "gov", mark: "B", title: "行政の動きを調べる" },
    { id: "voice", mark: "C", title: "声を届ける・参加する", lead: "パブコメは国や自治体の案に意見を出すしくみ、署名は活動の趣旨に賛同する意思を示すものです。" },
    // 地域では分けられない、国全体・世界の情報（地域を選んでも中身は変わらない）
    { id: "nation", mark: "D", title: "全国共通の情報も調べる", lead: "国全体・世界の情報です。どの地域を選んでも、同じページが開きます。" }
  ];

  var P = {}; // 都道府県コード → { name }（region.js から受け取る）
  function pname(a) { return P[a.pref].name; }
  function pshort(a) { return a.pref === "01" ? "北海道" : P[a.pref].name.replace(/[都府県]$/, ""); }
  function aname(a) { return a.muni ? a.muni.name : pname(a); }

  var TOPICS = [
    {
      id: "zairyu", group: "now", icon: "zairyu", title: "在留外国人", site: "数でみる在留外国人",
      top: GH + "zairyu/index.html",
      q: function (n) { return n ? n + "には外国人が何人住んでいる？" : "日本には外国人が何人住んでいる？"; },
      see: "国籍・在留資格（日本に住むための資格）・推移を見る",
      guide: function () { return { label: "図で知る", site: "図で見る、日本に住む外国人", href: GUIDE.zairyu }; },
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
          // 前年の同じ時点（12月末なら前年12月末）との差。サイトの推移データに両方の時点があり、
          // 今の人数が推移データの値と一致するとき（同じ統計の同じ数え方）だけ出す
          var extra = "";
          var tr = d.trend;
          if (w && tr) {
            var i = tr.per.indexOf(d.when), j = tr.per.indexOf((+w[1] - 1) + "-" + w[2]);
            if (i >= 0 && j >= 0 && tr.vals[i] === d.total && tr.vals[j] > 0) {
              var diff = d.total - tr.vals[j];
              var pct = Math.round(diff / tr.vals[j] * 1000) / 10;
              extra = "1年前（" + (+w[1] - 1) + "年" + (+w[2]) + "月末）から " + signed(diff) + "人（" +
                (pct > 0 ? "+" : pct < 0 ? "−" : "±") + Math.abs(pct).toFixed(1) + "%）";
            }
          }
          return {
            stat: {
              value: num(d.total) + "<small>人</small>",
              extra: extra,
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
      see: "施設の数・建設計画・墓地の情報を見る",
      guide: function (a) {
        return { label: "図で知る", site: "日本のモスクを知る", href: a ? GUIDE.mosque + "region.html?pref=" + encodeURIComponent(pname(a)) : GUIDE.mosque };
      },
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
      id: "minpaku", group: "now", icon: "minpaku", title: "民泊・旅館業", site: "民泊・旅館業マップ",
      top: GH + "minpaku-map/",
      q: function (n) { return n ? n + "に民泊やホテルはどれだけある？" : "民泊やホテルは、どこに多い？"; },
      see: "民泊・特区民泊・旅館業の件数と増減を見る",
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
          // 前回比：対象のすべての資料に「同じ資料の前の版」があり、取得できていない資料がないときだけ合計する
          // （新しく加えた県の資料は前の版がないので出さない。県全体の一覧から分けた市町村も、市町村ごとの差が分からないので出さない）
          function compare(list, ownOnly) {
            if (!list.length) return "";
            var total = 0, prev = {}, now = {};
            for (var k = 0; k < list.length; k++) {
              var s = list[k];
              if (!s || typeof s.diff !== "number" || !s.prev || (s.count === 0 && s.memo) || (ownOnly && s.muni !== ownOnly)) return "";
              total += s.diff; prev[s.prev] = 1; now[s.date] = 1;
            }
            var p = Object.keys(prev), n = Object.keys(now);
            var span = p.length === 1 && n.length === 1
              ? "（" + mdate(p[0].replace(/\//g, "-")) + "→" + mdate(n[0].replace(/\//g, "-")) + "の資料）"
              : "（資料ごとに前の版と比べた差）";
            return "前回の資料から " + (total ? signed(total) + "件" : "増減なし") + span;
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
                extra: compare(city.src.map(function (i) { return D.sources[i]; }), city.name),
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
              extra: compare(D.sources.filter(function (s) { return s.pref === pi; })),
              sub: line(sum),
              note: "県内の掲載分の合計（資料の日付は自治体ごとに異なります）。" +
                (missingIn(srcs) ? "取得できていない一覧の分は含みません。" : "") + when
            }
          };
        });
      }
    },
    {
      id: "tabunka", group: "gov", icon: "tabunka", title: "多文化共生予算", site: "全国 多文化共生予算マップ",
      top: GH + "tabunka-yosan/",
      q: function (n) { return n ? n + "は多文化共生にいくら使っている？" : "自治体は多文化共生にいくら使っている？"; },
      see: "日本語学習や相談、学校支援など、外国人に関係する事業の予算を見る",
      guide: function () { return { label: "まず3分で知る", site: "3分でわかる 多文化共生予算", href: GUIDE.tabunka }; },
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
          // いちばん大きい使い道：使い道ごとの金額の合計が全体と一致し、「その他」以外がいちばん大きいときだけ
          var extra = "";
          var f = pick.x.f || {};
          var keys = Object.keys(f);
          var fsum = keys.reduce(function (t, k) { return t + f[k]; }, 0);
          if (keys.length && pick.x.a > 0 && fsum === pick.x.a) {
            var top = keys.sort(function (x, y) { return f[y] - f[x]; })[0];
            if (top !== "その他" && f[top] > 0) extra = "いちばん大きい使い道：" + top + "（" + Math.round(f[top] / pick.x.a * 100) + "%）";
          }
          return {
            stat: {
              value: yen(pick.x.a),
              extra: extra,
              // 予算（当初・補正後）と決算を取りちがえないよう、どれの合計かを必ず書く。関連予算をすべて把握したようには書かない
              note: pick.fy + "年度" + pick.st + "のうち、公式資料で確認できた関連事業の合計" +
                (pick.x.st === "一部確認" ? "（一部の事業のみ確認）" : "") + "。" + jdate(S.generated) + "集計。"
            }
          };
        });
      }
    },
    {
      id: "karte", group: "gov", icon: "karte", title: "自治体カルテ", site: "自治体カルテ",
      top: "https://www.zititai-karte.com/",
      q: function (n) { return n ? n + "のお金と人口は、どうなっている？" : "自治体のお金と人口は、どうなっている？"; },
      see: "歳入・歳出の内訳と人口をほかの自治体と比べる",
      link: function (a) {
        var base = "https://www.zititai-karte.com/";
        return a.muni
          ? { href: base + "m/" + a.muni.code, scope: "exact", text: a.muni.name + "のページ（最新年度の決算）が開きます" }
          : { href: base + "pref/" + prefCode6(a.pref), scope: "exact", text: pname(a) + "のページ（最新年度の決算）が開きます" };
      },
      none: "ほかの方が運営するサイトのため、数値はリンク先で確認してください。"
    },
    {
      id: "mou", group: "gov", icon: "mou", title: "MOU・海外との協定", site: "日本と世界のMOU・協定マップ",
      top: GH + "mou-map/",
      q: function (n, a) {
        if (!n) return "国や自治体は、海外とどんな協定を結んでいる？";
        return (a.muni ? n + "や" + pname(a) : n) + "は、海外とどんな協定を結んでいる？";
      },
      see: "相手国・分野と、有効・終了・未確認の区分を見る",
      guide: function () { return { label: "まず3分で知る", site: "3分でわかるMOU", href: GUIDE.mou }; },
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
      id: "pubcome", group: "voice", icon: "pubcome", title: "パブリックコメント", site: "パブコメ掲示板",
      top: GH + "pubcome/",
      q: function (n, a) {
        if (!n) return "国や自治体は今、どんな意見を募集中？";
        return (a.muni ? n + "・" + pname(a) : n) + "では今、どんな意見を募集中？";
      },
      see: "国や自治体の案に意見を出せる案件を、締切が近い順に見る",
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
          var list = items.filter(function (i) { return i.dl && i.dl >= t && test(i); })
            .sort(function (x, y) { return x.dl < y.dl ? -1 : x.dl > y.dl ? 1 : 0; });
          return { n: list.length, next: list[0] || null };
        }
        // いちばん近い締切と、その案件の短い名前（パブコメ掲示板が付けた分かりやすい名前）
        function nextLine(o) {
          if (!o.next) return "";
          var name = String(o.next.t || "");
          if (name.length > 22) name = name.slice(0, 21) + "…";
          return "いちばん近い締切：" + mdate(o.next.dl) + (name ? "「" + name + "」" : "");
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
          // 「大阪府の募集」＝府そのものの意見募集（府内の市区町村の分は含まない）
          var natTxt = nat == null ? "" : "国の募集 " + num(nat) + "件";
          var prefTxt = po && po.error ? pn + "の募集（今日は取得できず）" : pn + "の募集 " + num(pc.n) + "件";
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
              extra: nextLine(cc),
              sub: "ほかに " + [prefTxt, natTxt].filter(Boolean).join("・"),
              note: "締切を過ぎた案件は数えません。" + when
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
              extra: nextLine(pc),
              sub: natTxt ? "ほかに " + natTxt : "",
              note: "締切を過ぎた案件は数えません。" + when
            }
          };
        });
      }
    },
    {
      id: "shomei", group: "voice", icon: "shomei", title: "署名活動", site: "署名掲示板",
      top: GH + "shomei/",
      q: function (n, a) { return n ? pname(a) + "に関係する署名はある？" : "全国で、どんな署名が集まっている？"; },
      see: function (n) { return "活動の趣旨を読み、賛同する署名を探す" + (n ? "（地域に関係するもの・全国向け）" : ""); },
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
    },
    // ---------- 全国共通（地域を引き継がない。地域ごとの数値も出さない） ----------
    {
      id: "policy", group: "nation", nation: true, icon: "policy", title: "国の政策・法案", site: "政策ログJP",
      top: "https://policy-log.jp/",
      q: function () { return "国では今、どんな政策や法案が進んでいる？"; },
      see: "政策・法案の検討・審議・成立の状況を見る",
      credit: "運営：Policy-log.jpさん（ほかの方のサイトです）"
    },
    {
      id: "kansensho", group: "nation", nation: true, icon: "kansensho", title: "感染症と水際対策", site: "世界の感染症と日本の水際対策",
      top: GH + "kansensho/",
      q: function () { return "世界では、どんな感染症が広がっている？"; },
      see: "国別データ・入国時の検査・治療費の負担を見る",
      guide: function () { return { label: "まず3分で知る", site: "まず3分でわかる（結核編・HIV/エイズ編）", href: GUIDE.kansensho }; },
    }
  ];

  // ---------- カードを描く ----------
  var EXT = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M14 4.5h5.5V10"/><path d="M19.5 4.5 11 13"/><path d="M17.5 14v4.5a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1H10"/></svg>';

  // カードは「アイコンと分野名 → 1行の問いかけ → 数値 → 要点（見られること・開くページ・時点） → 詳しく調べる」の5段
  function cardHTML(t, a) {
    var n = a ? aname(a) : "";
    var see = typeof t.see === "function" ? t.see(n, a) : t.see;
    return (
      '<li class="topic" id="topic-' + t.id + '">' +
        '<div class="topic-head">' +
          (window.brandIcon ? window.brandIcon(t.icon) : "") +
          '<div><h4 class="topic-title">' + esc(t.title) + "</h4>" +
          '<p class="topic-site">' + esc(t.site) + "</p></div>" +
        "</div>" +
        '<p class="topic-q">' + esc(t.q(n, a)) + "</p>" +
        '<div class="topic-value" aria-live="polite"></div>' +
        '<ul class="topic-points">' +
          '<li class="topic-see">' + esc(see) + "</li>" +
          '<li class="topic-scope"></li>' +
          '<li class="topic-note"></li>' +
        "</ul>" +
        '<div class="topic-foot">' + guideHTML(t, a) +
          '<a class="btn-topic" href="' + esc(t.top) + '" target="_blank" rel="noopener noreferrer">詳しく調べる' + EXT +
          '<span class="sr-only">（' + esc(t.site) + "が新しいタブで開きます）</span></a></div>" +
      "</li>"
    );
  }
  function guideHTML(t, a) {
    var g = t.guide && t.guide(a);
    if (!g) return "";
    return '<a class="topic-guide" href="' + esc(g.href) + '" target="_blank" rel="noopener noreferrer">' +
      esc(g.label) + "：" + esc(g.site) + EXT + '<span class="sr-only">（新しいタブで開きます）</span></a>';
  }
  // 開くページ：記号と色に、短い1文を添える（「地域を引き継ぎ」などの区分名は、読み上げとマウスを重ねたときに出す）
  function setLink(li, r) {
    var s = SCOPE[r.pending ? "pending" : r.scope];
    var scope = li.querySelector(".topic-scope");
    scope.className = "topic-scope is-" + (r.pending ? "pending" : r.scope);
    scope.title = s.tag;
    scope.innerHTML =
      '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + s.icon + "</svg>" +
      '<span><span class="sr-only">' + esc(s.tag) + "：</span>" + esc(r.pending ? "開くページを確認しています…" : r.text) + "</span>";
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
      (st.extra ? '<span class="topic-value-extra">' + esc(st.extra) + "</span>" : "") +
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
        return '<section class="topic-group topic-group-' + g.id + '" aria-labelledby="tg-' + g.id + '">' +
          '<h3 class="topic-group-title" id="tg-' + g.id + '"><span class="tg-mark" aria-hidden="true">' + g.mark + "</span>" + esc(g.title) + "</h3>" +
          (g.lead ? '<p class="topic-group-lead">' + esc(g.lead) + "</p>" : "") +
          '<ul class="topic-cards">' +
          TOPICS.filter(function (t) { return t.group === g.id; }).map(function (t) { return cardHTML(t, a); }).join("") +
          "</ul></section>";
      }).join("");
      TOPICS.forEach(function (t) {
        var li = document.getElementById("topic-" + t.id);
        if (t.nation) {
          // 全国共通：地域を選んでも同じページ。地域ごとの数値は作らない
          setLink(li, { href: t.top, scope: "nation", text: "サイトのトップページが開きます（地域は引き継ぎません）" });
          setStat(li, null, "地域ごとの数値はありません（国全体・世界の情報です）");
          li.querySelector(".topic-note").textContent = t.credit || "";
          return;
        }
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
