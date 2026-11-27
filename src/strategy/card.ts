/**
 * Makes a strategy card executable: every line carries a `rule`, and the card's
 * play for a hand is the first line whose rule fits. This lets the tests
 * measure exactly what following the printed card costs against perfect play.
 *
 * Rule syntax (name:arg:arg, options such as h>=2 at the end):
 *   made:<hands>            keep all five when the dealt hand is one of these
 *   five:<rank>             made five of a kind of at least this rank (wild games)
 *   kind:<n>[:<ranks>]      the n-of-a-kind (wild cards included), optionally of given ranks
 *   twopair                 both pairs
 *   pair:high|low|any|<ranks>
 *   royal:<n>               n cards to a royal flush
 *   sf:<n>                  n cards to a straight flush
 *   flush:<n>               n suited cards
 *   straight:<n>:out|in|any open-ended, inside, or either
 *   ranks:s|a:<AB,CD,...>   exactly these ranks, suited (s) or any suits (a); first that fits
 *   deuces                  the wild cards alone
 *   discard                 draw five
 * Alternatives within one line are separated by |, tried left to right.
 * Options: h>=N high cards, g<=N gaps, t>=N (high cards minus gaps), lo>=R lowest rank, hi<=R highest rank,
 * top (prefer the highest-ranked candidate instead of the lowest).
 */
import { RANK_CHARS, type Card } from '../engine/cards';
import { D, J, evaluatorFor, type GameRules } from '../engine/evaluate';

export interface RuleLine { rule: string; deuces?: number }

const ACE = 12, TEN = 8;
const SIZE_MASKS: number[][] = [[], [], [], [], [], []];
for (let m = 0; m < 32; m++) SIZE_MASKS[m.toString(2).replace(/0/g, '').length].push(m);

const MADE: Record<string, Record<string, number[]>> = {
  jacks: {
    royal: [J.ROYAL], sf: [J.STRAIGHT_FLUSH], quads: [J.QUADS_5K, J.QUADS_24, J.QUADS_A],
    fullhouse: [J.FULL_HOUSE], flush: [J.FLUSH], straight: [J.STRAIGHT],
  },
  deuces: {
    natroyal: [D.NATURAL_ROYAL], fourdeuces: [D.FOUR_DEUCES], wildroyal: [D.WILD_ROYAL], five: [D.FIVE_KIND],
    sf: [D.STRAIGHT_FLUSH], quads: [D.QUADS], fullhouse: [D.FULL_HOUSE], flush: [D.FLUSH], straight: [D.STRAIGHT],
  },
};

/** Per-hand facts, with per-hold facts about the natural (non-wild) cards in each of the 32 holds. */
class Ctx {
  hand: Card[] = [];
  rank = new Int8Array(5);
  suit = new Int8Array(5);
  code = 0;
  deuces = 0;
  deuceMask = 0;
  nn = new Int8Array(32);       // natural cards in the hold
  suited = new Uint8Array(32);  // naturals all one suit
  distinct = new Uint8Array(32);
  span = new Int8Array(32);     // rank spread, counting the ace low when that is tighter
  highs = new Int8Array(32);
  royals = new Int8Array(32);
  lo = new Int8Array(32);
  hi = new Int8Array(32);
  sum = new Int16Array(32);
  bits = new Int32Array(32);
  private readonly wild: boolean;
  private readonly minHigh: number;
  private readonly evaluate;

  constructor(rules: GameRules) {
    this.wild = rules.family === 'deuces';
    this.minHigh = rules.minHighPair === 'K' ? 11 : 9;
    this.evaluate = evaluatorFor(rules.family);
  }

