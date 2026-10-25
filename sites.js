// 掲載サイトの一覧です。
// サイトを足す・直すときは、このファイルだけを書きかえれば、トップページのカードに反映されます。
//
// category … どの分類に載せるか（下の CATEGORIES の id）
// icon     … カードの絵（main.js の ICONS にある名前）
// pair     … 「詳しく調べる版」と「図で学ぶ版」をつなぐ案内（相手の id と、案内の言葉）
// checkUpdate … true にすると、そのサイトのページ更新日を読み取って表示します
//               （読み取れるのは yumaki5555.github.io のサイトだけです）

// 分類の名前（カードの上に小さく出ます）。分類の見出しと説明文は index.html に書いています。
window.CATEGORIES = [
  { id: "research", name: "調べる・比較する" },
  { id: "learn", name: "わかりやすく学ぶ" },
  { id: "participate", name: "声を届ける・参加する" }
];

window.SITES = [
  {
    id: "policy-log",
    category: "research",
    name: "政策ログJP",
    url: "https://policy-log.jp/",
    desc: "国の政策や法案は、今どこまで進んでいる？ 政策の動きや進捗を調べるためのサイトです。",
    icon: "timeline"
  },
  {
    id: "zititai-karte",
    category: "research",
    name: "自治体カルテ",
    url: "https://www.zititai-karte.com/",
    desc: "自分のまちのお金は、どこから入り、何に使われている？ 自治体の財政状況をグラフやデータで調べ、比較できます。",
    icon: "cityhall"
  },
  {
    id: "zairyu",
    category: "research",
    name: "数でみる在留外国人",
    url: "https://yumaki5555.github.io/zairyu/index.html",
    desc: "日本に住む外国人は何人？ 国籍・在留資格・地域・年ごとの変化など、統計データを詳しく調べられます。",
    icon: "bars",
    checkUpdate: true,
    pair: { id: "zairyu-guide", label: "まずは図で知りたい方はこちら" }
  },
  {
    id: "minpaku-map",
    category: "research",
    name: "民泊・旅館業マップ",
    url: "https://yumaki5555.github.io/minpaku-map/",
    desc: "自分のまちには、どのような宿泊施設がある？ 民泊や旅館業に関する公開情報を地図で確認できます。",
    icon: "pin",
    checkUpdate: true
  },
  {
    id: "mosque-map",
    category: "research",
    name: "日本のモスク情報",
    url: "https://yumaki5555.github.io/mosque-map/",
    desc: "日本各地のモスクや礼拝施設について、所在地、運営、建設計画、寄付、葬儀・墓地などの情報を調べられます。",
    icon: "dome",
    checkUpdate: true,
    pair: { id: "mosque-guide", label: "まずは図で知りたい方はこちら" }
  },
  {
    id: "mosque-guide",
    category: "learn",
    name: "日本のモスクを知る",
    url: "https://mosque-info-explorer.sunlitmole256.chatgpt.site/",
    desc: "日本のモスクや関連する情報を、地図・グラフ・図解・クイズでやさしく学べる入門サイトです。",
    icon: "dome",
    pair: { id: "mosque-map", label: "詳しく調べたい方はこちら" }
  },
  {
    id: "zairyu-guide",
    category: "learn",
    name: "図で見る、日本に住む外国人",
    url: "https://nihon-kurashi-zairyu-guide.sunlitmole256.chatgpt.site/",
    desc: "日本に住む外国人について、人数・国籍・在留資格などを図やグラフを使って、わかりやすく紹介します。",
    icon: "pie",
    pair: { id: "zairyu", label: "詳しく調べたい方はこちら" }
  },
  {
    id: "pubcome",
    category: "participate",
    name: "パブコメ掲示板",
    url: "https://yumaki5555.github.io/pubcome/",
    desc: "国や自治体が募集しているパブリックコメントを探せます。募集内容や締切を確認して、公式の提出先へ進めます。",
    icon: "bubble",
    checkUpdate: true
  },
  {
    id: "shomei",
    category: "participate",
    name: "署名掲示板",
    url: "https://yumaki5555.github.io/shomei/",
    desc: "全国で行われている署名活動を探せます。テーマや地域から活動を見つけ、内容を確認できます。",
    icon: "pen",
    checkUpdate: true
  }
];
