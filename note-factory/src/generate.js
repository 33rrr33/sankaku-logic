'use strict';

// ============================================================================
//  日刊ロジック100円文庫 — 記事ジェネレーター
//  「1日1本」を決定的（同じ日付なら同じ記事）に生成する中核。
//  外部APIは一切使わない。素材バンク × 日付シードの組み合わせで作る。
// ============================================================================

const { seededRandom, pick, dayIndex } = require('./rng');
const frameworks = require('./bank/frameworks');
const themes = require('./bank/themes');
const snip = require('./bank/snippets');

const PRICE = 100; // 円
const PUBLISHER = '日刊ロジック100円文庫';

function fill(tpl, map) {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => (k in map ? map[k] : `{${k}}`));
}

// 日付 (YYYY-MM-DD) から、その日の記事オブジェクトを生成する
function generate(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error(`日付は YYYY-MM-DD 形式で指定してください: ${dateStr}`);
  }
  const rand = seededRandom(dateStr);
  const n = dayIndex(dateStr); // 通し番号（負にもなり得る）

  // テーマと型を、それぞれ通し番号で独立に回す。
  // テーマ数(27)と型数(7)は互いに素なので、(n%27, n%7) の組は
  // 189日かけて全組み合わせを重複なく巡回し、かつ「毎日どちらも変わる」。
  const T = themes.length;
  const F = frameworks.length;
  const theme = themes[((n % T) + T) % T];
  const fw = frameworks[((n % F) + F) % F];

  // 表層（タイトル・導入・締めなど）は日付シードで選ぶ
  const map = { theme: theme.title, framework: fw.name, field: theme.field };
  const title = fill(pick(rand, snip.titlePatterns), map);
  const subtitle = pick(rand, snip.subtitlePatterns);
  const hook = pick(rand, snip.hooks);
  const closing = pick(rand, snip.closings);
  const deepDive = pick(rand, snip.deepDives);
  const deepTip = pick(rand, snip.deepTips);
  const drill = pick(rand, snip.drillPatterns);

  const zukai = fw.zukai.join('\n');
  const after = fw.build(theme);
  const stepsMd = fw.steps.map((s) => `- ${s}`).join('\n');
  const drillQ = fill(drill.q, { weak: theme.weak, claim: theme.claim });

  // 「売れる要素」を人間が足すための記入欄（投稿前に書き換える前提）
  const claimShort = theme.claim.replace(/[。．]$/, '');
  const personalizeMd = snip.personalizeBlocks
    .map((b) => `## ${b.heading}\n\n${fill(b.prompt, { claimShort })}`)
    .join('\n\n');

  // ----- 本文（無料パート） --------------------------------------------------
  const freeBody = [
    `> ${subtitle}`,
    '',
    hook,
    '',
    `きょうのテーマは **「${theme.title}」**。`,
    `使う道具は、論理の型のひとつ **${fw.name}** です。`,
    `${fw.tagline}。`,
    '',
    '## 今日学ぶ型',
    '',
    `**${fw.name}**`,
    '',
    '```',
    zukai,
    '```',
    '',
    `👉 **どんなとき使う？** ${fw.when}`,
  ].join('\n');

  // ----- 本文（有料パート） --------------------------------------------------
  const paidBody = [
    '',
    '## Before → After：弱い一言を、型で組み直す',
    '',
    '**Before（型を知らない言い方）**',
    '',
    `> ${theme.weak}`,
    '',
    '**After（' + fw.name + 'で組み直した言い方）**',
    '',
    after,
    '',
    'いかがでしょう。中身は同じでも、「並べ方」を変えるだけで、ぐっと手渡しやすくなったはずです。',
    '',
    '## 使い方 3ステップ',
    '',
    stepsMd,
    '',
    '## やりがちな失敗',
    '',
    `⚠️ ${fw.mistake}`,
    '',
    '## もう一歩踏み込む',
    '',
    deepDive,
    '',
    deepTip,
    '',
    personalizeMd,
    '',
    '## 今日の練習問題',
    '',
    drillQ,
    '',
    drill.hint,
    '',
    '---',
    '',
    closing,
    '',
    `*——「${PUBLISHER}」は、論理的に考え・伝えるための型を、毎日ひとつお届けしています。*`,
  ].join('\n');

  const bodyMarkdown = freeBody + '\n\n<!-- ここから有料（¥' + PRICE + '）ライン -->\n' + paidBody;

  // タグ（テーマ由来＋固定）
  const tags = Array.from(new Set([...theme.tags, '論理的思考', '三角ロジック', '毎日note']));

  return {
    date: dateStr,
    number: n, // 通し番号（第n号の素）
    title,
    price: PRICE,
    publisher: PUBLISHER,
    theme: theme.id,
    framework: fw.id,
    tags,
    freeMarkdown: freeBody,
    paidMarkdown: paidBody,
    bodyMarkdown,
    // note貼り付け用のプレーンタイトル（【】等は残す）
    plainTitle: title,
    // 投稿前チェックリスト（人間が5分で足す作業の手引き）
    checklist: snip.preflightChecklist,
  };
}

module.exports = { generate, PRICE, PUBLISHER, themes, frameworks };