  set(hand: Card[]): void {
    this.hand = hand;
    this.deuces = 0; this.deuceMask = 0;
    for (let i = 0; i < 5; i++) {
      this.rank[i] = hand[i] >> 2; this.suit[i] = hand[i] & 3;
      if (this.wild && this.rank[i] === 0) { this.deuces++; this.deuceMask |= 1 << i; }
    }
    this.code = this.evaluate(hand[0], hand[1], hand[2], hand[3], hand[4]);
    for (let m = 1; m < 32; m++) {
      let nn = 0, suit = -1, suited = 1, distinct = 1, bits = 0, highs = 0, royals = 0, sum = 0, lo = 99, hi = -1;
      for (let i = 0; i < 5; i++) {
        if (!(m & (1 << i)) || (this.deuceMask & (1 << i))) continue;
        const r = this.rank[i];
        nn++; sum += r;
        if (suit < 0) suit = this.suit[i]; else if (suit !== this.suit[i]) suited = 0;
        if (bits & (1 << r)) distinct = 0;
        bits |= 1 << r;
        if (r >= this.minHigh) highs++;
        if (r >= TEN) royals++;
        if (r < lo) lo = r;
        if (r > hi) hi = r;
      }
      let span = nn ? hi - lo : 0;
      // In a wild game an ace-low draw only works with a deuce already in the hold.
      if ((!this.wild || (m & this.deuceMask)) && nn > 1 && bits & (1 << ACE)) {
        const rest = bits & ~(1 << ACE);
        span = Math.min(span, 32 - Math.clz32(rest)); // ace low: highest other rank down to "rank -1"
      }
      this.nn[m] = nn; this.suited[m] = suited; this.distinct[m] = distinct; this.bits[m] = bits;
      this.highs[m] = highs; this.royals[m] = royals; this.sum[m] = sum; this.lo[m] = lo; this.hi[m] = hi; this.span[m] = span;
    }
  }

  /**
   * Best hold of `size` cards that keeps every wild card and passes `test`.
   * Among several, the lowest ranks win (better straight chances), or the highest when `preferHigh`.
   */
  pick(size: number, test: (m: number) => boolean, preferHigh = false): number {
    let best = -1;
    for (const m of SIZE_MASKS[size]) {
      if ((m & this.deuceMask) !== this.deuceMask || !test(m)) continue;
      if (best < 0 || (preferHigh ? this.sum[m] > this.sum[best] : this.sum[m] < this.sum[best])) best = m;
    }
    return best;
  }
}

type Compiled = (c: Ctx) => number;
const rankIndex = (ch: string) => {
  const i = RANK_CHARS.indexOf(ch);
  if (i < 0) throw new Error(`Bad rank "${ch}" in strategy rule`);
  return i;
};

