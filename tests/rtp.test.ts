import { describe, expect, it } from 'vitest';
import { exactReturn, forEachHand, TOTAL_HANDS } from '../src/engine/rtp';
import { compileCard } from '../src/strategy/card';
import { BASE_GAMES } from '../src/data';
import { knownConfigs } from '../src/games/paytable';

// Recomputes every return and variance in the data files from scratch
// (2,598,960 deals x 32 holds each). Slow by design: about 3 s per paytable.
describe('RTP / config mapping is reproduced by the exact solver', () => {
  for (const game of BASE_GAMES) {
    for (const config of knownConfigs(game)) {
      it(`${game.name} ${config.label}`, () => {
        const result = exactReturn(game.rules, config.pays);
        expect(result.rtp).toBeCloseTo(config.rtp, 5);
        expect(result.variance).toBeCloseTo(config.variance, 2);
      });
    }
  }
});

describe('benchmark returns match the published figures', () => {
  const published: Record<string, number> = {
    'jacks-96': 99.54, 'bonus-85': 99.17, 'double-bonus-1075': 100.17,
    'deuces-full-pay': 100.76, 'triple-bonus-1075': 99.94,
  };
  for (const game of BASE_GAMES) {
    it(game.name, () => expect(+(game.target.rtp * 100).toFixed(2)).toBe(published[game.target.id]));
  }
});

// Plays all 2,598,960 deals by each printed strategy card and compares with perfect play.
describe('strategy cards, played line by line over every deal', () => {
  for (const game of BASE_GAMES) {
    it(`${game.name}: card return matches the data and is within 0.02% of optimal`, () => {
      const card = compileCard(game.rules, game.strategy.lines);
      let total = 0;
      forEachHand(game.rules, game.target.pays, (hand, evs) => { total += evs[card.play(hand).mask]; });
      const cardRtp = total / TOTAL_HANDS;
      expect(cardRtp).toBeCloseTo(game.strategy.cardRtp, 5);
      expect(game.target.rtp - cardRtp).toBeLessThan(0.0002);
      expect(game.target.rtp - cardRtp).toBeGreaterThanOrEqual(0);
    });
  }
});
