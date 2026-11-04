// 「テーマから探す」の12サイトのカードを、index.html に書きこみます。
// JavaScript が動かないときや読み込みに失敗したときも、カードとリンクが表示されるようにするためです。
// （ブラウザでは main.js が sites.js から作り直すので、表示はいつも sites.js の内容になります）
//
// 使い方：sites.js を直したら、入口サイトのフォルダで  node _tools/build_cards.mjs
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ctx = { window: {} };
vm.createContext(ctx);
for (const f of ["sites.js", "brand-icons.js", "site-cards.js"]) vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx);

const file = path.join(root, "index.html");
let html = fs.readFileSync(file, "utf8");
for (const cat of ["research", "learn", "participate"]) {
  const re = new RegExp(`(<div class="cards" data-category="${cat}"><!-- cards:start[^>]*-->)[\\s\\S]*?(<!-- cards:end -->)`);
  if (!re.test(html)) throw new Error(`index.html に ${cat} の書きこみ場所がありません`);
  const cards = ctx.window.SiteCards.html(ctx.window.SITES, cat);
  html = html.replace(re, (_, a, b) => a + "\n" + cards.replace(/<\/article>/g, "</article>\n") + b);
}
fs.writeFileSync(file, html);
console.log("index.html に", ctx.window.SITES.length, "サイトのカードを書きこみました");

// 全サイト共通メニュー（shared/site-nav.js）の「ほかのサイト」の一覧も、同じ sites.js から作ります
const navFile = path.join(root, "shared", "site-nav.js");
const nav = fs.readFileSync(navFile, "utf8");
const navRe = /(\/\* sites:start[^*]*\*\/\n)[\s\S]*?(\n\s*\/\* sites:end \*\/)/;
if (!navRe.test(nav)) throw new Error("shared/site-nav.js に一覧の書きこみ場所がありません");
// 「声を届ける」はメニューに常に出ているので、「ほかのサイト」の一覧には入れません
const navList = ctx.window.SITES.filter((s) => s.id !== "todokeru");
const navSites = navList.map((s) => {
  const row = { id: s.id, name: s.name, url: s.url, category: s.category };
  if (s.operator || !s.url.startsWith("https://yumaki5555.github.io/")) row.other = true;
  return "    " + JSON.stringify(row);
}).join(",\n");
fs.writeFileSync(navFile, nav.replace(navRe, (_, a, b) => a + "  var SITES = [\n" + navSites + "\n  ];" + b));
console.log("shared/site-nav.js に", navList.length, "サイトの一覧を書きこみました");
