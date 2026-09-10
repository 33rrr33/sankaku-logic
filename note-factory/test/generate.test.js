'use strict';

// 依存ゼロの簡易テスト。`npm test` で実行。
const assert = require('assert');
const { generate, themes, frameworks } = require('../src/generate');

let passed = 0;
function ok(name, fn) {
  fn();
  passed++;
  console.log('  ✓', name);
}

console.log('日刊ロジック100円文庫 — テスト');

ok('同じ日付なら完全に同じ記事（決定的）', () => {
  const a = generate('2026-01-15');
  const b = generate('2026-01-15');
  assert.strictEqual(a.title, b.title);
  assert.strictEqual(a.bodyMarkdown, b.bodyMarkdown);
});

ok('価格は必ず100円', () => {
  for (const d of ['2025-03-01', '2026-07-07', '2030-12-31']) {
    assert.strictEqual(generate(d).price, 100);
  }
});

ok('タイトル・本文が空でない', () => {
  const n = generate('2026-09-10');
  assert.ok(n.plainTitle.length > 5);
  assert.ok(n.bodyMarkdown.length > 300);
});

ok('有料ラインの区切りが本文に含まれる', () => {
  const n = generate('2026-09-10');
  assert.ok(n.bodyMarkdown.includes('有料'));
});

ok('連続する30日でテーマ×型の組み合わせが十分ばらける', () => {
  const seen = new Set();
  const base = Date.parse('2026-01-01T00:00:00Z');
  for (let i = 0; i < 30; i++) {
    const d = new Date(base + i * 86400000).toISOString().slice(0, 10);
    const n = generate(d);
    seen.add(n.theme + '|' + n.framework);
  }
  // 30日でほぼ全て別の組み合わせになるはず
  assert.ok(seen.size >= 25, `variety too low: ${seen.size}`);
});

ok('全テーマが型に流し込んでもエラーにならない', () => {
  for (const t of themes) {
    for (const f of frameworks) {
      const md = f.build(t);
      assert.ok(md.length > 10);
      assert.ok(!md.includes('undefined'));
    }
  }
});

ok('素材バンクの必須フィールドが揃っている', () => {
  for (const t of themes) {
    for (const key of ['claim', 'weak', 'warrant', 'objection', 'rebuttal']) {
      assert.ok(typeof t[key] === 'string' && t[key].length, `${t.id}.${key}`);
    }
    assert.ok(Array.isArray(t.data) && t.data.length >= 2, `${t.id}.data`);
  }
});

console.log(`\n✅ ${passed} テスト全て成功`);
