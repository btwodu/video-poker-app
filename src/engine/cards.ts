/**
 * Card primitives. A card is an integer 0..51:
 *   rank = card >> 2  (0 = Two ... 8 = Ten, 9 = Jack, 10 = Queen, 11 = King, 12 = Ace)
 *   suit = card & 3   (0 ♣, 1 ♦, 2 ♥, 3 ♠)
 */
export type Card = number;

export const RANK_CHARS = '23456789TJQKA';
export const SUIT_CHARS = 'cdhs';
export const SUIT_SYMBOLS = ['♣', '♦', '♥', '♠'];

export const rankOf = (c: Card): number => c >> 2;
export const suitOf = (c: Card): number => c & 3;

/** Display text such as "10♣" or "K♦". */
export function cardLabel(c: Card): string {
  const r = RANK_CHARS[rankOf(c)];
  return (r === 'T' ? '10' : r) + SUIT_SYMBOLS[suitOf(c)];
}

/** Parse "8c", "Td", "10h", "K♠" into a card. Throws on bad input. */
export function parseCard(text: string): Card {
  const t = text.trim().replace(/^10/, 'T');
  const rank = RANK_CHARS.indexOf(t[0]?.toUpperCase() ?? '');
  let suit = SUIT_CHARS.indexOf(t[1]?.toLowerCase() ?? '');
  if (suit < 0) suit = SUIT_SYMBOLS.indexOf(t[1] ?? '');
  if (rank < 0 || suit < 0 || t.length !== 2) throw new Error(`Bad card "${text}"`);
  return rank * 4 + suit;
}

/** Parse a space-separated hand such as "8c 8d 2c 5c Kc". */
export function parseHand(text: string): Card[] {
  const cards = text.trim().split(/\s+/).filter(Boolean).map(parseCard);
  if (new Set(cards).size !== cards.length) throw new Error(`Duplicate card in "${text}"`);
  return cards;
}

/** Bitmask (bit i = card i of the hand is held) for the given held cards. */
export function holdMask(hand: Card[], held: Card[]): number {
  let mask = 0;
  for (const c of held) {
    const i = hand.indexOf(c);
    if (i < 0) throw new Error('Held card is not in the hand');
    mask |= 1 << i;
  }
  return mask;
}

export function cardsInMask(hand: Card[], mask: number): Card[] {
  return hand.filter((_, i) => mask & (1 << i));
}

/** Deal five distinct random cards. `rand` is injectable for tests. */
export function dealHand(rand: () => number = Math.random): Card[] {
  const hand: Card[] = [];
  while (hand.length < 5) {
    const c = Math.floor(rand() * 52);
    if (!hand.includes(c)) hand.push(c);
  }
  return hand;
}