function compile(rule: string, rules: GameRules): Compiled {
  if (rule.includes('|')) {
    const options = rule.split('|').map((r) => compile(r, rules));
    return (c) => {
      for (const run of options) { const mask = run(c); if (mask >= 0) return mask; }
      return -1;
    };
  }
  const parts = rule.split(':');
  const name = parts[0];
  // Trailing options such as h>=2.
  const opt = { h: 0, g: 9, t: -9, lo: 0, hi: 99, top: false };
  while (parts.length > 1 && /^(h>=|g<=|t>=|lo>=|hi<=|top$)/.test(parts[parts.length - 1])) {
    const o = parts.pop()!;
    if (o === 'top') opt.top = true;
    else if (o.startsWith('h>=')) opt.h = Number(o.slice(3));
    else if (o.startsWith('g<=')) opt.g = Number(o.slice(3));
    else if (o.startsWith('t>=')) opt.t = Number(o.slice(3));
    else if (o.startsWith('hi<=')) opt.hi = rankIndex(o.slice(4));
    else opt.lo = rankIndex(o.slice(4));
  }
  const options = (c: Ctx, m: number) => {
    const gaps = c.span[m] - (c.nn[m] - 1);
    return c.highs[m] >= opt.h && gaps <= opt.g && c.highs[m] - gaps >= opt.t && c.lo[m] >= opt.lo && c.hi[m] <= opt.hi;
  };
  const n = Number(parts[1]);

  switch (name) {
    case 'made': {
      const codes = parts[1].split(',').flatMap((k) => {
        const found = MADE[rules.family][k];
        if (!found) throw new Error(`Unknown made hand "${k}"`);
        return found;
      });
      return (c) => (codes.includes(c.code) ? 31 : -1);
    }
    case 'five': {
      const min = rankIndex(parts[1]);
      return (c) => (c.code === D.FIVE_KIND && c.lo[31] >= min ? 31 : -1);
    }
    case 'kind': {
      const allowed = parts[2] ? parts[2].split('').map(rankIndex) : null;
      return (c) => {
        for (let r = ACE; r >= 0; r--) {
          if (allowed && !allowed.includes(r)) continue;
          let mask = c.deuceMask, count = c.deuces;
          for (let i = 0; i < 5; i++) if (c.rank[i] === r && !(c.deuceMask & (1 << i))) { mask |= 1 << i; count++; }
          if (count === n && count > c.deuces) return mask;
        }
        return -1;
      };
    }
    case 'twopair':
      return (c) => {
        if (c.code !== J.TWO_PAIR || rules.family !== 'jacks') return -1;
        let mask = 0;
        for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) if (i !== j && c.rank[i] === c.rank[j]) mask |= 1 << i;
        return mask;
      };
    case 'pair': {
      const minHigh = rules.minHighPair === 'K' ? 11 : 9;
      const filter = parts[1];
      const wanted = (r: number) =>
        filter === 'any' || (filter === 'high' ? r >= minHigh : filter === 'low' ? r < minHigh : filter.includes(RANK_CHARS[r]));
      return (c) => {
        if (c.deuces) return -1;
        for (let r = ACE; r >= 0; r--) {
          if (!wanted(r)) continue;
          let mask = 0, count = 0;
          for (let i = 0; i < 5; i++) if (c.rank[i] === r) { mask |= 1 << i; count++; }
          if (count === 2) return mask;
        }
        return -1;
      };
    }
    case 'royal':
      return (c) => c.pick(n, (m) => !!c.suited[m] && !!c.distinct[m] && c.royals[m] === c.nn[m] && c.nn[m] > 0 && options(c, m));
    case 'sf':
      return (c) => c.pick(n, (m) => !!c.suited[m] && !!c.distinct[m] && c.nn[m] > 0 && c.span[m] <= 4 && options(c, m), opt.top);
    case 'flush':
      return (c) => c.pick(n, (m) => !!c.suited[m] && c.nn[m] > 0 && options(c, m));
    case 'straight': {
      const kind = parts[2] ?? 'any';
      return (c) => c.pick(n, (m) => {
        if (!c.distinct[m] || c.span[m] > 4 || c.nn[m] === 0 || !options(c, m)) return false;
        const open = c.nn[m] === 4 && c.span[m] === 3 && !(c.bits[m] & (1 << ACE));
        return kind === 'any' || (kind === 'out') === open;
      }, true);
    }
    case 'ranks': {
      const suited = parts[1] === 's';
      const combos = parts[2].split(',').map((combo) => combo.split('').map(rankIndex));
      return (c) => {
        for (const combo of combos) {
          for (let s = 0; s < (suited ? 4 : 1); s++) {
            let mask = 0;
            for (const r of combo) {
              let found = -1;
              for (let i = 0; i < 5; i++) {
                if (c.rank[i] === r && !(c.deuceMask & (1 << i)) && (!suited || c.suit[i] === s)) { found = i; break; }
              }
              if (found < 0) { mask = -1; break; }
              mask |= 1 << found;
            }
            if (mask >= 0) return mask | c.deuceMask;
          }
        }
        return -1;
      };
    }
    case 'deuces':
      return (c) => (c.deuces ? c.deuceMask : -1);
    case 'discard':
      return () => 0;
    default:
      throw new Error(`Unknown strategy rule "${rule}"`);
  }
}

export interface CardPlayer {
  /** Hold mask the card prescribes for a hand, and the index of the line that decided it. */
  play(hand: Card[]): { mask: number; line: number };
}

export function compileCard(rules: GameRules, lines: RuleLine[]): CardPlayer {
  const ctx = new Ctx(rules);
  const compiled = lines.map((l) => ({ run: compile(l.rule, rules), deuces: l.deuces }));
  return {
    play(hand) {
      ctx.set(hand);
      for (let i = 0; i < compiled.length; i++) {
        if (compiled[i].deuces !== undefined && compiled[i].deuces !== ctx.deuces) continue;
        const mask = compiled[i].run(ctx);
        if (mask >= 0) return { mask, line: i };
      }
      return { mask: 0, line: -1 };
    },
  };
}
