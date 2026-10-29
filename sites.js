// 掲載サイトの一覧です。
// サイトを足す・直すときは、このファイルを書きかえて、入口サイトのフォルダで  node _tools/build_cards.mjs  を実行します
// （index.html のカードと件数に反映されます）。
// カードは「アイコンとサイト名 → 1行の要約 → 要点（2〜3個） → 補足 → サイトを見る」の順に並びます。
//
// category … どの分類に載せるか（research＝調べる・比較する／learn＝わかりやすく学ぶ／participate＝声を届ける・参加する）
//            この一覧の順番が、そのままカードの並び順になります
// icon     … アイコンの形（brand-icons.js の名前。リンク先のファビコンと同じ形にする）
// summary  … 1行の短い要約
// points   … そのサイトで具体的にできること（2〜3個、短く）。変わる件数は書かない
// note     … 補足のひとこと（なくてもよい）
// pair     … 「詳しく調べる版」と「図で学ぶ版」をつなぐ案内（相手の id と、案内の言葉）
// checkUpdate … true にすると、そのサイトのページ更新日を読み取って表示します
//               （読み取れるのは yumaki5555.github.io のサイトだけです）
// operator … ほかの方が運営しているサイトの、運営者の名前と X（旧Twitter）のアドレス
// shot・alt … 実際の画面の写真（img/shots/）と、その説明。今はカードに出していません（カードを小さくするため。戻すときに使う）

