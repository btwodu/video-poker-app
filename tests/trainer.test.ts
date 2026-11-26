// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { holdMask, parseHand } from '../src/engine/cards';
import { findGame } from '../src/data';
import type { BaseGame } from '../src/data/types';
import { gradeAnswer, makeQuestion, nextQuestion, recordAnswer, weakSpots } from '../src/trainer/engine';
import { emptyStats, loadActualPays, loadGoal, loadStats, saveActualPays, saveGoal, saveStats } from '../src/storage/store';

const jacks = findGame('jacks-or-better') as BaseGame;
const pays = jacks.target.pays;
const seeded = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);

describe('trainer answers', () => {
  const hand = parseHand('8c 8d 2c 5c Kc');
  const q = makeQuestion(jacks, pays, hand);

  it('accepts the solver hold', () => {
    const g = gradeAnswer(jacks, pays, q, holdMask(hand, parseHand('8c 2c 5c Kc')));
    expect(g.correct).toBe(true);
    expect(g.bestLabel).toBe('Four to a flush');
  });
  it('rejects the low pair and explains the cost', () => {
    const g = gradeAnswer(jacks, pays, q, holdMask(hand, parseHand('8c 8d')));
    expect(g.correct).toBe(false);
    expect(g.chosenLabel).toBe('Low pair');
    expect(g.bestEv - g.chosenEv).toBeCloseTo(0.3891, 3);
    expect(g.reason).toContain('1.213');
  });
  it('treats equal-value holds as correct', () => {
    const quads = parseHand('Ks Kh Kd Kc 3s');
    const qq = makeQuestion(jacks, pays, quads);
    expect(gradeAnswer(jacks, pays, qq, 31).correct).toBe(true);
    expect(gradeAnswer(jacks, pays, qq, 15).correct).toBe(true);
  });
  it('names a made hand when all five are held', () => {
    const flush = parseHand('2h 6h 9h Jh Kh');
    expect(makeQuestion(jacks, pays, flush).category).toBe('Made hand: Flush');
  });
  it('random questions always carry a solved answer', () => {
    const rand = seeded(7);
    for (let i = 0; i < 5; i++) {
      const question = nextQuestion(jacks, pays, 'random', emptyStats(), rand);
      expect(question.hand).toHaveLength(5);
      expect(gradeAnswer(jacks, pays, question, question.result.bestMask).correct).toBe(true);
    }
  });
});

describe('trainer scoring', () => {
  const hand = parseHand('8c 8d 2c 5c Kc');
  const q = makeQuestion(jacks, pays, hand);
  const right = gradeAnswer(jacks, pays, q, q.result.bestMask);
  const wrong = gradeAnswer(jacks, pays, q, holdMask(hand, parseHand('8c 8d')));

  it('tracks attempts, accuracy, streak and mistake categories', () => {
    let s = emptyStats();
    s = recordAnswer(s, q, right);
    s = recordAnswer(s, q, right);
    s = recordAnswer(s, q, wrong);
    expect(s).toMatchObject({ attempted: 3, correct: 2, streak: 0, bestStreak: 2 });
    expect(s.missed['Four to a flush']).toBe(1);
    expect(s.seen['Four to a flush']).toBe(3);
    expect(s.evLost).toBeCloseTo(0.3891, 3);
    expect(weakSpots(s)).toEqual(['Four to a flush']);
  });
  it('weak-spot mode deals hands from the missed category', () => {
    const s = recordAnswer(emptyStats(), q, wrong);
    const question = nextQuestion(jacks, pays, 'weak', s, seeded(3));
    expect(question.category).toBe('Four to a flush');
  });
});

describe('local persistence', () => {
  beforeEach(() => localStorage.clear());

  it('training score survives a reload', () => {
    const s = { ...emptyStats(), attempted: 12, correct: 9, streak: 4, bestStreak: 6, missed: { 'Low pair': 2 } };
    saveStats('jacks-96', s);
    expect(loadStats('jacks-96')).toMatchObject({ attempted: 12, correct: 9, bestStreak: 6, missed: { 'Low pair': 2 } });
    expect(loadStats('bonus-85').attempted).toBe(0);
  });
  it('goal and entered paytable persist', () => {
    expect(loadGoal()).toBe('preserve');
    saveGoal('return');
    saveActualPays('jacks-or-better', { ...pays, flush: 5 });
    expect(loadGoal()).toBe('return');
    expect(loadActualPays('jacks-or-better')?.flush).toBe(5);
  });
  it('corrupt storage falls back to defaults', () => {
    localStorage.setItem('crb.v1.goal', '{not json');
    expect(loadGoal()).toBe('preserve');
  });
});
