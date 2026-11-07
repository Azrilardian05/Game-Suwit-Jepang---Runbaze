// Pengendali Suwit Jepang: satu state memori, transaksi sinkron, tanpa timer/storage/jaringan.
import { CHOICES, LABEL, createInitialState, playRound, resetState, describeRound } from './game.mjs';

const ICON = { batu: '✊', gunting: '✌️', kertas: '✋' };
const MARKER = 'Pilihanmu';
const IDS = [
  'fallback', 'skor-menang', 'skor-kalah', 'skor-seri', 'pilihan-pemain', 'penanda-pemain',
  'pilihan-komputer', 'hasil-title', 'hasil-alasan', 'hasil-galat', 'pengumuman-a', 'pengumuman-b', 'reset-skor',
  'ikon-pemain', 'ikon-komputer', 'panel-hasil',
];

const scoreText = (s) => `Menang ${s.scores.menang}, Kalah ${s.scores.kalah}, Seri ${s.scores.seri}.`;

// Cek struktur DOM; lempar bila tidak sesuai agar permainan tetap "tidak tersedia".
function collect(doc) {
  const el = {};
  for (const id of IDS) {
    el[id] = doc.getElementById(id);
    if (!el[id]) throw new Error(`#${id} tidak ada`);
  }
  const buttons = [...doc.querySelectorAll('button[data-pilihan]')];
  const keys = buttons.map((b) => b.dataset.pilihan).sort().join();
  if (keys !== [...CHOICES].sort().join()) throw new Error('tombol pilihan tidak lengkap');
  if (el['reset-skor'].tagName !== 'BUTTON') throw new Error('reset bukan tombol');
  el.buttons = buttons;
  return el;
}

// drawUint32 opsional: hanya untuk harness uji. Di peramban, injeksi kegagalan lewat alat pengembang
// (mis. menimpa crypto.getRandomValues), tanpa kontrol debug publik.
export function init(doc = document, { drawUint32 } = {}) {
  const el = collect(doc);
  const initial = {
    pemain: el['pilihan-pemain'].textContent,
    komputer: el['pilihan-komputer'].textContent,
    title: el['hasil-title'].textContent,
    alasan: el['hasil-alasan'].textContent,
  };
  let state = createInitialState();
  let announceCount = 0; // nomor internal, bukan nomor ronde UI

  // Dua wilayah status bergantian: yang baru diisi dari kosong, yang lain dikosongkan,
  // sehingga pesan identik berurutan tetap terbaca sebagai teks baru.
  function announce(message) {
    const [on, off] = announceCount++ % 2 ? ['pengumuman-b', 'pengumuman-a'] : ['pengumuman-a', 'pengumuman-b'];
    el[off].textContent = '';
    el[on].textContent = message;
  }

  function render() {
    const s = state;
    el['skor-menang'].textContent = String(s.scores.menang);
    el['skor-kalah'].textContent = String(s.scores.kalah);
    el['skor-seri'].textContent = String(s.scores.seri);
    const d = describeRound(s.lastRound);
    el['ikon-pemain'].textContent = d ? ICON[s.lastRound.playerChoice] : ICON.batu;
    el['ikon-komputer'].textContent = d ? ICON[s.lastRound.computerChoice] : '?';
    el['panel-hasil'].dataset.result = d ? s.lastRound.result : '';
    for (const b of el.buttons) b.dataset.selected = String(Boolean(d && b.dataset.pilihan === s.lastRound.playerChoice));
    el['pilihan-pemain'].textContent = d ? LABEL[s.lastRound.playerChoice] : initial.pemain;
    el['pilihan-komputer'].textContent = d ? LABEL[s.lastRound.computerChoice] : initial.komputer;
    el['penanda-pemain'].textContent = d ? MARKER : '';
    el['penanda-pemain'].hidden = !d;
    el['hasil-title'].textContent = d ? d.title : initial.title;
    el['hasil-alasan'].textContent = d ? d.reason : initial.alasan;
    el['hasil-galat'].textContent = s.error ?? '';
    el['hasil-galat'].hidden = s.error === null;
  }

  function play(choice) {
    // validasi -> random -> calon state -> commit sekali -> render -> pengumuman
    state = playRound(state, choice, drawUint32);
    render();
    if (state.error !== null) return announce(state.error);
    const d = describeRound(state.lastRound);
    announce(`${MARKER} ${LABEL[state.lastRound.playerChoice]}. Komputer memilih ${LABEL[state.lastRound.computerChoice]}. ${d.title} ${d.reason} ${scoreText(state)}`);
  }

  function reset() {
    state = resetState();
    render();
    announce(`Skor direset. ${scoreText(state)}`);
  }

  const bound = [];
  const bind = (node, fn) => { node.addEventListener('click', fn); bound.push([node, fn]); };
  try {
    for (const b of el.buttons) { const c = b.dataset.pilihan; bind(b, () => play(c)); }
    bind(el['reset-skor'], reset);
    render();
    for (const b of el.buttons) b.disabled = false;
    el['reset-skor'].disabled = false;
    el.fallback.hidden = true; // terakhir: hanya setelah semuanya siap
  } catch (e) {
    for (const [n, fn] of bound) n.removeEventListener('click', fn);
    for (const b of el.buttons) b.disabled = true;
    el['reset-skor'].disabled = true;
    el.fallback.hidden = false;
    throw e;
  }
  return { getState: () => state };
}
