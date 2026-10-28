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
for (const f of ["sites.js", "site-cards.js"]) vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx);

const file = path.join(root, "index.html");
let html = fs.readFileSync(file, "utf8");
for (const cat of ["research", "learn", "participate"]) {
  const re = new RegExp(`(<div class="cards" data-category="${cat}"><!-- cards:start[^>]*-->)[\s\S]*?(<!-- cards:end -->)`);
  if (!re.test(html)) throw new Error(`index.html に ${cat} の書きこみ場所がありません`);
  const cards = ctx.window.SiteCards.html(ctx.window.SITES, cat);
  html = html.replace(re, (_, a, b) => a + "\n" + cards.replace(/<\/article>/g, "</article>\n") + b);
}
fs.writeFileSync(file, html);
console.log("index.html に", ctx.window.SITES.length, "サイトのカードを書きこみました");
