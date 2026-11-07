// Jalankan: node test.mjs  (Node >= 18; tanpa dependensi)
import assert from 'node:assert/strict';
import { createInitialState, playRound, resetState, describeRound, CHOICES } from './game.mjs';

const ERR = 'Ronde belum diproses. Pilih lagi.';
const total = (s) => s.scores.menang + s.scores.kalah + s.scores.seri;
const deepFreeze = (o) => { Object.values(o).forEach((v) => v && typeof v === 'object' && deepFreeze(v)); return Object.freeze(o); };
const fixed = (...ns) => { const q = [...ns]; let calls = 0; const f = () => { calls++; return q.shift(); }; f.calls = () => calls; return f; };

// 9 pasangan
const table = [
  ['batu', 'batu', 'seri', 'Seri!', 'Kalian sama-sama memilih Batu.'],
  ['gunting', 'gunting', 'seri', 'Seri!', 'Kalian sama-sama memilih Gunting.'],
  ['kertas', 'kertas', 'seri', 'Seri!', 'Kalian sama-sama memilih Kertas.'],
  ['batu', 'gunting', 'menang', 'Kamu menang!', 'Batu mengalahkan Gunting.'],
  ['batu', 'kertas', 'kalah', 'Kamu kalah.', 'Kertas mengalahkan Batu.'],
  ['gunting', 'batu', 'kalah', 'Kamu kalah.', 'Batu mengalahkan Gunting.'],
  ['gunting', 'kertas', 'menang', 'Kamu menang!', 'Gunting mengalahkan Kertas.'],
  ['kertas', 'batu', 'menang', 'Kamu menang!', 'Kertas mengalahkan Batu.'],
  ['kertas', 'gunting', 'kalah', 'Kamu kalah.', 'Gunting mengalahkan Kertas.'],
];
for (const [p, c, result, title, reason] of table) {
  const s = deepFreeze(createInitialState());
  const n = playRound(s, p, () => CHOICES.indexOf(c));
  assert.deepEqual(n.lastRound, { playerChoice: p, computerChoice: c, result });
  assert.equal(n.scores[result], 1);
  assert.equal(total(n), 1);
  assert.equal(n.error, null);
  assert.deepEqual(describeRound(n.lastRound), { title, reason });
  assert.deepEqual(s, createInitialState()); // input tidak berubah
}

// awal & state minimum
assert.deepEqual(createInitialState(), { scores: { menang: 0, kalah: 0, seri: 0 }, lastRound: null, error: null });
assert.deepEqual(Object.keys(playRound(createInitialState(), 'batu', () => 0)).sort(), ['error', 'lastRound', 'scores']);

// random: 0/1/2, batas, penolakan
const pick = (n) => playRound(createInitialState(), 'batu', () => n).lastRound.computerChoice;
assert.equal(pick(0), 'batu');
assert.equal(pick(1), 'gunting');
assert.equal(pick(2), 'kertas');
assert.equal(pick(3), 'batu');
assert.equal(pick(4294967294), 'kertas'); // 4294967294 % 3 === 2
{
  // Rentang diterima 0..4294967294 = 4294967295 nilai = 3 * 1431655765 -> tiap opsi persis 1431655765 nilai.
  assert.equal(4294967295 % 3, 0);
  assert.equal(4294967295 / 3, 1431655765);
  const d = fixed(4294967295, 4);
  const n = playRound(createInitialState(), 'batu', d);
  assert.equal(d.calls(), 2);
  assert.equal(n.lastRound.computerChoice, 'gunting'); // 4 % 3 = 1
  assert.equal(n.error, null);
  assert.equal(total(n), 1);
}

// 20 ronde, pilihan sama berulang, tanpa akhir pertandingan
{
  let s = createInitialState();
  const draws = Array.from({ length: 20 }, (_, i) => i % 3);
  draws.forEach((d, i) => {
    s = playRound(s, 'batu', () => d);
    assert.equal(total(s), i + 1);
    assert.equal(s.error, null);
  });
  assert.equal(total(s), 20);
  s = playRound(s, 'batu', () => 0); // ronde 21 tetap jalan
  assert.equal(total(s), 21);
}

// reset
{
  assert.deepEqual(resetState(), createInitialState());
  let s = playRound(createInitialState(), 'batu', () => 0);
  s = playRound(s, 'batu', () => { throw new Error('x'); });
  assert.equal(s.error, ERR);
  const r = resetState();
  assert.deepEqual(r, { scores: { menang: 0, kalah: 0, seri: 0 }, lastRound: null, error: null });
  assert.equal(total(playRound(createInitialState(), 'batu', () => 0)) - total(resetState()), 1);
  // pilih lalu reset => nol; reset lalu pilih => satu
  assert.equal(total(resetState()), 0);
  assert.equal(total(playRound(resetState(), 'kertas', () => 1)), 1);
}

// kegagalan: skor/lastRound lama, pesan tetap, percobaan berikutnya sukses
{
  const base = playRound(createInitialState(), 'batu', () => 1);
  const frozen = deepFreeze(structuredClone(base));
  const noRandom = () => { throw new Error('random tidak boleh dipanggil'); };
  const cases = [
    ['pilihan tak sah', 'api', noRandom],
    ['pilihan kosong', undefined, noRandom],
    ['random melempar', 'batu', () => { throw new Error('boom'); }],
    ...[1.5, -1, 4294967296, NaN, Infinity, '1', null, undefined].map((v) => ['draw ' + String(v), 'batu', () => v]),
    ['draw ditolak terus', 'batu', () => 4294967295],
  ];
  for (const [name, choice, draw] of cases) {
    const n = playRound(frozen, choice, draw);
    assert.deepEqual(n.scores, base.scores, name);
    assert.deepEqual(n.lastRound, base.lastRound, name);
    assert.equal(n.error, ERR, name);
    assert.notEqual(n, frozen);
    assert.notEqual(n.scores, frozen.scores);
    const ok = playRound(n, 'batu', () => 0);
    assert.equal(ok.error, null, name);
    assert.equal(total(ok), total(base) + 1, name);
  }
  // input tak sah tidak memanggil random
  const d = fixed(0);
  playRound(frozen, 'x', d);
  assert.equal(d.calls(), 0);

  // overflow integer aman
  const big = { scores: { menang: Number.MAX_SAFE_INTEGER, kalah: 0, seri: 0 }, lastRound: null, error: null };
  const o = playRound(big, 'batu', () => 1); // menang
  assert.deepEqual(o.scores, big.scores);
  assert.equal(o.lastRound, null);
  assert.equal(o.error, ERR);
  assert.equal(playRound(o, 'batu', () => 0).scores.seri, 1); // percobaan sah lain berhasil
}

// default: crypto native menghasilkan hasil sah
{
  const n = playRound(createInitialState(), 'batu');
  assert.equal(n.error, null);
  assert.ok(CHOICES.includes(n.lastRound.computerChoice));
}

assert.equal(describeRound(null), null);
console.log('OK');
