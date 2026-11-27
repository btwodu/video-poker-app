import { describe, expect, it } from 'vitest';
import { holdMask, parseHand } from '../src/engine/cards';
import { D, J, evalDeuces, evalJacks } from '../src/engine/evaluate';
import { isOptimalHold, solveHand } from '../src/engine/solver';
import { describeHold } from '../src/engine/describe';
import { BASE_GAMES } from '../src/data';
import { compileCard } from '../src/strategy/card';

const ev = (fn: typeof evalJacks, text: string) => { const h = parseHand(text); return fn(h[0], h[1], h[2], h[3], h[4]); };

describe('hand evaluators', () => {
  it('classifies non-wild hands', () => {
    expect(ev(evalJacks, 'As Ks Qs Js Ts')).toBe(J.ROYAL);
    expect(ev(evalJacks, 'As 2s 3s 4s 5s')).toBe(J.STRAIGHT_FLUSH);
    expect(ev(evalJacks, 'Ac Ad Ah As 5s')).toBe(J.QUADS_A);
    expect(ev(evalJacks, '3c 3d 3h 3s 5s')).toBe(J.QUADS_24);
    expect(ev(evalJacks, '9c 9d 9h 9s 5s')).toBe(J.QUADS_5K);
    expect(ev(evalJacks, '9c 9d 9h 5d 5s')).toBe(J.FULL_HOUSE);
    expect(ev(evalJacks, 'Ac 2d 3h 4d 5s')).toBe(J.STRAIGHT);
    expect(ev(evalJacks, 'Qc Kd Ah 2d 3s')).toBe(J.NOTHING);
    expect(ev(evalJacks, 'Jc Jd 3h 4d 5s')).toBe(J.PAIR_JQ);
    expect(ev(evalJacks, 'Kc Kd 3h 4d 5s')).toBe(J.PAIR_KA);
    expect(ev(evalJacks, 'Tc Td 3h 4d 5s')).toBe(J.NOTHING);
  });

  it('classifies deuces-wild hands', () => {
    expect(ev(evalDeuces, 'As Ks Qs Js Ts')).toBe(D.NATURAL_ROYAL);
    expect(ev(evalDeuces, '2c 2d 2h 2s 9d')).toBe(D.FOUR_DEUCES);
    expect(ev(evalDeuces, '2c Ks Qs Js Ts')).toBe(D.WILD_ROYAL);
    expect(ev(evalDeuces, '2c 2d 9h 9s 9d')).toBe(D.FIVE_KIND);
    expect(ev(evalDeuces, '2c 3s 4s 5s As')).toBe(D.STRAIGHT_FLUSH);
    expect(ev(evalDeuces, '2c 9d 9h Ks Kd')).toBe(D.FULL_HOUSE);
    expect(ev(evalDeuces, '2c 9d 9h Ks 4d')).toBe(D.TRIPS);
    expect(ev(evalDeuces, '2c 5d 6h 7s 9d')).toBe(D.STRAIGHT);
    expect(ev(evalDeuces, '2c 5d 6h 7s Td')).toBe(D.NOTHING);
    expect(ev(evalDeuces, '9c 9d Kh Ks 4d')).toBe(D.NOTHING);
  });
});

describe('strategy card examples', () => {
  for (const game of BASE_GAMES) {
    const card = compileCard(game.rules, game.strategy.lines);
    game.strategy.lines.forEach((line, index) => {
      it(`${game.name}: ${line.text} (${line.example.hand})`, () => {
        const hand = parseHand(line.example.hand).sort((x, y) => x - y);
        const held = holdMask(hand, line.example.hold ? parseHand(line.example.hold) : []);
        // The example must be decided by this very line, and the solver must agree with it.
        expect(card.play(hand)).toEqual({ mask: held, line: index });
        expect(isOptimalHold(solveHand(game.rules, game.target.pays, hand), held)).toBe(true);
      });
    });
  }
});

describe('known close decisions', () => {
  const game = (id: string) => BASE_GAMES.find((g) => g.id === id)!;
  const best = (id: string, hand: string) => {
    const g = game(id); const h = parseHand(hand);
    const r = solveHand(g.rules, g.target.pays, h);
    return { r, h, label: describeHold(g.rules, h, r.bestMask) };
  };

  it('9/6 Jacks: published expected values', () => {
    const { r, h } = best('jacks-or-better', '8c 8d 2c 5c Kc');
    expect(r.evs[holdMask(h, parseHand('8c 2c 5c Kc'))]).toBeCloseTo(1.2128, 4); // four to a flush
    expect(r.evs[holdMask(h, parseHand('8c 8d'))]).toBeCloseTo(0.8237, 4); // low pair
  });
  it('9/6 Jacks: four to a flush beats a low pair but not a high pair', () => {
    expect(best('jacks-or-better', '8c 8d 2c 5c Kc').label).toBe('Four to a flush');
    expect(best('jacks-or-better', 'Kc Kd 2c 5c 9c').label).toBe('High pair');
  });
  it('9/6 Jacks: low pair beats an outside straight draw', () => {
    expect(best('jacks-or-better', '8c 8d 9h Ts Jd').label).toBe('Low pair');
  });
  it('Double Bonus: outside straight draw beats a low pair; aces break a full house', () => {
    expect(best('double-bonus', '8c 8d 9h Ts Jd').label).toBe('Four to an outside straight');
    expect(best('double-bonus', 'Ac Ad Ah 7s 7d').label).toBe('Three of a kind');
    expect(best('double-bonus', 'Kc Kd Kh 7s 7d').r.bestMask).toBe(31);
  });
  it('Double Bonus: four to a flush beats three to a royal', () => {
    expect(best('double-bonus', 'Kh Qh Th 7h 3d').label).toBe('Four to a flush');
  });
  it('Triple Bonus: aces break two pair; queens are a low pair', () => {
    expect(best('triple-bonus', 'Ac Ad 4s 4h 9s').label).toBe('High pair');
    expect(best('triple-bonus', 'Qc Qd 9h 5s 3d').label).toBe('Low pair');
  });
  it('Deuces Wild: keep one pair of two; high cards are worthless', () => {
    expect(best('deuces-wild', '9c 9d Ks Kd 4h').label).toBe('Pair');
    expect(best('deuces-wild', 'Ac Kd Js 7h 3c').r.bestMask).toBe(0);
    expect(best('deuces-wild', '2c 2d 2h 9s 9d').label).toBe('Three deuces only');
    expect(best('deuces-wild', 'Ah Kh 7c 5d 3s').r.bestMask).toBe(0);
  });
  it('strategy is paytable-specific: same hand, different play', () => {
    expect(best('jacks-or-better', '8c 8d 9h Ts Jd').label).not.toBe(best('double-bonus', '8c 8d 9h Ts Jd').label);
  });
});
