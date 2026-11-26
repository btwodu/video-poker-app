/**
 * Five-card hand evaluators. Each returns a small integer "hand code"; a
 * paytable is compiled into an array indexed by that code so the solver's
 * inner loop is a single array lookup.
 */
import type { Card } from './cards';

export type Family = 'jacks' | 'deuces';

/** Codes for non-wild games (Jacks or Better, Bonus, Double Bonus, Triple Bonus). */
export const J = {
  NOTHING: 0,
  PAIR_JQ: 1,
  PAIR_KA: 2,
  TWO_PAIR: 3,
  TRIPS: 4,
  STRAIGHT: 5,
  FLUSH: 6,
  FULL_HOUSE: 7,
  QUADS_5K: 8,
  QUADS_24: 9,
  QUADS_A: 10,
  STRAIGHT_FLUSH: 11,
  ROYAL: 12,
} as const;

/** Codes for Deuces Wild. */
export const D = {
  NOTHING: 0,
  TRIPS: 1,
  STRAIGHT: 2,
  FLUSH: 3,
  FULL_HOUSE: 4,
  QUADS: 5,
  STRAIGHT_FLUSH: 6,
  FIVE_KIND: 7,
  WILD_ROYAL: 8,
  FOUR_DEUCES: 9,
  NATURAL_ROYAL: 10,
} as const;

export const CODE_COUNT = 13;

const ACE_BIT = 1 << 12;
const WHEEL = ACE_BIT | 0b1111; // A-2-3-4-5
const ROYAL_MASK = 0b11111 << 8; // T-J-Q-K-A

export function evalJacks(a: Card, b: Card, c: Card, d: Card, e: Card): number {
  const ra = a >> 2, rb = b >> 2, rc = c >> 2, rd = d >> 2, re = e >> 2;
  // Count equal-rank pairs among the 10 card pairs: 1 = pair, 2 = two pair,
  // 3 = trips, 4 = full house, 6 = quads. `pr` ends as a paired rank.
  let eq = 0, pr = -1;
  if (ra === rb) { eq++; pr = ra; }
  if (ra === rc) { eq++; pr = ra; }
  if (ra === rd) { eq++; pr = ra; }
  if (ra === re) { eq++; pr = ra; }
  if (rb === rc) { eq++; pr = rb; }
  if (rb === rd) { eq++; pr = rb; }
  if (rb === re) { eq++; pr = rb; }
  if (rc === rd) { eq++; pr = rc; }
  if (rc === re) { eq++; pr = rc; }
  if (rd === re) { eq++; pr = rd; }
  switch (eq) {
    case 0: {
      const sa = a & 3;
      const flush = sa === (b & 3) && sa === (c & 3) && sa === (d & 3) && sa === (e & 3);
      const mask = (1 << ra) | (1 << rb) | (1 << rc) | (1 << rd) | (1 << re);
      const straight = mask === WHEEL || mask / (mask & -mask) === 0b11111;
      if (flush) return straight ? (mask === ROYAL_MASK ? J.ROYAL : J.STRAIGHT_FLUSH) : J.FLUSH;
      return straight ? J.STRAIGHT : J.NOTHING;
    }
    case 1: return pr >= 11 ? J.PAIR_KA : pr >= 9 ? J.PAIR_JQ : J.NOTHING;
    case 2: return J.TWO_PAIR;
    case 3: return J.TRIPS;
    case 4: return J.FULL_HOUSE;
    default: return pr === 12 ? J.QUADS_A : pr <= 2 ? J.QUADS_24 : J.QUADS_5K;
  }
}

