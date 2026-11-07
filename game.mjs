// Engine Suwit Jepang: murni, tanpa DOM/storage/jaringan.
export const CHOICES = Object.freeze(['batu', 'gunting', 'kertas']);
export const ROUND_ERROR = 'Ronde belum diproses. Pilih lagi.';

export const LABEL = Object.freeze({ batu: 'Batu', gunting: 'Gunting', kertas: 'Kertas' });
const BEATS = { batu: 'gunting', gunting: 'kertas', kertas: 'batu' };
const TITLE = { menang: 'Kamu menang!', kalah: 'Kamu kalah.', seri: 'Seri!' };
const REJECTED = 4294967295; // 2^32-1 ditolak: sisa 4294967295 nilai = 3 x 1431655765 per opsi
const MAX_DRAWS = 16; // ponytail: batas pengaman adapter macet; peluang 2^-32 per draw produksi

const defaultDraw = () => crypto.getRandomValues(new Uint32Array(1))[0];

function freezeState({ scores, lastRound, error }) {
  return Object.freeze({
    scores: Object.freeze({ ...scores }),
    lastRound: lastRound === null ? null : Object.freeze({ ...lastRound }),
    error,
  });
}

export function createInitialState() {
  return freezeState({ scores: { menang: 0, kalah: 0, seri: 0 }, lastRound: null, error: null });
}

export function resetState() {
  return createInitialState();
}

export function judge(playerChoice, computerChoice) {
  if (playerChoice === computerChoice) return 'seri';
  return BEATS[playerChoice] === computerChoice ? 'menang' : 'kalah';
}

function pickComputer(drawUint32) {
  for (let i = 0; i < MAX_DRAWS; i++) {
    const n = drawUint32();
    if (!Number.isInteger(n) || n < 0 || n > REJECTED) throw new RangeError('draw bukan uint32');
    if (n !== REJECTED) return CHOICES[n % 3];
  }
  throw new Error('draw ditolak berulang');
}

export function playRound(state, playerChoice, drawUint32 = defaultDraw) {
  const fail = () => freezeState({ ...state, error: ROUND_ERROR });
  try {
    if (!CHOICES.includes(playerChoice)) return fail(); // sebelum random
    const computerChoice = pickComputer(drawUint32);
    const result = judge(playerChoice, computerChoice);
    const next = state.scores[result] + 1;
    if (!Number.isSafeInteger(next)) return fail();
    return freezeState({
      scores: { ...state.scores, [result]: next },
      lastRound: { playerChoice, computerChoice, result },
      error: null,
    });
  } catch {
    return fail();
  }
}

export function describeRound(lastRound) {
  if (!lastRound) return null;
  const { playerChoice: p, computerChoice: c, result } = lastRound;
  const reason = result === 'seri'
    ? `Kalian sama-sama memilih ${LABEL[p]}.`
    : result === 'menang'
      ? `${LABEL[p]} mengalahkan ${LABEL[c]}.`
      : `${LABEL[c]} mengalahkan ${LABEL[p]}.`;
  return { title: TITLE[result], reason };
}
