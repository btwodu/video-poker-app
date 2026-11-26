/**
 * Plain-language label for a hold (e.g. "Four to a flush", "Low pair").
 * Used for trainer feedback and for grouping mistakes into categories.
 * Labels describe what was held; they never decide which hold is correct.
 */
import { cardsInMask, rankOf, suitOf, type Card } from './cards';
import type { GameRules } from './evaluate';

const TEN = 8, JACK = 9, KING = 11, ACE = 12;
const NUMBER_WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five'];

/** True when distinct ranks can all sit inside one five-card straight. */
function fitsStraight(ranks: number[]): boolean {
  const hi = Math.max(...ranks), lo = Math.min(...ranks);
  if (hi - lo <= 4) return true;
  // Ace played low (A-2-3-4-5).
  const rest = ranks.filter((r) => r !== ACE);
  return hi === ACE && Math.max(...rest) <= 3;
}

export function describeHold(rules: GameRules, hand: Card[], mask: number, madeHandLabel?: string): string {
  const held = cardsInMask(hand, mask);
  const n = held.length;
  if (n === 0) return 'Discard everything';
  if (n === 5 && madeHandLabel) return `Made hand: ${madeHandLabel}`;

  const wildGame = rules.family === 'deuces';
  const naturals = wildGame ? held.filter((c) => rankOf(c) !== 0) : held;
  const wilds = n - naturals.length;
  const suffix = wilds === 0 ? '' : ` (with ${wilds} deuce${wilds > 1 ? 's' : ''})`;
  if (naturals.length === 0) return `${NUMBER_WORDS[wilds]} deuce${wilds > 1 ? 's' : ''} only`;

  const ranks = naturals.map(rankOf);
  const counts = new Map<number, number>();
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1);
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const [topRank, topCount] = groups[0];
  const minHigh = rules.minHighPair === 'K' ? KING : JACK;

  if (topCount >= 2 || (wilds > 0 && naturals.length === 1)) {
    if (wilds > 0 && naturals.length === 1 && wilds < 2) return `Deuce + one card`;
    const kind = topCount + wilds;
    const used = kind + (wilds === 0 && groups[1]?.[1] === 2 ? 2 : 0);
    const kicker = n > used ? ' + kicker' : '';
    if (wilds === 0 && topCount === 3 && groups[1]?.[1] === 2) return 'Full house';
    if (wilds === 0 && topCount === 2 && groups[1]?.[1] === 2) return 'Two pair' + kicker;
    if (kind >= 5) return 'Five of a kind';
    if (kind === 4) return 'Four of a kind' + kicker + suffix;
    if (kind === 3) return 'Three of a kind' + kicker + suffix;
    if (wildGame) return 'Pair' + kicker;
    return (topRank >= minHigh ? 'High pair' : 'Low pair') + kicker;
  }

  // All natural ranks distinct from here on.
  const suited = naturals.every((c) => suitOf(c) === suitOf(naturals[0]));
  const allRoyal = ranks.every((r) => r >= TEN);
  const straightish = fitsStraight(ranks);
  const highs = ranks.filter((r) => r >= minHigh).length;
  const count = NUMBER_WORDS[n];

  if (n === 1) return wildGame ? 'One card' : highs ? 'One high card' : 'One low card';
  if (suited) {
    if (allRoyal) {
      if (n === 2 && !wildGame) return highs === 2 ? 'Two suited high cards' : 'Two suited royal cards';
      return `${count} to a royal flush${suffix}`;
    }
    if (straightish && n >= 3) return `${count} to a straight flush${suffix}`;
    if (n >= 3) return `${count} to a flush${suffix}`;
    return 'Two suited cards' + suffix;
  }
  if (n === 4 && straightish) {
    const hi = Math.max(...ranks), lo = Math.min(...ranks);
    // Open-ended only when four in a row with room on both sides.
    if (wildGame) return 'Four to a straight' + suffix;
    const outside = hi - lo === 3 && hi !== ACE;
    return outside ? 'Four to an outside straight' : 'Four to an inside straight';
  }
  if (!wildGame && highs === n) return `${count} high cards`;
  if (n === 3 && straightish && wilds > 0) return `Three to a straight${suffix}`;
  return `${count} unmatched cards${suffix}`;
}
