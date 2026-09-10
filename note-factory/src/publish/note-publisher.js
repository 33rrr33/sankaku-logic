#!/usr/bin/env node
'use strict';

// ============================================================================
//  note.com 自動投稿ドライバ（best-effort / opt-in）
// ============================================================================
//  ⚠️ 重要な前提
//   - note.com には「公式の投稿API」が存在しません。よってこの投稿は
//     Playwright によるブラウザ自動操作（UIの自動入力）で行います。
//   - これは note の利用規約でグレー〜NGになり得ます。アカウント停止の
//     リスクを理解したうえで、自己責任で利用してください。
//   - note 側のUI変更でセレクタは容易に壊れます（=不安定）。壊れたら
//     このファイルのセレクタを実DOMに合わせて直す前提の「叩き台」です。
//   - 既定は **DRY-RUN（下書き保存も投稿もしない）**。実際に動かすには
//     環境変数で明示的に有効化します。
//
//  環境変数
//   NOTE_AUTOMATION=1     … これが無いと必ずDRY-RUNで止まる（安全弁）
//   NOTE_STATE_FILE=path  … 事前ログイン済みの storageState(JSON)。推奨。
//                           （下記 `login` サブコマンドで生成できる）
//   NOTE_EMAIL / NOTE_PASSWORD … state が無い場合のログイン情報（非推奨）
//   NOTE_PUBLISH=1        … 付けると「公開」まで実行。無ければ下書き保存止まり。
//   NOTE_HEADFUL=1        … ブラウザを画面表示（ローカルデバッグ用）
//
//  使い方
//   node src/publish/note-publisher.js login            … 手動ログインしてstate保存
//   node src/publish/note-publisher.js post [YYYY-MM-DD] … その日の号を投稿
//   node src/publish/note-publisher.js post --file path.md
// ============================================================================

const fs = require('fs');
const path = require('path');
const { generate } = require('../generate');

const STATE_FILE = process.env.NOTE_STATE_FILE || path.join(__dirname, '.note-state.json');
const HEADFUL = process.env.NOTE_HEADFUL === '1';
const CHROMIUM_PATH = process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined;

function todayJST() {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

function loadPlaywright() {
  try {
    return require('playwright');
  } catch (e) {
    console.error('playwright が見つかりません。`npm install` を実行してください。');
    throw e;
  }
}

function launchOpts() {
  const opts = { headless: !HEADFUL };
  if (CHROMIUM_PATH) opts.executablePath = CHROMIUM_PATH;
  return opts;
}

// --- 手動ログインして storageState を保存（ローカルで1回だけ実行）--------------
async function login() {
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ ...launchOpts(), headless: false });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto('https://note.com/login', { waitUntil: 'domcontentloaded' });
  console.log('▶ ブラウザで note にログインしてください。');
  console.log('  ログインが完了して自分のホームが見えたら、このターミナルで Enter を押してください。');
  await new Promise((resolve) => process.stdin.once('data', resolve));
  await ctx.storageState({ path: STATE_FILE });
  console.log(`✅ ログイン状態を保存しました: ${STATE_FILE}`);
  await browser.close();
}

async function makeContext(browser) {
  if (fs.existsSync(STATE_FILE)) {
    return browser.newContext({ storageState: STATE_FILE });
  }
  const ctx = await browser.newContext();
  const email = process.env.NOTE_EMAIL;
  const password = process.env.NOTE_PASSWORD;
  if (!email || !password) {
    throw new Error(
      'ログイン情報がありません。NOTE_STATE_FILE を用意するか、NOTE_EMAIL / NOTE_PASSWORD を設定してください。'
    );
  }
  const page = await ctx.newPage();
  await page.goto('https://note.com/login', { waitUntil: 'domcontentloaded' });
  // note のログインフォーム（変わりやすいので複数候補を試す）
  await page.fill('input[type="email"], input[name="email"]', email);
  await page.fill('input[type="password"], input[name="password"]', password);
  await Promise.all([
    page.waitForLoadState('networkidle').catch(() => {}),
    page.click('button[type="submit"], button:has-text("ログイン")'),
  ]);
  await page.close();
  return ctx;
}

