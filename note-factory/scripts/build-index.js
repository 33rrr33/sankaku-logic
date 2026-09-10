#!/usr/bin/env node
'use strict';

// notes/index.json から、発行済み号を一覧するシンプルな index.html を作る。
// GitHub Pages 等でそのまま「発行アーカイブ」として公開できる。

const fs = require('fs');
const path = require('path');

const NOTES_DIR = path.join(__dirname, '..', 'notes');
const INDEX_JSON = path.join(NOTES_DIR, 'index.json');
const OUT = path.join(NOTES_DIR, 'index.html');

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function main() {
  let index = { publisher: '日刊ロジック100円文庫', price: 100, issues: [] };
  try {
    index = JSON.parse(fs.readFileSync(INDEX_JSON, 'utf8'));
  } catch {
    console.log('index.json がまだありません。先に `npm run build` してください。');
  }

  const rows = index.issues
    .map(
      (e) => `      <li class="issue">
        <a href="./${esc(path.basename(e.file))}"><span class="date">${esc(e.date)}</span>
        <span class="title">${esc(e.title)}</span></a>
        <span class="meta">¥${esc(e.price)} ・ ${e.posted_to_note ? '✅note投稿済' : '📝下書き'}</span>
      </li>`
    )
    .join('\n');

  const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(index.publisher)}｜発行アーカイブ</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: system-ui, "Hiragino Sans", "Noto Sans JP", sans-serif;
         max-width: 760px; margin: 0 auto; padding: 24px 16px; line-height: 1.7; }
  h1 { font-size: 1.5rem; margin-bottom: 0; }
  .lead { color: #888; margin-top: 4px; }
  ul { list-style: none; padding: 0; }
  .issue { border-bottom: 1px solid #8883; padding: 12px 0; }
  .issue a { text-decoration: none; color: inherit; display: block; }
  .issue a:hover .title { text-decoration: underline; }
  .date { display: inline-block; font-variant-numeric: tabular-nums;
          color: #e4405f; font-weight: 700; margin-right: 8px; }
  .title { font-weight: 600; }
  .meta { font-size: .85rem; color: #999; }
  footer { margin-top: 32px; color: #999; font-size: .85rem; }
</style>
</head>
<body>
  <h1>📰 ${esc(index.publisher)}</h1>
  <p class="lead">100円noteを1日1本、自動で作り続ける全自動出版社 ／ 全 ${index.issues.length} 号</p>
  <ul>
${rows || '      <li>まだ発行された号はありません。</li>'}
  </ul>
  <footer>最終更新: ${esc(index.updated_at || '-')}</footer>
</body>
</html>
`;
  fs.writeFileSync(OUT, html, 'utf8');
  console.log(`✅ 生成: ${OUT}（${index.issues.length}号）`);
}

main();
