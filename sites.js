// 掲載サイトの一覧です。
// サイトを足す・直すときは、このファイルだけを書きかえれば、トップページのカードと件数に反映されます。
// カードは「サイト名 → 画面例 → 問いかけ → 説明 → サイトを見る」の順に並びます。
//
// category … どの分類に載せるか（research＝調べる・比較する／learn＝わかりやすく学ぶ／participate＝声を届ける・参加する）
//            この一覧の順番が、そのままカードの並び順になります
// q        … 興味を引く短い問いかけ（1文）
// desc     … そのサイトで具体的に何を検索・比較・確認できるか（1〜2文）。変わる件数は書かない
// shot     … 実際の画面の写真（img/shots/ に置いた 800×450 の WebP）
// alt      … 画面の写真の説明（画面が見えない人に読み上げられる文）
// highlight … 見どころをひとこと（なくてもよい）
// pair     … 「詳しく調べる版」と「図で学ぶ版」をつなぐ案内（相手の id と、案内の言葉）
// checkUpdate … true にすると、そのサイトのページ更新日を読み取って表示します
//               （読み取れるのは yumaki5555.github.io のサイトだけです）
// operator … ほかの方が運営しているサイトの、運営者の名前と X（旧Twitter）のアドレス

window.SITES = [
  {
    id: "policy-log",
    category: "research",
    name: "政策ログJP",
    url: "https://policy-log.jp/",
    q: "国の政策や法案は、今どこまで進んでいる？",
    desc: "法案を「検討中・審議中・成立」などの段階や、省庁・テーマから探せます。閣議決定や国会の動きも時系列で追えます。",
    shot: "img/shots/policy-log.webp",
    alt: "政策ログJPのトップ画面。追跡中・審議中・成立などの法案の数と、意見募集・法案の今・機関で探すのメニューが並んでいる",
    operator: { name: "Policy-log.jpさん", x: "https://x.com/watermark_hd1" }
  },
  {
    id: "mou-map",
    category: "research",
    name: "日本と世界のMOU・協定マップ",
    url: "https://yumaki5555.github.io/mou-map/",
    q: "日本の国や自治体は、海外とどんな約束をしている？",
    desc: "海外とのMOU・協定を、日本地図や相手国・分野から検索。取り決めの内容、地域への影響、有効・終了・未確認の状況を調べられます。",
    shot: "img/shots/mou-map.webp",
    alt: "MOU・協定マップの画面。キーワードで探す検索欄と、登録した協定の数を都道府県ごとに色分けした日本地図",
    highlight: "「まず3分でわかる」：5つの図でMOUの仕組みを解説",
    checkUpdate: true
  },
  {
    id: "zititai-karte",
    category: "research",
    name: "自治体カルテ",
    url: "https://www.zititai-karte.com/",
    q: "自分のまちのお金は、どこから入り、何に使われている？",
    desc: "自治体名で検索して、歳入・歳出の内訳や人口の推移をグラフで確認。全国ランキングや、最大3自治体の比較もできます。",
    shot: "img/shots/zititai-karte.webp",
    alt: "自治体カルテの全国ランキング画面。自治体ごとの歳出総額を横棒グラフで並べている",
    operator: { name: "自治体カルテさん", x: "https://x.com/zititai_karte" }
  },
  {
    id: "zairyu",
    category: "research",
    name: "数でみる在留外国人",
    url: "https://yumaki5555.github.io/zairyu/index.html",
    q: "日本に住む外国人は、どこに、どの国から来ている？",
    desc: "都道府県・市区町村・国籍・在留資格から人数を検索。1959年からの移り変わりを、地図の色の変化で再生して見られます。",
    shot: "img/shots/zairyu.webp",
    alt: "数でみる在留外国人の画面。都道府県ごとの在留外国人の数を、色の濃さで表した日本地図",
    checkUpdate: true,
    pair: { id: "zairyu-guide", label: "まずは図で知りたい方はこちら" }
  },
  {
    id: "minpaku-map",
    category: "research",
    name: "民泊・旅館業マップ",
    url: "https://yumaki5555.github.io/minpaku-map/",
    q: "近所に、民泊やホテルはどれだけある？",
    desc: "住所や市区町村名で探して、民泊・旅館業の施設を地図上の点で確認。市区町村ごとの件数ランキングや、前回からの増減も見られます。",
    shot: "img/shots/minpaku-map.webp",
    alt: "民泊・旅館業マップの画面。東京都心の地図に、民泊・特区民泊・旅館やホテル・簡易宿所の施設が色分けした点で表示されている",
    checkUpdate: true
  },
  {
    id: "mosque-map",
    category: "research",
    name: "日本のモスク情報",
    url: "https://yumaki5555.github.io/mosque-map/",
    q: "モスクは、どこにあり、だれが運営している？",
    desc: "地図や都道府県からモスク・礼拝所を探し、運営団体や建設計画、寄付の募集、葬儀・土葬墓地の調査結果を出典付きで確認できます。",
    shot: "img/shots/mosque-map.webp",
    alt: "日本のモスク情報の地図画面。日本地図にモスク・礼拝所の位置がピンで示され、右側に施設の一覧が並んでいる",
    checkUpdate: true,
    pair: { id: "mosque-guide", label: "まずは図で知りたい方はこちら" }
  },
  {
    id: "kansensho",
    category: "research",
    name: "世界の感染症と日本の水際対策",
    url: "https://yumaki5555.github.io/kansensho/",
    q: "HIV・梅毒・はしか・結核は、どの国で多い？",
    desc: "国別の感染状況をグラフで比べ、国や在留資格から入国時の検査を確認。日本の患者数の推移や治療費の負担も見られます。",
    shot: "img/shots/kansensho.webp",
    alt: "世界の感染症と日本の水際対策の国別比較画面。国ごとの結核の罹患率を横棒グラフで比べている",
    highlight: "「まず3分でわかる」：結核編・HIV/エイズ編",
    checkUpdate: true
  },
  {
    id: "mosque-guide",
    category: "learn",
    name: "日本のモスクを知る",
    url: "https://mosque-info-explorer.sunlitmole256.chatgpt.site/",
    q: "モスクってどんな場所？ 日本のどこにある？",
    desc: "地図やテーマ別の図解で、モスクの場所や運営する団体をやさしく紹介。好きなテーマを選んで10問のクイズにも挑戦できます。",
    shot: "img/shots/mosque-guide.webp",
    alt: "日本のモスクを知るの画面。都道府県を四角で並べた地図に、それぞれのモスクの数が書かれている",
    pair: { id: "mosque-map", label: "詳しく調べたい方はこちら" }
  },
  {
    id: "zairyu-guide",
    category: "learn",
    name: "図で見る、日本に住む外国人",
    url: "https://nihon-kurashi-zairyu-guide.sunlitmole256.chatgpt.site/",
    q: "日本に住む外国人は、どんな目的でくらしている？",
    desc: "仕事・家族・永住などの在留資格を、円グラフや「100人に置きかえた図」で紹介。年ごとの変化や地域の比較、クイズもあります。",
    shot: "img/shots/zairyu-guide.webp",
    alt: "図で見る、日本に住む外国人の画面。外国人全体のうち、仕事・技能実習の資格の人の割合を示す円グラフ",
    pair: { id: "zairyu", label: "詳しく調べたい方はこちら" }
  },
  {
    id: "pubcome",
    category: "participate",
    name: "パブコメ掲示板",
    url: "https://yumaki5555.github.io/pubcome/",
    q: "いま、国や自治体はどんな意見を募集している？",
    desc: "国・都道府県・市区町村の募集中の案件を、キーワードや担当省庁で検索。締切が近い順に並べ、公式の提出先へ進めます。",
    shot: "img/shots/pubcome.webp",
    alt: "パブコメ掲示板の画面。国・都道府県・市区町村の切りかえと、キーワード・担当省庁・テーマで案件を探す検索欄",
    checkUpdate: true
  },
  {
    id: "shomei",
    category: "participate",
    name: "署名掲示板",
    url: "https://yumaki5555.github.io/shomei/",
    q: "全国で、いまどんな署名が集まっている？",
    desc: "change.orgとVoiceの署名を、キーワードや都道府県で検索。署名が多い順・最近伸びている順・終了日が近い順に並べ替えられます。",
    shot: "img/shots/shomei.webp",
    alt: "署名掲示板の画面。キーワード・テーマ・地域・並び順で署名を探す検索欄",
    checkUpdate: true
  }
];
