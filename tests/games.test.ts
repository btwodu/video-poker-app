import { describe, expect, it } from 'vitest';
import { BASE_GAMES, FEATURE_GAMES, GAMES, GOALS, SOURCES, findGame } from '../src/data';
import type { BaseGame, FeatureGame } from '../src/data/types';
import { formatRtp, knownConfigs, matchPaytable } from '../src/games/paytable';
import { actualPreference, targetPreference } from '../src/games/preference';
import { evaluateState, exitText, totalWager } from '../src/state-engine/evaluate';

const jacks = findGame('jacks-or-better') as BaseGame;
const doubleBonus = findGame('double-bonus') as BaseGame;
const deuces = findGame('deuces-wild') as BaseGame;
const streak = findGame('ultimate-x-bonus-streak') as FeatureGame;

describe('paytable matching', () => {
  it('exact match resolves to the target config', () => {
    const m = matchPaytable(jacks, { ...jacks.target.pays });
    expect(m.status).toBe('match');
    expect(m.config?.id).toBe('jacks-96');
    expect(formatRtp(m.config!.rtp)).toBe('99.54%');
  });
  it('known lesser table is below target with the differing rows listed', () => {
    const m = matchPaytable(jacks, { ...jacks.target.pays, fullHouse: 8, flush: 5 });
    expect(m.status).toBe('below-target');
    expect(m.config?.id).toBe('jacks-85');
    expect(m.diffs.map((d) => [d.key, d.actual, d.target])).toEqual([['fullHouse', 8, 9], ['flush', 5, 6]]);
  });
  it('unrecognized table is unknown and gets no RTP', () => {
    const m = matchPaytable(jacks, { ...jacks.target.pays, straight: 5 });
    expect(m.status).toBe('unknown');
    expect(m.config).toBeNull();
  });
  it('a change to a non-key row still prevents a match', () => {
    expect(matchPaytable(deuces, { ...deuces.target.pays, royal: 500 }).status).toBe('unknown');
  });
  it('every known config of every game resolves to itself', () => {
    for (const game of BASE_GAMES) for (const c of knownConfigs(game)) {
      expect(matchPaytable(game, c.pays).config?.id).toBe(c.id);
    }
  });
});

describe('game preference by goal', () => {
  it('bankroll goal prefers 9/6 Jacks over 10/7 Double Bonus despite the lower RTP', () => {
    expect(jacks.target.rtp).toBeLessThan(doubleBonus.target.rtp);
    expect(targetPreference(jacks, 'preserve').level).toBe('preferred');
    expect(targetPreference(doubleBonus, 'preserve').level).toBe('good');
  });
  it('return goal prefers Double Bonus and Deuces', () => {
    expect(targetPreference(doubleBonus, 'return').level).toBe('preferred');
    expect(targetPreference(deuces, 'return').level).toBe('preferred');
    expect(targetPreference(jacks, 'return').level).toBe('good');
  });
  it('state goal raises Bonus Streak and passes on base games', () => {
    expect(targetPreference(streak, 'state').level).toBe('preferred');
    expect(targetPreference(jacks, 'state').level).toBe('pass');
  });
  it('rewards goal prefers Ten Play', () => {
    expect(targetPreference(findGame('ten-play')!, 'rewards').level).toBe('preferred');
  });
  it('a weak actual paytable is a PASS, an unknown one is UNKNOWN', () => {
    const weak = matchPaytable(jacks, { ...jacks.target.pays, fullHouse: 8, flush: 5 });
    expect(actualPreference(jacks, 'preserve', weak).level).toBe('pass');
    const unknown = matchPaytable(jacks, { ...jacks.target.pays, straight: 5 });
    expect(actualPreference(jacks, 'preserve', unknown).level).toBe('unknown');
  });
  it('a lesser table never grades above the target table', () => {
    const nsud = matchPaytable(deuces, knownConfigs(deuces)[1].pays);
    expect(actualPreference(deuces, 'return', nsud).level).toBe('good');
    expect(actualPreference(deuces, 'preserve', nsud).level).toBe('good');
  });
  it('every game has a reasoned preference for every goal', () => {
    for (const game of GAMES) for (const goal of GOALS) {
      expect(game.preference[goal.id].reason.length).toBeGreaterThan(5);
    }
  });
});

