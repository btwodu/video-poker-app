/**
 * Exact hold solver for one dealt hand: evaluates all 32 hold/discard choices
 * by enumerating every possible draw from the remaining 47 cards.
 */
import type { Card } from './cards';
import { compilePays, evaluatorFor, type GameRules } from './evaluate';

export interface HoldResult {
  /** Expected return per coin bet for each of the 32 hold masks. */
  evs: number[];
  bestMask: number;
  bestEv: number;
}

const EPS = 1e-9;

export function solveHand(rules: GameRules, pays: Record<string, number>, hand: Card[]): HoldResult {
  if (hand.length !== 5) throw new Error('solveHand needs exactly five cards');
  const ev = evaluatorFor(rules.family);
  const pay = compilePays(rules, pays);
  const rest: Card[] = [];
  for (let c = 0; c < 52; c++) if (!hand.includes(c)) rest.push(c);
  const n = rest.length;
  const evs = new Array<number>(32).fill(0);

  for (let mask = 0; mask < 32; mask++) {
    const h: Card[] = [];
    for (let i = 0; i < 5; i++) if (mask & (1 << i)) h.push(hand[i]);
    let total = 0, count = 0;
    switch (h.length) {
      case 5:
        total = pay[ev(h[0], h[1], h[2], h[3], h[4])]; count = 1; break;
      case 4:
        for (let i = 0; i < n; i++) total += pay[ev(h[0], h[1], h[2], h[3], rest[i])];
        count = n; break;
      case 3:
        for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
          total += pay[ev(h[0], h[1], h[2], rest[i], rest[j])]; count++;
        }
        break;
      case 2:
        for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) for (let k = j + 1; k < n; k++) {
          total += pay[ev(h[0], h[1], rest[i], rest[j], rest[k])]; count++;
        }
        break;
      case 1:
        for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) for (let k = j + 1; k < n; k++)
          for (let l = k + 1; l < n; l++) {
            total += pay[ev(h[0], rest[i], rest[j], rest[k], rest[l])]; count++;
          }
        break;
      default:
        for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) for (let k = j + 1; k < n; k++)
          for (let l = k + 1; l < n; l++) for (let m = l + 1; m < n; m++) {
            total += pay[ev(rest[i], rest[j], rest[k], rest[l], rest[m])]; count++;
          }
    }
    evs[mask] = total / count;
  }

  let bestMask = 0;
  for (let mask = 1; mask < 32; mask++) if (evs[mask] > evs[bestMask] + EPS) bestMask = mask;
  return { evs, bestMask, bestEv: evs[bestMask] };
}

/** True when `mask` is as good as the best hold (ties count as correct). */
export const isOptimalHold = (result: HoldResult, mask: number): boolean =>
  result.evs[mask] >= result.bestEv - EPS;
