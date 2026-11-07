// Smoke DOM: node smoke.mjs  (butuh jsdom; set JSDOM_DIR=<folder berisi node_modules/jsdom> bila tidak terpasang di sini)
// Ini jsdom, BUKAN peramban nyata: fokus/pembaca layar/Enter-Space asli tetap perlu uji peramban.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { init } from './app.mjs';

let JSDOM;
try {
  JSDOM = createRequire((process.env.JSDOM_DIR ?? process.cwd()) + '/').call(null, 'jsdom').JSDOM;
} catch { console.log('SKIP: jsdom tidak ditemukan (set JSDOM_DIR)'); process.exit(0); }

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const ERR = 'Ronde belum diproses. Pilih lagi.';
const make = (draw) => {
  const dom = new JSDOM(html);
  const d = dom.window.document;
  const $ = (id) => d.getElementById(id);
  const api = init(d, { drawUint32: draw });
  const say = () => [$('pengumuman-a'), $('pengumuman-b')].map((n) => n.textContent).filter(Boolean).join('|');
  const btn = (c) => d.querySelector(`[data-pilihan=${c}]`);
  return { dom, d, $, api, say, btn };
};

// awal: fallback tersembunyi, kontrol aktif, tidak ada fokus paksa
{
  const dom = new JSDOM(html); const d = dom.window.document;
  assert.equal(d.getElementById('fallback').hidden, false);
  assert.ok([...d.querySelectorAll('button')].every((b) => b.disabled));
  const t = make(() => 0);
  assert.equal(t.$('fallback').hidden, true);
  assert.ok([...t.d.querySelectorAll('button')].every((b) => !b.disabled));
  assert.equal(t.d.activeElement, t.d.body);
  assert.equal(t.$('pilihan-komputer').textContent, 'Belum dibuka');
  assert.equal(t.$('ikon-komputer').textContent, '?');
  assert.equal(t.$('panel-hasil').dataset.result, '');
  assert.ok([...t.d.querySelectorAll('[data-pilihan]')].every((b) => b.dataset.selected === 'false'));
}

// alur pertama: batu vs batu (draw 0)
{
  let n = 0; const seq = [0, 1, 2];
  const t = make(() => seq[n++ % 3]);
  const nodes = [t.btn('batu'), t.$('reset-skor')];
  t.btn('batu').focus();
  t.btn('batu').click();
  assert.equal(t.$('pilihan-pemain').textContent, 'Batu');
  assert.equal(t.$('pilihan-komputer').textContent, 'Batu');
  assert.equal(t.$('penanda-pemain').textContent, 'Pilihanmu');
  assert.equal(t.$('hasil-title').textContent, 'Seri!');
  assert.equal(t.$('hasil-alasan').textContent, 'Kalian sama-sama memilih Batu.');
  assert.equal(t.$('skor-seri').textContent, '1');
  assert.equal(t.$('ikon-pemain').textContent, '✊');
  assert.equal(t.$('ikon-komputer').textContent, '✊');
  assert.equal(t.$('panel-hasil').dataset.result, 'seri');
  assert.equal(t.btn('batu').dataset.selected, 'true');
  assert.equal(t.btn('gunting').dataset.selected, 'false');
  assert.equal(t.d.activeElement, nodes[0]);
  assert.ok(!t.btn('batu').disabled);
  assert.ok(t.say().includes('Seri!') && t.say().includes('Menang 0, Kalah 0, Seri 1.'));
  // 19 ronde lagi: total 20, tiap klik tepat satu ronde (double-click = 2)
  t.btn('batu').dispatchEvent(new t.dom.window.MouseEvent('dblclick', { bubbles: true })); // dblclick sendiri tidak menghitung
  const total = () => ['menang', 'kalah', 'seri'].reduce((a, k) => a + Number(t.$('skor-' + k).textContent), 0);
  assert.equal(total(), 1);
  for (let i = 0; i < 19; i++) t.btn(['batu', 'gunting', 'kertas'][i % 3]).click();
  assert.equal(total(), 20);
  assert.equal(t.btn('batu'), nodes[0]); // node tidak diganti
  assert.ok(t.say().length > 0);
  // reset
  t.$('reset-skor').focus(); t.$('reset-skor').click();
  assert.equal(t.say(), 'Skor direset. Menang 0, Kalah 0, Seri 0.');
  assert.equal(total(), 0);
  assert.equal(t.$('pilihan-pemain').textContent, 'Belum dipilih');
  assert.equal(t.$('pilihan-komputer').textContent, 'Belum dibuka');
  assert.equal(t.$('penanda-pemain').hidden, true);
  assert.equal(t.$('hasil-title').textContent, 'Belum ada ronde');
  assert.equal(t.$('ikon-komputer').textContent, '?');
  assert.equal(t.$('panel-hasil').dataset.result, '');
  assert.ok([...t.d.querySelectorAll('[data-pilihan]')].every((b) => b.dataset.selected === 'false'));
  assert.equal(t.d.activeElement, t.$('reset-skor'));
  t.btn('kertas').click();
  assert.equal(total(), 1);
}

// error & retry; pengumuman identik berulang tetap ditulis ulang
{
  let fail = true;
  const t = make(() => { if (fail) throw new Error('x'); return 1; });
  t.btn('batu').click();
  assert.equal(t.$('hasil-galat').textContent, ERR);
  assert.equal(t.$('hasil-galat').hidden, false);
  assert.equal(t.say(), ERR);
  assert.equal(t.$('skor-menang').textContent, '0');
  const before = t.$('pengumuman-a').textContent + t.$('pengumuman-b').textContent;
  t.btn('batu').click(); // gagal identik lagi: wilayah lain terisi
  assert.equal(t.say(), ERR);
  assert.notEqual(t.$('pengumuman-a').textContent + t.$('pengumuman-b').textContent, '');
  assert.equal(before, ERR);
  fail = false;
  t.btn('batu').click();
  assert.equal(t.$('hasil-galat').hidden, true);
  assert.equal(t.$('skor-menang').textContent, '1');
  assert.equal(t.$('pilihan-komputer').textContent, 'Gunting');
  assert.equal(t.$('ikon-komputer').textContent, '✌️');
  assert.equal(t.$('panel-hasil').dataset.result, 'menang');
  assert.ok(t.say().includes('Batu mengalahkan Gunting.'));
  // gagal setelah sukses: hasil lama bertahan
  fail = true; t.btn('kertas').click();
  assert.equal(t.$('hasil-title').textContent, 'Kamu menang!');
  assert.equal(t.$('skor-menang').textContent, '1');
  assert.equal(t.$('hasil-galat').textContent, ERR);
  assert.equal(t.btn('batu').dataset.selected, 'true');
  assert.equal(t.btn('kertas').dataset.selected, 'false');
}

// DOM rusak: lempar, fallback tetap tampil, tombol nonaktif
{
  const dom = new JSDOM(html); const d = dom.window.document;
  d.getElementById('skor-seri').remove();
  assert.throws(() => init(d));
  assert.equal(d.getElementById('fallback').hidden, false);
  assert.ok([...d.querySelectorAll('button')].every((b) => b.disabled));
}
console.log('SMOKE OK');
