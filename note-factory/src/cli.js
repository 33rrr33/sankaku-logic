#!/usr/bin/env node
'use strict';

// ============================================================================
//  日刊ロジック100円文庫 — 社内オペレーションCLI
//
//   node src/cli.js today                 … 今日の号をプレビュー表示
//   node src/cli.js preview [YYYY-MM-DD]  … 指定日の号をプレビュー表示
//   node src/cli.js build   [YYYY-MM-DD]  … 指定日の号を notes/ に発行（アーカイブ）
//   node src/cli.js list                  … 発行済みの号を一覧
// ============================================================================

const fs = require('fs');
const path = require('path');
const { generate, PRICE, PUBLISHER } = require('./generate');

const NOTES_DIR = path.join(__dirname, '..', 'notes');
const INDEX_PATH = path.join(NOTES_DIR, 'index.json');

// JST(Asia/Tokyo)での「今日」の日付文字列を返す
function todayJST() {
  const now = new Date(Date.now() + 9 * 3600 * 1000); // UTC+9
  return now.toISOString().slice(0, 10);
}

function ensureDir() {
  fs.mkdirSync(NOTES_DIR, { recursive: true });
}

function renderPlain(note) {
  const line = '─'.repeat(60);
  return [
    line,
    `📰 ${PUBLISHER}`,
    `📅 ${note.date}（第${note.number}号相当）`,
    `💴 価格: ¥${note.price}`,
    `🏷  ${note.tags.map((t) => '#' + t).join(' ')}`,
    line,
    '',
    `# ${note.plainTitle}`,
    '',
    note.bodyMarkdown,
    '',
    line,
  ].join('\n');
}

// front-matter付きのMarkdownファイルの中身
function renderFileContent(note) {
  const fm = [
    '---',
    `title: "${note.plainTitle.replace(/"/g, '\\"')}"`,
    `date: ${note.date}`,
    `number: ${note.number}`,
    `price: ${note.price}`,
    `publisher: "${PUBLISHER}"`,
    `theme: ${note.theme}`,
    `framework: ${note.framework}`,
    `tags: [${note.tags.map((t) => JSON.stringify(t)).join(', ')}]`,
    'status: draft',
    'posted_to_note: false',
    '---',
    '',
  ].join('\n');
  const checklist = '<!--\n' + note.checklist.join('\n') + '\n-->\n\n';
  return fm + checklist + `# ${note.plainTitle}\n\n` + note.bodyMarkdown + '\n';
}

// note貼り付け用のクリーンテキスト（front-matter無し・チェックリストは別表示）
function renderPaste(note) {
  const line = '━'.repeat(56);
  return [
    line,
    `📋 noteに貼り付ける前に、まずこの3つを5分で（← 売れる分かれ目）`,
    line,
    note.checklist.join('\n'),
    '',
    `${line}\n📝 ここから下をコピーして note の下書きに貼る\n${line}`,
    '',
    note.plainTitle,
    '',
    note.bodyMarkdown.replace(/<!--.*?-->/g, '（↑ここまで無料 / ここから有料¥100）'),
    '',
    line,
    `🏷 タグ候補: ${note.tags.map((t) => '#' + t).join(' ')}   💴 価格: ¥${note.price}`,
    line,
  ].join('\n');
}

function loadIndex() {
  try {
    return JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  } catch {
    return { publisher: PUBLISHER, price: PRICE, issues: [] };
  }
}

function build(dateStr) {
  ensureDir();
  const note = generate(dateStr);
  const file = path.join(NOTES_DIR, `${dateStr}.md`);
  const isNew = !fs.existsSync(file);
  fs.writeFileSync(file, renderFileContent(note), 'utf8');

  // manifest 更新
  const index = loadIndex();
  const entry = {
    date: note.date,
    number: note.number,
    title: note.plainTitle,
    theme: note.theme,
    framework: note.framework,
    price: note.price,
    tags: note.tags,
    file: `notes/${dateStr}.md`,
    posted_to_note: false,
  };
  const i = index.issues.findIndex((e) => e.date === note.date);
  if (i >= 0) index.issues[i] = { ...index.issues[i], ...entry };
  else index.issues.push(entry);
  index.issues.sort((a, b) => (a.date < b.date ? 1 : -1)); // 新しい順
  index.updated_at = new Date().toISOString();
  fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2) + '\n', 'utf8');

  return { note, file, isNew };
}

function list() {
  const index = loadIndex();
  if (!index.issues.length) {
    console.log('まだ発行された号はありません。`node src/cli.js build` で発行してください。');
    return;
  }
  console.log(`📚 ${PUBLISHER} — 発行済み ${index.issues.length} 号\n`);
  for (const e of index.issues) {
    const mark = e.posted_to_note ? '✅note投稿済' : '📝下書き';
    console.log(`  ${e.date}  ¥${e.price}  ${mark}  ${e.title}`);
  }
}

function main() {
  const [, , cmd, arg] = process.argv;
  switch (cmd) {
    case undefined:
    case 'today': {
      console.log(renderPlain(generate(todayJST())));
      break;
    }
    case 'preview': {
      const date = arg || todayJST();
      console.log(renderPlain(generate(date)));
      break;
    }
    case 'paste': {
      // note に貼り付ける用のクリーン出力＋投稿前チェックリスト
      const date = arg || todayJST();
      console.log(renderPaste(generate(date)));
      break;
    }
    case 'build': {
      const date = arg || todayJST();
      const { note, file, isNew } = build(date);
      console.log(`${isNew ? '🆕 発行' : '♻️  再生成'}: ${file}`);
      console.log(`   タイトル: ${note.plainTitle}`);
      console.log(`   価格: ¥${note.price} / タグ: ${note.tags.join(', ')}`);
      break;
    }
    case 'list':
      list();
      break;
    default:
      console.error(`不明なコマンド: ${cmd}`);
      console.error('使い方: today | preview [date] | paste [date] | build [date] | list');
      process.exit(1);
  }
}

if (require.main === module) main();

module.exports = { build, todayJST, renderFileContent, renderPlain };
