// 「地域から調べる」の8つのカード
// それぞれのカードは、選んだ地域を専門サイトへ引き継ぐリンクと、取れるときだけ代表的な数値を出します。
//
// 地域の引き継ぎは、各サイトに「実際にある」URLの形だけを使います（2026年10月28日に各サイトのコードで確認）。
//   exact … 選んだ地域（市区町村 or 都道府県）のページが開く
//   wider … 選んだ市区町村は引き継げず、都道府県のページが開く
//   top   … 地域は引き継がれず、サイトのトップが開く
// 掲載がない・調べていない地域を「0件」と書かないように、状態を分けて表示します：
//   データ掲載あり ／ 調査・掲載対象外 ／ データ未確認 ／ 確認済みで該当0件
//
// 数値は、選んだ地域があるときだけ、各サイトが公開しているデータを読みます（1回読んだら使い回す）。
(function () {
  "use strict";

  var GH = "https://yumaki5555.github.io/";

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
    if (a == null) return "";
    var man = a / 10000;
    if (man >= 10000) {
      var oku = Math.floor(man / 10000);
      var rest = man - oku * 10000;
      return oku + "億" + (rest >= 0.05 ? rest.toLocaleString("ja-JP", { maximumFractionDigits: 1 }) + "万" : "") + "円";
    }
    return man.toLocaleString("ja-JP", { maximumFractionDigits: 1 }) + "万円";
  }
  function today() {
    var d = new Date(Date.now() + 9 * 3600 * 1000);
    return d.toISOString().slice(0, 10);
  }
  // 都道府県の6けたコード（団体コード＋検査数字）。例：13 → 130001
  function prefCode6(p) {
    var s = (+p[0]) * 6 + (+p[1]) * 5;
    return p + "000" + ((11 - (s % 11)) % 10);
  }

  // ---------- データの読み込み（1回だけ） ----------
  var cache = {};
  function once(key, fn) {
    if (!cache[key]) cache[key] = fn().catch(function (e) { delete cache[key]; throw e; });
    return cache[key];
  }
  function getJSON(url) {
    return fetch(url).then(function (r) { if (!r.ok) throw new Error(r.status + " " + url); return r.json(); });
  }
  // ページの中に埋め込まれたデータ（<script type="application/json" id="…">）を読む
  function getEmbedded(url, id) {
    return fetch(url).then(function (r) { if (!r.ok) throw new Error(r.status + " " + url); return r.text(); })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, "text/html");
        var el = doc.getElementById(id);
        if (!el) throw new Error("no data " + url);
        return JSON.parse(el.textContent);
      });
  }

  var load = {
    minpaku: function () { return once("minpaku", function () { return getEmbedded(GH + "minpaku-map/", "site-data"); }); },
    tabunka: function () { return once("tabunka", function () { return getJSON(GH + "tabunka-yosan/data/dist/summary.json"); }); },
    pubPref: function () { return once("pubPref", function () { return getEmbedded(GH + "pubcome/pref/", "data"); }); },
    pubCity: function () { return once("pubCity", function () { return getEmbedded(GH + "pubcome/city/", "data"); }); },
    pubCounts: function () { return once("pubCounts", function () { return getJSON(GH + "pubcome/counts.json"); }); },
    shomei: function () { return once("shomei", function () { return getEmbedded(GH + "shomei/", "data"); }); },
    mou: function () { return once("mou", function () { return getJSON(GH + "mou-map/data/build/summary.json"); }); },
    mosque: function () {
      return once("mosque", function () {
        return fetch(GH + "mosque-map/mosque_locations.csv").then(function (r) {
          if (!r.ok) throw new Error(r.status);
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
    }
  };
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

  // 都道府県のローマ字（数でみる在留外国人・日本のモスク情報のページ名。01 北海道 〜 47 沖縄県の順）
  var ROMA = ["hokkaido", "aomori", "iwate", "miyagi", "akita", "yamagata", "fukushima", "ibaraki", "tochigi", "gunma",
    "saitama", "chiba", "tokyo", "kanagawa", "niigata", "toyama", "ishikawa", "fukui", "yamanashi", "nagano", "gifu",
    "shizuoka", "aichi", "mie", "shiga", "kyoto", "osaka", "hyogo", "nara", "wakayama", "tottori", "shimane", "okayama",
    "hiroshima", "yamaguchi", "tokushima", "kagawa", "ehime", "kochi", "fukuoka", "saga", "nagasaki", "kumamoto", "oita",
    "miyazaki", "kagoshima", "okinawa"];

  // ---------- 表示の部品 ----------
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
  var EXT = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M14 4.5h5.5V10"/><path d="M19.5 4.5 11 13"/><path d="M17.5 14v4.5a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1H10"/></svg>';
  var SCOPE_ICON = {
    exact: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    wider: '<path d="M12 5v9M12 18.5v.5"/>',
    top: '<path d="M6 12h12"/>'
  };

  // ---------- 8つのカード ----------
  // name … 選んだ地域の名前（市区町村があれば市区町村、なければ都道府県、なければ「全国」）
  // resolve(a, env) … { href, scope, scopeText, stat } を返す（Promise でもよい）
  //   stat … { value: 大きく出す文, note: 時点・出典・範囲 }。数値が出せないときは null
  var GROUPS = [
    { id: "now", mark: "A", title: "地域の現状を知る" },
    { id: "gov", mark: "B", title: "行政の動きを調べる" },
    { id: "voice", mark: "C", title: "声を届ける・参加する" }
  ];

  var TOPICS = [
    {
      id: "zairyu", group: "now", icon: "people", title: "在留外国人", site: "数でみる在留外国人",
      q: function (n) { return n === "全国" ? "日本に住む外国人は何人？" : n + "の外国人住民は何人？"; },
      desc: "国籍別の人数・在留資格・年ごとの推移を調べる",
      btn: "詳しく調べる",
      resolve: function (a, env) { return env.zairyu(a); }
    },
    {
      id: "mosque", group: "now", icon: "mosque", title: "モスク", site: "日本のモスク情報",
      q: function (n) { return n === "全国" ? "モスクはどこにある？" : n + "にモスクはある？"; },
      desc: "所在地・運営する団体・建設計画・葬儀や墓地の情報を調べる",
      btn: "詳しく調べる",
      resolve: function (a, env) { return env.mosque(a); }
    },
    {
      id: "minpaku", group: "now", icon: "house", title: "民泊・旅館業", site: "民泊・旅館業マップ",
      q: function (n) { return n === "全国" ? "民泊やホテルはどこに多い？" : n + "に民泊やホテルはどれだけある？"; },
      desc: "民泊・特区民泊・旅館業の施設の場所と件数、増減を調べる",
      btn: "詳しく調べる",
      resolve: function (a, env) { return env.minpaku(a); }
    },
    {
      id: "tabunka", group: "gov", icon: "yen", title: "多文化共生予算", site: "全国 多文化共生予算マップ",
      q: function (n) { return n === "全国" ? "自治体は多文化共生にいくら使っている？" : n + "は多文化共生にいくら使っている？"; },
      desc: "予算額・事業の内容・使い道を、年度やほかの自治体と比べる",
      btn: "詳しく調べる",
      resolve: function (a, env) { return env.tabunka(a); }
    },
    {
      id: "karte", group: "gov", icon: "chart", title: "自治体カルテ", site: "自治体カルテ",
      q: function (n) { return n === "全国" ? "自治体のお金と人口は、どうなっている？" : n + "のお金と人口は、どうなっている？"; },
      desc: "人口・出生、歳入と歳出の内訳を、ほかの自治体と比べる",
      btn: "詳しく調べる",
      resolve: function (a, env) { return env.karte(a); }
    },
    {
      id: "mou", group: "gov", icon: "handshake", title: "MOU・海外との協定", site: "日本と世界のMOU・協定マップ",
      q: function (n, a, env) {
        if (n === "全国") return "国や自治体は、海外とどんな協定を結んでいる？";
        return (a.muni ? n + "や" + env.prefName(a) : n) + "は、海外とどんな協定を結んでいる？";
      },
      desc: "相手の国・分野・取り決めの内容と、有効・終了・未確認の区分を調べる",
      btn: "詳しく調べる",
      resolve: function (a, env) { return env.mou(a); }
    },
    {
      id: "pubcome", group: "voice", icon: "comment", title: "パブリックコメント", site: "パブコメ掲示板",
      q: function (n, a, env) {
        if (n === "全国") return "国や自治体は今、どんな意見を募集中？";
        return (a.muni ? n + "・" + env.prefName(a) : n) + "では今、どんな意見を募集中？";
      },
      desc: "募集中の案件を締切が近い順に見て、公式の提出先へ進む",
      btn: "募集を見る",
      resolve: function (a, env) { return env.pubcome(a); }
    },
    {
      id: "shomei", group: "voice", icon: "pen", title: "署名活動", site: "署名掲示板",
      q: function (n, a, env) { return n === "全国" ? "全国で、どんな署名が集まっている？" : env.prefName(a) + "に関係する署名はある？"; },
      desc: "活動の内容・提出先・署名の数を見て、署名ページへ進む",
      btn: "署名を見る",
      resolve: function (a, env) { return env.shomei(a); }
    }
  ];

  // ---------- 各サイトへの引き継ぎ方 ----------
  function makeEnv(ctx) {
    var P = ctx.prefByCode;
    function prefName(a) { return P[a.pref].name; }
    function prefShort(a) { return a.pref === "01" ? "北海道" : P[a.pref].name.replace(/[都府県]$/, ""); }

    return {
      prefName: prefName,

      // 数でみる在留外国人：pref-<ローマ字>.html、muni-<5けたコード>.html、政令市は city-<市名>.html
      // 人数は、開くページそのものに入っている数（総数・集計時点・国籍の内わけ）を読む
      zairyu: function (a) {
        var base = GH + "zairyu/";
        var prefURL = base + "pref-" + ROMA[+a.pref - 1] + ".html";
        var url = !a.muni ? prefURL
          : a.muni.seirei ? base + "city-" + encodeURIComponent(a.muni.name) + ".html"
          : base + "muni-" + a.muni.code.slice(0, 5) + ".html";
        var name = a.muni ? a.muni.name : prefName(a);
        return fetch(url).then(function (r) {
          if (r.status === 404 && a.muni) {
            return {
              href: prefURL, scope: "wider",
              scopeText: prefName(a) + "のページを開きます（" + a.muni.name + "のページはありません）",
              stat: { value: "統計の表に載っていません", note: "外国人住民がいない町村は、国の在留外国人統計の表に載りません（2017年12月末から）。" }
            };
          }
          if (!r.ok) throw new Error(r.status);
          return r.text().then(function (html) {
            var doc = new DOMParser().parseFromString(html, "text/html");
            var nat = null;
            doc.querySelectorAll('script[type="application/json"]').forEach(function (el) {
              try {
                var d = JSON.parse(el.textContent);
                if (!nat && d && d.dim === "nat" && typeof d.total === "number") nat = d;
              } catch (e) {}
            });
            var res = { href: url, scope: "exact", scopeText: name + "のページを開きます" };
            if (!nat) { res.stat = null; return res; }
            var w = String(nat.when || "").match(/(\d{4})-(\d{2})/);
            var top = (nat.items || []).slice(0, 3).map(function (x) { return x[0]; }).join("・");
            res.stat = {
              value: num(nat.total) + "<small>人</small>",
              note: (top ? "多い国籍：" + top + "。" : "") + (w ? w[1] + "年" + (+w[2]) + "月末時点、" : "") + "出入国在留管理庁「在留外国人統計」"
            };
            return res;
          });
        });
      },

      // 日本のモスク情報：都道府県は pref-<ローマ字>.html、市区町村は area.html?pref=都道府県名&city=市区町村名
      // 数は、サイトが公開している一覧（mosque_locations.csv）を「種類」ごとに数える
      mosque: function (a) {
        var base = GH + "mosque-map/";
        return load.mosque().then(function (M) {
          var rows = M.rows.filter(function (r) {
            return r.pref === prefName(a) && (!a.muni || r.city === a.muni.name);
          });
          var c = {};
          rows.forEach(function (r) { c[r.kind] = (c[r.kind] || 0) + 1; });
          var main = c["モスク・礼拝所"] || 0;
          var others = ["計画・建設中", "墓地", "学校", "状況確認中"].filter(function (k) { return c[k]; })
            .map(function (k) { return k + " " + c[k]; }).join("・");
          var when = M.updated ? "（" + jdate(M.updated) + "更新）" : "";
          var name = a.muni ? a.muni.name : prefName(a);
          var stat = {
            value: "モスク・礼拝所 " + num(main) + "<small>か所</small>",
            note: (others ? "ほかに " + others + "。" : "") +
              (main === 0 && !others ? name + "では、調べた範囲では見つかっていません。" : "") +
              "サイトが調べた施設の一覧" + when + "で数えています。"
          };
          if (a.muni) {
            return {
              href: base + "area.html?pref=" + encodeURIComponent(prefName(a)) + "&city=" + encodeURIComponent(a.muni.name),
              scope: "exact", scopeText: a.muni.name + "を選んだ状態で開きます", stat: stat
            };
          }
          return { href: base + "pref-" + ROMA[+a.pref - 1] + ".html", scope: "exact", scopeText: prefName(a) + "のページを開きます", stat: stat };
        });
      },

      // 民泊・旅館業マップ：?pref=都道府県名&city=市区町村名（名前で指定。15都道府県が対象）
      minpaku: function (a) {
        var base = GH + "minpaku-map/";
        return load.minpaku().then(function (D) {
          var pi = D.prefs.indexOf(prefName(a));
          var when = "サイトの更新：" + jdate(D.updated) + "。";
          if (pi < 0) {
            return {
              href: base, scope: "top",
              scopeText: prefName(a) + "は掲載対象外です。サイトのトップを開きます（地域は引き継がれません）",
              stat: { value: "掲載対象外", note: "このサイトは、" + D.prefs.length + "都道府県（" + D.prefs.join("・") + "）が対象です。" }
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
          function missingIn(srcIdx) {
            return srcIdx.some(function (i) { var s = D.sources[i]; return s && s.count === 0 && s.memo; });
          }
          var prefURL = base + "?pref=" + encodeURIComponent(prefName(a)) + "#map-sec";
          if (a.muni) {
            var city = D.cities.find(function (c) {
              return c.pref === pi && (c.name === a.muni.name || c.name === a.muni.name + "（" + prefName(a) + "）");
            });
            if (!city) {
              return {
                href: prefURL, scope: "wider",
                scopeText: prefName(a) + "の地図を開きます（" + a.muni.name + "の施設は、このサイトに載っていません）",
                stat: { value: "掲載なし", note: a.muni.name + "の施設は載っていません。0件とは限りません（自治体が一覧を公表していない・まだ取り込んでいない場合があります）。" + when }
              };
            }
            var total = city.n.reduce(function (s, x) { return s + x; }, 0);
            var dates = city.src.map(function (i) { return D.sources[i] && D.sources[i].date; }).filter(Boolean).sort();
            var span = dates.length ? (dates[0] === dates[dates.length - 1] ? jdate(dates[0]) : jdate(dates[0]) + "〜" + jdate(dates[dates.length - 1])) : "";
            return {
              href: base + "?pref=" + encodeURIComponent(prefName(a)) + "&city=" + encodeURIComponent(city.name) + "#map-sec",
              scope: "exact", scopeText: a.muni.name + "を選んだ状態で開きます",
              stat: {
                value: "掲載 " + num(total) + "<small>件</small>",
                note: line(city.n) + "。自治体が公表した一覧の件数" + (span ? "（" + span + "時点）" : "") + "。" +
                  (missingIn(city.src) ? "一部の一覧は取得できていません（その分は0件ではありません）。" : "")
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
          var tot = sum.reduce(function (s, x) { return s + x; }, 0);
          return {
            href: prefURL, scope: "exact", scopeText: prefName(a) + "を選んだ状態で開きます",
            stat: {
              value: "掲載 " + num(tot) + "<small>件</small>",
              note: line(sum) + "。" + prefName(a) + "内の掲載分の合計（資料の日付は自治体ごとに異なります）。" +
                (missingIn(srcs) ? "一覧を取得できていない自治体の分は含みません。" : "") + when
            }
          };
        });
      },

      // 全国 多文化共生予算マップ：#/m/<6けたコード>（都道府県も6けた。調べていない自治体は「未調査」と表示される）
      tabunka: function (a) {
        var base = GH + "tabunka-yosan/";
        var code = a.muni ? a.muni.code : prefCode6(a.pref);
        var name = a.muni ? a.muni.name : prefName(a);
        var href = base + "#/m/" + code;
        return load.tabunka().then(function (S) {
          var rec = S.sum[code];
          var res = { href: href, scope: "exact", scopeText: name + "のページを開きます" };
          if (!rec) {
            res.stat = { value: "未調査", note: name + "の予算はまだ調べていません（0円ではありません）。調べた自治体から順に公開中（" + jdate(S.generated) + "集計）。" };
            return res;
          }
          var fys = Object.keys(rec).sort().reverse();
          var pick = null;
          fys.some(function (fy) {
            return ["当初予算", "補正後予算", "決算"].some(function (st) {
              var x = rec[fy][st];
              if (x && x.a != null) { pick = { fy: fy, st: st, x: x }; return true; }
              return false;
            });
          });
          if (!pick) {
            res.stat = { value: "金額は確認中", note: "事業は見つかっていますが、合計額はまだ確認できていません（" + jdate(S.generated) + "集計）。" };
            return res;
          }
          res.stat = {
            value: yen(pick.x.a),
            note: pick.fy + "年度" + pick.st + "のうち、多文化共生に直接関係する事業の合計（" + pick.x.st +
              (pick.x.st === "一部確認" ? "：まだ一部の事業しか確認できていません" : "") + "・" + jdate(S.generated) + "集計）。"
          };
          return res;
        });
      },

      // 自治体カルテ（ほかの方のサイト）：/m/<6けたコード>、/pref/<都道府県6けたコード>
      karte: function (a) {
        var base = "https://www.zititai-karte.com/";
        if (a.muni) return { href: base + "m/" + a.muni.code, scope: "exact", scopeText: a.muni.name + "のページを開きます（最新年度の決算）", stat: null };
        return { href: base + "pref/" + prefCode6(a.pref), scope: "exact", scopeText: prefName(a) + "のページを開きます（最新年度の決算）", stat: null };
      },

      // MOU・協定マップ：都道府県は #/pref/<2けた>、市区町村は #/city/<6けた>
      // 市区町村は政令指定都市20市しか調べていないので、それ以外は「未調査」とし、都道府県のページへ案内する
      // 数は、サイトが公開している件数のまとめ（data/build/summary.json。画面と同じ数え方）の「MOUのみ」を、有効性ごとに分けて出す
      mou: function (a) {
        var base = GH + "mou-map/";
        var prefURL = base + "#/pref/" + a.pref;
        return load.mou().then(function (S) {
          var L = S.labels || {};
          var when = "同じ協定の更新は1件として数え、報道のみの情報は含みません（" + jdate(S.generated) + "時点の判定）。";
          function counts(c, who) {
            var m = c.mou;
            var rest = ["unconfirmed", "ended_confirmed", "signed_not_started", "planned"].filter(function (k) { return m[k]; })
              .map(function (k) { return (L[k] || k) + " " + num(m[k]) + "件"; }).join("・");
            return {
              value: (L.valid_confirmed || "有効確認") + " " + num(m.valid_confirmed) + "<small>件</small>",
              note: who + "が結んだMOUのうち、今も有効と公式資料で確認できたもの。" + (rest ? "ほかに " + rest + "（有効性未確認は、終了したという意味ではありません）。" : "") + when
            };
          }
          if (a.muni) {
            var cm = S.municipalities && S.municipalities[a.muni.code];
            if (!cm) {
              return {
                href: prefURL, scope: "wider",
                scopeText: prefName(a) + "のページを開きます（" + a.muni.name + "の協定はまだ調べていません）",
                stat: { value: "未調査", note: "市区町村の協定は、政令指定都市20市の外国人材・労働分野だけを調べています。" + a.muni.name + "はまだ調べていません（0件ではありません）。" }
              };
            }
            var st = counts(cm.counts, a.muni.name);
            st.note = "調査：" + ((S.survey_labels || {})[cm.survey] || cm.survey) + (cm.checked ? "（" + jdate(cm.checked) + "確認）" : "") + "。" + st.note;
            return { href: base + "#/city/" + a.muni.code, scope: "exact", scopeText: a.muni.name + "のページを開きます", stat: st };
          }
          var cp = S.prefectures && S.prefectures[a.pref];
          if (!cp) return { href: prefURL, scope: "exact", scopeText: prefName(a) + "のページを開きます", stat: null };
          var sp = counts(cp.counts, prefName(a));
          sp.note += "県内の市区町村が結んだ協定は含みません。";
          return { href: prefURL, scope: "exact", scopeText: prefName(a) + "のページを開きます", stat: sp };
        });
      },

      // パブコメ掲示板：pref/?pref=都道府県名、city/?pref=…&city=市区名
      // 市区は105か所だけ。対象外の市区は、県の募集を見られるよう県のページへ案内する
      pubcome: function (a) {
        var base = GH + "pubcome/";
        var t = today();
        function openCount(items, test) {
          var list = items.filter(function (i) { return i.dl >= t && test(i); }).sort(function (x, y) { return x.dl < y.dl ? -1 : 1; });
          return { n: list.length, next: list.length ? list[0].dl : "" };
        }
        var national = load.pubCounts().then(function (C) {
          var n = 0;
          var next = "";
          Object.keys(C.counts.national).sort().forEach(function (d) {
            if (d >= t) { n += C.counts.national[d]; if (!next) next = d; }
          });
          return { n: n, next: next };
        }, function () { return null; });
        var pname = prefName(a);
        return Promise.all([load.pubPref(), a.muni ? load.pubCity() : null, national]).then(function (r) {
          var PD = r[0], CD = r[1], nat = r[2];
          var po = PD.officials.find(function (o) { return o.name === pname; });
          var pc = openCount(PD.items, function (i) { return i.body === pname; });
          var parts = [];
          var notes = [];
          var res = { href: base + "pref/?pref=" + encodeURIComponent(pname), scope: "exact", scopeText: pname + "の募集を開きます" };
          if (a.muni) {
            var co = CD.officials.find(function (o) { return o.name === a.muni.name && o.pref === pname; });
            if (co) {
              var cc = openCount(CD.items, function (i) { return i.body === a.muni.name && i.area === pname; });
              res.href = base + "city/?pref=" + encodeURIComponent(pname) + "&city=" + encodeURIComponent(a.muni.name);
              res.scopeText = a.muni.name + "の募集を開きます";
              parts.push(co.error ? a.muni.name + " 取得できず" : a.muni.name + " " + num(cc.n) + "件");
              if (co.error) notes.push(a.muni.name + "は今日の取得に失敗しました（0件とは限りません）。");
              if (cc.next) notes.push(a.muni.name + "のいちばん近い締切：" + mdate(cc.next) + "。");
            } else {
              res.scope = "wider";
              res.scopeText = pname + "の募集を開きます（" + a.muni.name + "の意見募集は、このサイトの収集対象外です）";
              parts.push(a.muni.name + " 対象外");
              notes.push("市区町村は政令市・中核市・東京23区の105市区だけを集めています。" + a.muni.name + "の募集は、市区町村の公式サイトで確認してください。");
            }
          }
          parts.push(po && po.error ? pname + " 取得できず" : pname + " " + num(pc.n) + "件");
          if (po && po.error) notes.push(pname + "は今日の取得に失敗しました（0件とは限りません）。");
          if (pc.next && !a.muni) notes.push("いちばん近い締切：" + mdate(pc.next) + "。");
          if (nat) parts.push("国 " + num(nat.n) + "件");
          notes.push("募集中の件数。集計：" + jdate(PD.updated) + "（毎朝更新）");
          res.stat = { value: parts.join("・"), note: notes.join("") };
          return res;
        });
      },

      // 署名掲示板：?pref=都道府県名（「東京」「東京都」どちらでも可）。署名は都道府県単位でしか分けていない。
      // 掲載中の署名がない県も、サイトが「0件です」と表示するので、その県を選んだ状態で開く
      shomei: function (a) {
        var base = GH + "shomei/";
        return load.shomei().then(function (D) {
          var t = today();
          var live = D.items.filter(function (i) { return !i.end || i.end >= t; });
          var none = live.filter(function (i) { return !i.pref; }).length;
          var when = jdate(D.updated) + "時点で掲載中の署名。地域は、タイトルと提出先に書かれた都道府県で分けています。";
          var short = prefShort(a);
          var n = live.filter(function (i) { return i.pref === short; }).length;
          var others = "地域が書かれていない署名（全国向けなど）は " + num(none) + "件で、トップから見られます。";
          return {
            href: base + "?pref=" + encodeURIComponent(short) + "#results",
            scope: a.muni ? "wider" : "exact",
            scopeText: a.muni ? prefName(a) + "の署名を開きます（市区町村ごとの分類はありません）" : prefName(a) + "の署名を開きます",
            stat: { value: prefName(a) + " " + num(n) + "<small>件</small>", note: when + others }
          };
        });
      }
    };
  }
  var env = null;

  // ---------- カードを描く ----------
  function cardHTML(t, a, name) {
    return (
      '<li class="topic" id="topic-' + t.id + '">' +
        '<div class="topic-head">' +
          '<span class="topic-icon"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + ICONS[t.icon] + "</svg></span>" +
          '<div><h4 class="topic-title">' + esc(t.title) + "</h4>" +
          '<p class="topic-site">' + esc(t.site) + "で調べる</p></div>" +
        "</div>" +
        '<p class="topic-q">' + esc(t.q(name, a, env)) + "</p>" +
        '<p class="topic-desc">' + esc(t.desc) + "</p>" +
        '<div class="topic-stat is-loading" aria-live="polite"><span class="topic-stat-value">' + (a ? "数値を読み込んでいます…" : "") + "</span></div>" +
        '<p class="topic-scope is-top">確認しています…</p>' +
        '<div class="topic-foot">' +
          '<a class="btn-topic" href="' + GH + '" target="_blank" rel="noopener noreferrer">' + esc(t.btn) + EXT +
          '<span class="sr-only">（' + esc(t.site) + "が新しいタブで開きます）</span></a>" +
        "</div>" +
      "</li>"
    );
  }
  function fill(li, t, r) {
    var stat = li.querySelector(".topic-stat");
    stat.classList.remove("is-loading");
    if (r.stat) {
      stat.innerHTML = '<span class="topic-stat-value">' + r.stat.value + "</span>" +
        (r.stat.note ? '<span class="topic-stat-note">' + esc(r.stat.note) + "</span>" : "");
      stat.hidden = false;
    } else {
      stat.innerHTML = "";
      stat.hidden = true;
    }
    var scope = li.querySelector(".topic-scope");
    scope.className = "topic-scope is-" + r.scope;
    scope.innerHTML = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + SCOPE_ICON[r.scope] + "</svg><span>" + esc(r.scopeText) + "</span>";
    var btn = li.querySelector(".btn-topic");
    btn.href = r.href;
  }
  function fail(li, t, a) {
    // データが読めなかったとき：数値は出さず、地域を引き継がないトップへ案内する（引き継いだように見せない）
    var fallback = window.REGION_TOP[t.id];
    fill(li, t, {
      href: fallback, scope: "top",
      scopeText: "データを読み込めなかったため、サイトのトップを開きます（地域は引き継がれません）",
      stat: { value: "読み込めませんでした", note: "時間をおいて、もう一度お試しください。" }
    });
  }

  var token = 0;
  window.RegionCards = {
    init: function (box, ctx) {
      env = makeEnv(ctx);
      env.ctx = ctx;
      return { box: box };
    },
    render: function (c, a) {
      var my = ++token;
      var name = !a ? "全国" : a.muni ? a.muni.name : env.prefName(a);
      c.box.innerHTML = GROUPS.map(function (g) {
        return '<section class="topic-group" aria-labelledby="tg-' + g.id + '">' +
          '<h3 class="topic-group-title" id="tg-' + g.id + '"><span class="tg-mark" aria-hidden="true">' + g.mark + "</span>" + esc(g.title) + "</h3>" +
          '<ul class="topic-cards">' +
          TOPICS.filter(function (t) { return t.group === g.id; }).map(function (t) { return cardHTML(t, a, name); }).join("") +
          "</ul></section>";
      }).join("");
      TOPICS.forEach(function (t) {
        var li = document.getElementById("topic-" + t.id);
        if (!a) {
          // 地域を選ぶまでは、データを読まずに各サイトのトップを案内する（ページを軽くするため）
          fill(li, t, { href: window.REGION_TOP[t.id], scope: "top", scopeText: "サイトのトップを開きます", stat: null });
          return;
        }
        Promise.resolve().then(function () { return t.resolve(a, env); }).then(function (r) {
          if (my === token) fill(li, t, r);
        }, function () {
          if (my === token) fail(li, t, a);
        });
      });
    }
  };
  // データが読めなかったときに案内する各サイトのトップ
  window.REGION_TOP = {
    zairyu: GH + "zairyu/", mosque: GH + "mosque-map/", minpaku: GH + "minpaku-map/", tabunka: GH + "tabunka-yosan/",
    karte: "https://www.zititai-karte.com/", mou: GH + "mou-map/", pubcome: GH + "pubcome/", shomei: GH + "shomei/"
  };
  window.RegionUtil = { GH: GH, jdate: jdate, num: num, getJSON: getJSON, getEmbedded: getEmbedded, once: once, prefCode6: prefCode6, today: today };
})();