describe('Bonus Streak threshold logic', () => {
  const cfg = (id: string) => streak.state!.configs.find((c) => c.id === id)!;
  const ddb = cfg('ddb-85-10play');

  it('qualifies on the next-hand total alone', () => {
    const d = evaluateState(ddb, { next1: 21 });
    expect(d.verdict).toBe('play');
    if (d.verdict === 'play') expect(d.deals).toBe(1);
  });
  it('one below every threshold is a pass', () => {
    expect(evaluateState(ddb, { next1: 20, next2: 33, next3: 42 }).verdict).toBe('pass');
  });
  it('project seed example (24 / 37 / 45) qualifies on all three', () => {
    const d = evaluateState(ddb, { next1: 24, next2: 37, next3: 45 });
    expect(d.verdict === 'play' && d.satisfied.length).toBe(3);
  });
  it('qualifying only on the three-hand total means playing three deals', () => {
    const d = evaluateState(ddb, { next1: 10, next2: 20, next3: 43 });
    expect(d.verdict === 'play' && d.deals).toBe(3);
    expect(exitText(3)).toContain('3 deals');
  });
  it('does not pass until every total has been entered', () => {
    expect(evaluateState(ddb, { next1: 12 }).verdict).toBe('incomplete');
  });
  it('thresholds are configuration-specific', () => {
    const state = { next1: 21, next2: 33, next3: 43 };
    expect(evaluateState(ddb, state).verdict).toBe('play');
    expect(evaluateState(cfg('ddb-65-5play'), { next1: 10, next2: 17, next3: 25 }).verdict).toBe('pass');
    expect(evaluateState(cfg('dw-10play'), { next1: 20, next2: 33, next3: 43 }).verdict).toBe('play'); // next2 >= 32
    expect(evaluateState(ddb, { next1: 20, next2: 33, next3: 42 }).verdict).toBe('pass');
  });
  it('an unlisted configuration has no rule, whatever the state', () => {
    expect(evaluateState(null, { next1: 99, next2: 99, next3: 99 }).verdict).toBe('no-rule');
  });
  it('plain Ultimate X has no sourced rule', () => {
    const ux = findGame('ultimate-x') as FeatureGame;
    expect(ux.state!.configs).toHaveLength(0);
    expect(evaluateState(null, { next1: 40 }).verdict).toBe('no-rule');
  });
});

describe('wager exposure', () => {
  it('quarter Ten Play at max coins is $12.50 a deal', () => expect(totalWager(0.25, 5, 10)).toBe(12.5));
  it('Bonus Streak costs 10 credits a hand', () => expect(totalWager(0.25, streak.wager.coinsPerHand, 10)).toBe(25));
});

describe('source discipline', () => {
  const check = (ids: string[], where: string) => {
    expect(ids.length, `${where} has no source`).toBeGreaterThan(0);
    for (const id of ids) expect(SOURCES[id], `${where}: unknown source ${id}`).toBeDefined();
  };
  it('every paytable config and strategy cites a known source', () => {
    for (const game of BASE_GAMES) {
      for (const c of knownConfigs(game)) check(c.sources, c.id);
      check(game.strategy.sources, `${game.id} strategy`);
    }
  });
  it('every state threshold config cites a known source', () => {
    for (const game of FEATURE_GAMES) for (const c of game.state?.configs ?? []) check(c.sources, c.id);
  });
  it('feature facts only cite known sources', () => {
    for (const game of FEATURE_GAMES) for (const f of game.facts) for (const id of f.sources) expect(SOURCES[id]).toBeDefined();
  });
});