// --- 記事本文の組み立て（noteエディタに貼る用のプレーンテキスト）--------------
function noteBodyText(note) {
  // note のエディタはMarkdownをそのままレンダリングしないため、
  // 記号を軽く整えたプレーンテキストで流し込む。
  return note.bodyMarkdown
    .replace(/^#+\s*/gm, '') // 見出し記号を除去（noteでは見出しは別途装飾）
    .replace(/\*\*(.+?)\*\*/g, '$1') // 太字マークを除去
    .replace(/^>\s?/gm, '') // 引用記号を除去
    .replace(/<!--.*?-->/g, '') // HTMLコメント（有料ライン印）を除去
    .trim();
}

// --- 投稿（best-effort）-----------------------------------------------------
async function post(dateOrFile) {
  const automation = process.env.NOTE_AUTOMATION === '1';
  const doPublish = process.env.NOTE_PUBLISH === '1';

  let note;
  if (dateOrFile && dateOrFile.endsWith('.md')) {
    // ファイルからは front-matter を無視して本文再生成が難しいので日付から作る運用を推奨。
    // ここでは簡易に：ファイル名の日付を使う。
    const base = path.basename(dateOrFile, '.md');
    note = generate(base);
  } else {
    note = generate(dateOrFile || todayJST());
  }

  console.log('──────────────────────────────────────────');
  console.log(`📰 投稿対象: ${note.date}`);
  console.log(`   タイトル: ${note.plainTitle}`);
  console.log(`   価格: ¥${note.price}`);
  console.log(`   モード: ${automation ? (doPublish ? '公開' : '下書き保存') : 'DRY-RUN（何もしない）'}`);
  console.log('──────────────────────────────────────────');

  if (!automation) {
    console.log('ℹ️ NOTE_AUTOMATION=1 が無いため、安全弁によりここで停止します（DRY-RUN）。');
    console.log('   実際に note を操作するには、リスクを理解のうえ NOTE_AUTOMATION=1 を設定してください。');
    return { dryRun: true, note };
  }

  const { chromium } = loadPlaywright();
  const browser = await chromium.launch(launchOpts());
  try {
    const ctx = await makeContext(browser);
    const page = await ctx.newPage();

    // 新規記事エディタへ
    await page.goto('https://note.com/notes/new', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    // タイトル入力（プレースホルダ「記事タイトル」等。UIは変わりやすい）
    const titleSel = [
      'textarea[placeholder*="タイトル"]',
      'input[placeholder*="タイトル"]',
      '[data-testid="note-title"]',
    ].join(', ');
    await page.waitForSelector(titleSel, { timeout: 15000 });
    await page.click(titleSel);
    await page.type(titleSel, note.plainTitle, { delay: 5 });

    // 本文入力（contenteditable の本文エリア）
    const bodySel = [
      'div[contenteditable="true"]',
      '[data-testid="note-body"]',
      '.ProseMirror',
    ].join(', ');
    await page.waitForSelector(bodySel, { timeout: 15000 });
    await page.click(bodySel);
    // 段落ごとに Enter で流し込む
    for (const line of noteBodyText(note).split('\n')) {
      await page.keyboard.type(line, { delay: 2 });
      await page.keyboard.press('Enter');
    }

    // デバッグ用スクショ
    const shot = path.join(__dirname, `.last-post-${note.date}.png`);
    await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
    console.log(`🖼  スクリーンショット: ${shot}`);

    // 価格設定 & 公開はUI依存が強いためbest-effort。
    // note の「公開設定」→「有料」→ 価格入力 → 公開 の導線は頻繁に変わるため、
    // ここでは自動化を試みつつ、失敗しても下書きは残す方針。
    console.log('⚠️ 有料設定(¥100)と公開の自動化は note のUI変更に非常に弱い部分です。');
    console.log('   まずは下書きが正しく作られるかを確認し、価格・公開は必要に応じて手動/追調整してください。');

    if (doPublish) {
      // 「公開に進む」ボタン等の候補を試す（見つからなければスキップ）
      const publishBtn = page.locator('button:has-text("公開に進む"), button:has-text("公開")').first();
      if (await publishBtn.count()) {
        await publishBtn.click().catch(() => {});
        await page.waitForTimeout(2000);
        console.log('▶ 公開フローに進みました（価格設定の最終確認はUIに従ってください）。');
      } else {
        console.log('ℹ️ 公開ボタンが見つかりませんでした。下書きとして保存された想定です。');
      }
    } else {
      // note はエディタ上で自動的に下書き保存される
      await page.waitForTimeout(2000);
      console.log('💾 下書きとして保存された想定です（自動保存）。');
    }

    return { dryRun: false, note, screenshot: shot };
  } finally {
    await browser.close();
  }
}

async function main() {
  const [, , cmd, arg] = process.argv;
  try {
    if (cmd === 'login') {
      await login();
    } else if (cmd === 'post' || cmd === undefined) {
      const fileArg = process.argv.includes('--file')
        ? process.argv[process.argv.indexOf('--file') + 1]
        : arg;
      await post(fileArg);
    } else {
      console.error('使い方: login | post [YYYY-MM-DD] | post --file <path.md>');
      process.exit(1);
    }
  } catch (e) {
    console.error('❌ エラー:', e.message);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = { post, login, noteBodyText };
