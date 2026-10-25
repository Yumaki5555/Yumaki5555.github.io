# 日本を知る。（入口サイト）

公開先：https://yumaki5555.github.io/ （リポジトリ：Yumaki5555/Yumaki5555.github.io）

## ファイルの役割

| ファイル | 役割 |
|---|---|
| `index.html` | ページの骨組み（見出し・説明文・このサイトについて・掲載情報について） |
| `sites.js` | **掲載サイトの一覧**。サイトを足す・直すときはここだけ書きかえる |
| `main.js` | カードを作る、スマホのメニュー、上へ戻るボタン、ページ更新日の読み取り |
| `style.css` | 見た目 |
| `favicon.svg` | ブラウザのタブに出る小さな絵 |
| `ogp.png` | SNSで共有したときに出るサムネイル（1200×630） |
| `_ogp/ogp.html` | サムネイルの元。直したら Edge で撮り直す（`_` で始まるフォルダは公開されません） |

## サイトを追加するとき

`sites.js` の `window.SITES` に1件足します。

```js
{
  id: "new-site",               // 半角英数字の名前（ほかと重ならないもの）
  category: "research",         // research（調べる）/ learn（学ぶ）/ participate（参加する）
  name: "サイト名",
  url: "https://～",
  desc: "2〜3行の紹介文",
  icon: "bars"                  // main.js の ICONS にある名前
}
```

## ページ更新日について

`checkUpdate: true` のサイトだけ、サイトから返ってくる最終更新日時を読み取って表示します。
読み取れるのは yumaki5555.github.io のサイトだけです。読み取れなかったときは何も表示しません。
