'use strict';

// 日付から決定的（再現可能）な擬似乱数を作るためのユーティリティ。
// 同じ日付なら必ず同じ記事が生成される = 「1日1本」を保証する仕組みの土台。

// xmur3: 文字列 -> 32bit seed
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

// mulberry32: seed -> [0,1) の擬似乱数列
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 日付文字列 (YYYY-MM-DD) などから決定的な乱数関数を返す
function seededRandom(seedStr) {
  const seed = xmur3(String(seedStr))();
  return mulberry32(seed);
}

// 便利関数群 --------------------------------------------------------------
function pick(rand, arr) {
  return arr[Math.floor(rand() * arr.length)];
}

function shuffle(rand, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 通し番号（基準日からの経過日数）
function dayIndex(dateStr, epoch = '2025-01-01') {
  const d = Date.parse(dateStr + 'T00:00:00Z');
  const e = Date.parse(epoch + 'T00:00:00Z');
  return Math.floor((d - e) / 86400000);
}

module.exports = { seededRandom, pick, shuffle, dayIndex, xmur3, mulberry32 };
