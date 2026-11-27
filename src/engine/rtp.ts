/**
 * Exact optimal-strategy return for a whole paytable (all 2,598,960 deals).
 *
 * For every k-card subset X of the deck we store T(X) = total pay of all
 * five-card hands containing X. The total pay of holding H and discarding D
 * is then an inclusion-exclusion sum over subsets S of D:
 *   sum (-1)^|S| * T(H ∪ S)
 * which turns each hold into a handful of table lookups.
 */
import { compilePays, evaluatorFor, type GameRules } from './evaluate';

const C: number[][] = [];
for (let n = 0; n <= 52; n++) {
  C.push([1, 0, 0, 0, 0, 0]);
  for (let k = 1; k <= 5; k++) C[n][k] = n === 0 ? 0 : C[n - 1][k - 1] + C[n - 1][k];
}

// For each hold mask, every superset mask with its inclusion-exclusion sign.
const SUPERSETS: { mask: number; sign: number }[][] = [];
const BITS = Array.from({ length: 32 }, (_, m) => m.toString(2).replace(/0/g, '').length);
for (let h = 0; h < 32; h++) {
  SUPERSETS.push([]);
  for (let u = 0; u < 32; u++)
    if ((u & h) === h) SUPERSETS[h].push({ mask: u, sign: (BITS[u] - BITS[h]) % 2 ? -1 : 1 });
}
const DRAWS = [C[47][5], C[47][4], C[47][3], C[47][2], C[47][1], 1]; // by cards held

/**
 * Visit every one of the 2,598,960 deals with the exact value of all 32 holds.
 * `hand` is sorted ascending and `evs[mask]` uses bit i for hand[i]; both
 * arrays are reused between calls, so copy anything you keep.
 */
export function forEachHand(
  rules: GameRules, pays: Record<string, number>,
  visit: (hand: number[], evs: Float64Array) => void,
): void {
  const ev = evaluatorFor(rules.family);
  const pay = compilePays(rules, pays);
  const T = [new Float64Array(1), new Float64Array(52), new Float64Array(C[52][2]),
    new Float64Array(C[52][3]), new Float64Array(C[52][4])];
  const hand = [0, 0, 0, 0, 0];
  const index = (mask: number): number => {
    let idx = 0, k = 0;
    for (let i = 0; i < 5; i++) if (mask & (1 << i)) idx += C[hand[i]][++k];
    return idx;
  };
  for (hand[0] = 0; hand[0] < 48; hand[0]++)
    for (hand[1] = hand[0] + 1; hand[1] < 49; hand[1]++)
      for (hand[2] = hand[1] + 1; hand[2] < 50; hand[2]++)
        for (hand[3] = hand[2] + 1; hand[3] < 51; hand[3]++)
          for (hand[4] = hand[3] + 1; hand[4] < 52; hand[4]++) {
            const p = pay[ev(hand[0], hand[1], hand[2], hand[3], hand[4])];
            if (p === 0) continue;
            for (let mask = 0; mask < 31; mask++) T[BITS[mask]][index(mask)] += p;
          }
  const sub = new Float64Array(32);
  const evs = new Float64Array(32);
  for (hand[0] = 0; hand[0] < 48; hand[0]++)
    for (hand[1] = hand[0] + 1; hand[1] < 49; hand[1]++)
      for (hand[2] = hand[1] + 1; hand[2] < 50; hand[2]++)
        for (hand[3] = hand[2] + 1; hand[3] < 51; hand[3]++)
          for (hand[4] = hand[3] + 1; hand[4] < 52; hand[4]++) {
            for (let mask = 0; mask < 31; mask++) sub[mask] = T[BITS[mask]][index(mask)];
            sub[31] = pay[ev(hand[0], hand[1], hand[2], hand[3], hand[4])];
            for (let h = 0; h < 32; h++) {
              let sum = 0;
              const sup = SUPERSETS[h];
              for (let i = 0; i < sup.length; i++) sum += sup[i].sign * sub[sup[i].mask];
              evs[h] = sum / DRAWS[BITS[h]];
            }
            visit(hand, evs);
          }
}

export const TOTAL_HANDS = C[52][5];

export interface ExactResult {
  /** Optimal-strategy return per coin bet, e.g. 0.995439. */
  rtp: number;
  /** Variance of the per-coin payout under that strategy. */
  variance: number;
}

export function exactReturn(rules: GameRules, pays: Record<string, number>): ExactResult {
  const ev = evaluatorFor(rules.family);
  const pay = compilePays(rules, pays);
  const T = [new Float64Array(1), new Float64Array(52), new Float64Array(C[52][2]),
    new Float64Array(C[52][3]), new Float64Array(C[52][4])];
  // Same tables for squared pay, used only for the variance.
  const T2 = T.map((t) => new Float64Array(t.length));
  const hand = [0, 0, 0, 0, 0];

  // Combinadic index of the cards selected by `mask` (hand is sorted ascending).
  const index = (mask: number): number => {
    let idx = 0, k = 0;
    for (let i = 0; i < 5; i++) if (mask & (1 << i)) idx += C[hand[i]][++k];
    return idx;
  };

  for (hand[0] = 0; hand[0] < 48; hand[0]++)
    for (hand[1] = hand[0] + 1; hand[1] < 49; hand[1]++)
      for (hand[2] = hand[1] + 1; hand[2] < 50; hand[2]++)
        for (hand[3] = hand[2] + 1; hand[3] < 51; hand[3]++)
          for (hand[4] = hand[3] + 1; hand[4] < 52; hand[4]++) {
            const p = pay[ev(hand[0], hand[1], hand[2], hand[3], hand[4])];
            if (p === 0) continue;
            for (let mask = 0; mask < 31; mask++) {
              const idx = index(mask);
              T[BITS[mask]][idx] += p;
              T2[BITS[mask]][idx] += p * p;
            }
          }

  const sub = new Float64Array(32);
  const idxs = new Int32Array(32);
  let total = 0, totalSq = 0;
  for (hand[0] = 0; hand[0] < 48; hand[0]++)
    for (hand[1] = hand[0] + 1; hand[1] < 49; hand[1]++)
      for (hand[2] = hand[1] + 1; hand[2] < 50; hand[2]++)
        for (hand[3] = hand[2] + 1; hand[3] < 51; hand[3]++)
          for (hand[4] = hand[3] + 1; hand[4] < 52; hand[4]++) {
            for (let mask = 0; mask < 31; mask++) sub[mask] = T[BITS[mask]][(idxs[mask] = index(mask))];
            sub[31] = pay[ev(hand[0], hand[1], hand[2], hand[3], hand[4])];
            let best = -1, bestHold = 0;
            for (let h = 0; h < 32; h++) {
              let sum = 0;
              const sup = SUPERSETS[h];
              for (let i = 0; i < sup.length; i++) sum += sup[i].sign * sub[sup[i].mask];
              const value = sum / DRAWS[BITS[h]];
              if (value > best) { best = value; bestHold = h; }
            }
            total += best;
            let sq = 0;
            const sup = SUPERSETS[bestHold];
            for (let i = 0; i < sup.length; i++) {
              const u = sup[i].mask;
              sq += sup[i].sign * (u === 31 ? sub[31] * sub[31] : T2[BITS[u]][idxs[u]]);
            }
            totalSq += sq / DRAWS[BITS[bestHold]];
          }
  const rtp = total / C[52][5];
  return { rtp, variance: totalSq / C[52][5] - rtp * rtp };
}
