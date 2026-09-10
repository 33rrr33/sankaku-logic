# 日刊ロジック100円文庫 🏭

**100円noteを1日1本、勝手に出し続ける全自動出版社。**
外部APIキー不要・課金ゼロ。素材バンク × 日付シードで、毎日ちがう100円noteを生成し続けます。

会社の全体像は [COMPANY.md](./COMPANY.md) を参照してください。

---

## クイックスタート

```bash
cd note-factory

# 今日の号を画面でプレビュー（何も書き込まない）
npm run today

# 指定日をプレビュー
npm run preview 2026-12-25

# 今日の号を notes/ に発行（アーカイブ）
npm run build            # 今日(JST)
npm run build 2026-12-25 # 指定日

# 発行済み一覧
npm run list

# 発行アーカイブの index.html を再生成
npm run index

# テスト（依存ゼロ）
npm test
```

> Node.js 18 以上が必要です。生成・発行だけなら `npm install` すら不要（依存パッケージなし）。

## 仕組み

```
note-factory/
├── src/
│   ├── generate.js        … 中核。日付 → その日の100円note（決定的）
│   ├── rng.js             … 日付から再現可能な擬似乱数
│   ├── cli.js             … today / preview / build / list
│   ├── bank/              … 素材バンク（ここを増やすほど中身が豊かに）
│   │   ├── frameworks.js  …   論理の型（三角ロジック・PREP・反論処理 …）
│   │   ├── themes.js      …   身近な論題（主張・データ・論拠・想定反論 …）
│   │   └── snippets.js    …   タイトル/導入/締め/練習問題のバリエーション
│   └── publish/
│       └── note-publisher.js … note.com 自動投稿（任意・opt-in）
├── scripts/build-index.js … 発行アーカイブの index.html を生成
├── notes/                 … 発行済みの号（YYYY-MM-DD.md）＋ index.json / index.html
└── test/                  … 決定性・品質のテスト
```

- **決定的**：同じ日付なら必ず同じ号。だから「1日1本」がブレません。
- **在庫**：テーマ × 型 の組み合わせを通し番号で巡回するので、当分のあいだ同じ号は出ません。
- **中身を増やす**：`src/bank/themes.js` にテーマを足すだけで、翌日以降の多様性が自動で増えます。

## 自動運転（GitHub Actions）

`.github/workflows/daily-note.yml` が毎朝 **07:00 JST** に：

1. その日の号を生成し、
2. `note-factory/notes/` にコミット（＝アーカイブとして発行）します。

これは外部依存ゼロなので、**マージすれば即・毎日勝手に発行**が始まります。
手動で走らせたいときは Actions タブの「Run workflow」から。

## note.com への自動投稿（任意・自己責任）

> ⚠️ **重要**：note.com に公式の投稿APIはありません。ここでの「完全自動投稿」は
> Playwright によるブラウザ自動操作で、note の利用規約上グレー〜NGになり得ます。
> **アカウント停止リスクを理解のうえ、自己責任で**。既定では安全弁により何も投稿しません。

### 1. ローカルでログイン状態を1回だけ保存

```bash
cd note-factory
npm install playwright        # 初回のみ
npx playwright install chromium
npm run note:login            # ブラウザが開くので手動ログイン → Enter
# → src/publish/.note-state.json が作られる
```

### 2. まずは下書き保存で試す（安全弁を外す）

```bash
NOTE_AUTOMATION=1 npm run note:post            # 今日の号を下書き保存まで
NOTE_AUTOMATION=1 npm run note:post 2026-12-25 # 指定日
```

`NOTE_AUTOMATION=1` が無い限り、必ず **DRY-RUN（何もしない）** で止まります。

### 3. 公開まで自動化する（さらに自己責任）

```bash
NOTE_AUTOMATION=1 NOTE_PUBLISH=1 npm run note:post
```

有料設定（¥100）と公開の導線は note のUI変更に非常に弱い部分です。
まず下書きが正しく作れることを確認し、価格・公開はUIに追随して調整してください。

### 4. CIで自動投稿する場合

1. `note-factory/src/publish/.note-state.json` の中身を、リポジトリシークレット
   `NOTE_STATE_JSON` に丸ごと登録。
2. リポジトリ変数 `ENABLE_NOTE_AUTOPOST` を `true` に。
3. 公開まで自動化するなら変数 `NOTE_PUBLISH` を `1` に（下書き止まりなら未設定でOK）。

これで毎朝、生成 → アーカイブ → note投稿まで自動で回ります（安定性は保証されません）。

## よくある質問

- **本当に無料で回る？** はい。生成・アーカイブ発行はパッケージ依存ゼロ・API課金ゼロ。
- **中身がワンパターンにならない？** テーマ27 × 型7 の巡回＋タイトル/導入のバリエーションで、
  数か月は同じ号が出ません。テーマを足せばさらに伸びます。
- **noteに自動で"公開"までできる？** 技術的には試みますが、公式APIが無いため不安定＆規約リスクあり。
  安全に運用したいなら「自動生成＋アーカイブ」までを推奨します。
