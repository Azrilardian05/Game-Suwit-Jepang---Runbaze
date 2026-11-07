import { init } from './app.mjs';

try { init(document); } catch (e) { console.error('Permainan tidak tersedia:', e); }