export function evalDeuces(a: Card, b: Card, c: Card, d: Card, e: Card): number {
  const cards = [a, b, c, d, e];
  let deuces = 0, eq = 0, mask = 0, suit = -1, flush = true;
  for (let i = 0; i < 5; i++) {
    const ri = cards[i] >> 2;
    if (ri === 0) { deuces++; continue; }
    if (suit < 0) suit = cards[i] & 3; else if (suit !== (cards[i] & 3)) flush = false;
    mask |= 1 << ri;
    for (let j = i + 1; j < 5; j++) if (cards[j] >> 2 === ri) eq++;
  }
  if (deuces === 4) return D.FOUR_DEUCES;
  // Largest group of equal non-deuce ranks.
  const most = eq === 0 ? 1 : eq <= 2 ? 2 : eq === 3 ? 3 : eq === 4 ? 3 : 4;
  let straight = false;
  if (eq === 0) {
    const low = mask & -mask;
    straight = mask / low < 32 || ((mask & ACE_BIT) !== 0 && (mask & ~ACE_BIT) < 16);
  }
  if (deuces === 0) {
    if (eq === 0) {
      if (flush) return straight ? (mask === ROYAL_MASK ? D.NATURAL_ROYAL : D.STRAIGHT_FLUSH) : D.FLUSH;
      return straight ? D.STRAIGHT : D.NOTHING;
    }
    return eq === 6 ? D.QUADS : eq === 4 ? D.FULL_HOUSE : eq === 3 ? D.TRIPS : D.NOTHING;
  }
  if (eq === 0 && flush && (mask & ~ROYAL_MASK) === 0) return D.WILD_ROYAL;
  if (most + deuces === 5) return D.FIVE_KIND;
  if (eq === 0 && flush && straight) return D.STRAIGHT_FLUSH;
  if (most + deuces === 4) return D.QUADS;
  if (deuces === 1 && eq === 2) return D.FULL_HOUSE;
  if (eq === 0 && flush) return D.FLUSH;
  if (straight) return D.STRAIGHT;
  return most + deuces === 3 ? D.TRIPS : D.NOTHING;
}

export type Evaluator = (a: Card, b: Card, c: Card, d: Card, e: Card) => number;

export const evaluatorFor = (family: Family): Evaluator =>
  family === 'deuces' ? evalDeuces : evalJacks;

/**
 * Which paytable row pays each hand code. The first key present in the
 * paytable wins, so a game without split quads falls back to `fourOfAKind`.
 */
const JACKS_ROWS: Record<number, string[]> = {
  [J.PAIR_JQ]: ['highPair'],
  [J.PAIR_KA]: ['highPair'],
  [J.TWO_PAIR]: ['twoPair'],
  [J.TRIPS]: ['threeOfAKind'],
  [J.STRAIGHT]: ['straight'],
  [J.FLUSH]: ['flush'],
  [J.FULL_HOUSE]: ['fullHouse'],
  [J.QUADS_5K]: ['four5sK', 'fourOfAKind'],
  [J.QUADS_24]: ['four2s4s', 'fourOfAKind'],
  [J.QUADS_A]: ['fourAces', 'fourOfAKind'],
  [J.STRAIGHT_FLUSH]: ['straightFlush'],
  [J.ROYAL]: ['royal'],
};

const DEUCES_ROWS: Record<number, string[]> = {
  [D.TRIPS]: ['threeOfAKind'],
  [D.STRAIGHT]: ['straight'],
  [D.FLUSH]: ['flush'],
  [D.FULL_HOUSE]: ['fullHouse'],
  [D.QUADS]: ['fourOfAKind'],
  [D.STRAIGHT_FLUSH]: ['straightFlush'],
  [D.FIVE_KIND]: ['fiveOfAKind'],
  [D.WILD_ROYAL]: ['wildRoyal'],
  [D.FOUR_DEUCES]: ['fourDeuces'],
  [D.NATURAL_ROYAL]: ['royal'],
};

export interface GameRules {
  family: Family;
  /** Lowest pair rank that pays in a non-wild game: 'J' (Jacks or Better) or 'K'. */
  minHighPair?: 'J' | 'K';
}

/** Row key that pays a given hand code under these rules, or null. */
export function rowKeyForCode(rules: GameRules, pays: Record<string, number>, code: number): string | null {
  if (rules.family === 'jacks' && code === J.PAIR_JQ && rules.minHighPair === 'K') return null;
  const keys = (rules.family === 'deuces' ? DEUCES_ROWS : JACKS_ROWS)[code] ?? [];
  return keys.find((k) => k in pays) ?? null;
}

/** Compile a paytable (row key -> pay per coin) into an array indexed by hand code. */
export function compilePays(rules: GameRules, pays: Record<string, number>): number[] {
  const out = new Array<number>(CODE_COUNT).fill(0);
  for (let code = 1; code < CODE_COUNT; code++) {
    const key = rowKeyForCode(rules, pays, code);
    if (key) out[code] = pays[key];
  }
  return out;
}