window.SITES = [
  {
    id: "policy-log",
    category: "research",
    name: "政策ログJP",
    url: "https://policy-log.jp/",
    icon: "policy",
    summary: "国の政策・法案の進み具合を追う",
    points: ["検討中・審議中・成立の段階で探す", "省庁・テーマから探す", "閣議決定や国会の動きを時系列で見る"],
    shot: "img/shots/policy-log.webp",
    alt: "政策ログJPのトップ画面。追跡中・審議中・成立などの法案の数と、意見募集・法案の今・機関で探すのメニューが並んでいる",
    operator: { name: "Policy-log.jpさん", x: "https://x.com/watermark_hd1" }
  },
  {
    id: "mou-map",
    category: "research",
    name: "日本と世界のMOU・協定マップ",
    url: "https://yumaki5555.github.io/mou-map/",
    icon: "mou",
    summary: "海外との覚書・協定を地図で調べる",
    points: ["日本地図・相手国・分野から検索", "有効・終了・未確認の区分と地域への影響", "「まず3分でわかる」で仕組みを解説"],
    shot: "img/shots/mou-map.webp",
    alt: "MOU・協定マップの画面。キーワードで探す検索欄と、登録した協定の数を都道府県ごとに色分けした日本地図",
    checkUpdate: true
  },
  {
    id: "zititai-karte",
    category: "research",
    name: "自治体カルテ",
    url: "https://www.zititai-karte.com/",
    icon: "karte",
    summary: "自治体のお金と人口をグラフで見る",
    points: ["歳入・歳出の内訳と人口の推移", "全国ランキングで順位を確認", "最大3自治体を並べて比較"],
    shot: "img/shots/zititai-karte.webp",
    alt: "自治体カルテの全国ランキング画面。自治体ごとの歳出総額を横棒グラフで並べている",
    operator: { name: "自治体カルテさん", x: "https://x.com/zititai_karte" }
  },
  {
    id: "tabunka-yosan",
    category: "research",
    name: "全国 多文化共生予算マップ",
    url: "https://yumaki5555.github.io/tabunka-yosan/",
    icon: "tabunka",
    summary: "多文化共生の予算と使い道を調べる",
    points: ["日本語教室・相談窓口などの予算と決算", "財源の内訳、ほかの自治体・年度との比較", "「3分でわかる」で仕組みを解説"],
    note: "調べた自治体から順に公開中",
    shot: "img/shots/tabunka-yosan.webp",
    alt: "全国 多文化共生予算マップの浜松市のページ。2026年度当初予算の多文化共生の直接関連事業の合計3億4,976.7万円と、財源の内訳・外国人住民数が並んでいる",
    checkUpdate: true
  },
  {
    id: "zairyu",
    category: "research",
    name: "数でみる在留外国人",
    url: "https://yumaki5555.github.io/zairyu/index.html",
    icon: "zairyu",
    summary: "外国人住民の数を地域・国籍で調べる",
    points: ["都道府県・市区町村・国籍・在留資格から検索", "1959年からの推移を地図で再生", "半期ごとの速報も見られる"],
    shot: "img/shots/zairyu.webp",
    alt: "数でみる在留外国人の画面。都道府県ごとの在留外国人の数を、色の濃さで表した日本地図",
    checkUpdate: true,
    pair: { id: "zairyu-guide", label: "まずは図で" }
  },
  {
    id: "minpaku-map",
    category: "research",
    name: "民泊・旅館業マップ",
    url: "https://yumaki5555.github.io/minpaku-map/",
    icon: "minpaku",
    summary: "民泊・旅館業の施設を地図で探す",
    points: ["住所・市区町村で探して地図の点で確認", "市区町村ごとの件数ランキング", "前回の資料からの増減"],
    shot: "img/shots/minpaku-map.webp",
    alt: "民泊・旅館業マップの画面。東京都心の地図に、民泊・特区民泊・旅館やホテル・簡易宿所の施設が色分けした点で表示されている",
    checkUpdate: true
  },
  {
    id: "mosque-map",
    category: "research",
    name: "日本のモスク情報",
    url: "https://yumaki5555.github.io/mosque-map/",
    icon: "mosque",
    summary: "モスク・礼拝所を出典付きで調べる",
    points: ["地図・都道府県から施設を探す", "運営団体・建設計画・寄付の募集", "葬儀・土葬墓地の調査結果"],
    shot: "img/shots/mosque-map.webp",
    alt: "日本のモスク情報の地図画面。日本地図にモスク・礼拝所の位置がピンで示され、右側に施設の一覧が並んでいる",
    checkUpdate: true,
    pair: { id: "mosque-guide", label: "まずは図で" }
  },
  {
    id: "kansensho",
    category: "research",
    name: "世界の感染症と日本の水際対策",
    url: "https://yumaki5555.github.io/kansensho/",
    icon: "kansensho",
    summary: "感染症の国別状況と水際対策を調べる",
    points: ["HIV・梅毒・はしか・結核を国別に比較", "国・在留資格から入国時の検査を確認", "日本の患者数の推移と治療費の負担"],
    note: "「まず3分でわかる」結核編・HIV/エイズ編つき",
    shot: "img/shots/kansensho.webp",
    alt: "世界の感染症と日本の水際対策の国別比較画面。国ごとの結核の罹患率を横棒グラフで比べている",
    checkUpdate: true
  },
  {
    id: "mosque-guide",
    category: "learn",
    name: "日本のモスクを知る",
    url: "https://mosque-info-explorer.sunlitmole256.chatgpt.site/",
    icon: "mosque",
    summary: "モスクを図とクイズでやさしく学ぶ",
    points: ["地図と5つのテーマの図解", "好きなテーマで10問のクイズ", "ふりがな付きで読める"],
    shot: "img/shots/mosque-guide.webp",
    alt: "日本のモスクを知るの画面。都道府県を四角で並べた地図に、それぞれのモスクの数が書かれている",
    pair: { id: "mosque-map", label: "詳しく調べる" }
  },
  {
    id: "zairyu-guide",
    category: "learn",
    name: "図で見る、日本に住む外国人",
    url: "https://nihon-kurashi-zairyu-guide.sunlitmole256.chatgpt.site/",
    icon: "people",
    summary: "外国人のくらしを図でやさしく学ぶ",
    points: ["在留資格を円グラフ・100人の図で", "年ごとの変化と地域の比較", "クイズで確かめる"],
    shot: "img/shots/zairyu-guide.webp",
    alt: "図で見る、日本に住む外国人の画面。外国人全体のうち、仕事・技能実習の資格の人の割合を示す円グラフ",
    pair: { id: "zairyu", label: "詳しく調べる" }
  },
  {
    id: "pubcome",
    category: "participate",
    name: "パブコメ掲示板",
    url: "https://yumaki5555.github.io/pubcome/",
    icon: "pubcome",
    summary: "いま募集中の意見募集（パブコメ）を探す",
    points: ["国・都道府県・市区町村の案件", "キーワード・担当省庁で検索", "締切が近い順に並べ、公式の提出先へ"],
    shot: "img/shots/pubcome.webp",
    alt: "パブコメ掲示板の画面。国・都道府県・市区町村の切りかえと、キーワード・担当省庁・テーマで案件を探す検索欄",
    checkUpdate: true
  },
  {
    id: "shomei",
    category: "participate",
    name: "署名掲示板",
    url: "https://yumaki5555.github.io/shomei/",
    icon: "shomei",
    summary: "全国の署名活動を探す",
    points: ["change.org と Voice の署名を掲載", "キーワード・都道府県で検索", "署名が多い順・伸びている順・終了日が近い順"],
    shot: "img/shots/shomei.webp",
    alt: "署名掲示板の画面。キーワード・テーマ・地域・並び順で署名を探す検索欄",
    checkUpdate: true
  }
];
