/** Goal-dependent preference badges. Grades come from config data; this only combines them. */
import { VARIANT_LEVELS } from '../data';
import type { BaseGame, Game, GoalId, Level, Preference } from '../data/types';
import type { MatchResult } from './paytable';

const ORDER: Level[] = ['preferred', 'good', 'situational', 'pass'];

export const LEVEL_BADGE: Record<Level, { icon: string; text: string }> = {
  preferred: { icon: '⭐', text: 'PREFERRED' },
  good: { icon: '✓', text: 'GOOD' },
  situational: { icon: '⚠', text: 'SITUATIONAL' },
  pass: { icon: '✕', text: 'PASS' },
  unknown: { icon: '?', text: 'UNKNOWN' },
};

/** Preference for a game's benchmark configuration under a goal. */
export const targetPreference = (game: Game, goal: GoalId): Preference => game.preference[goal];

/** Preference for the paytable actually on the machine. */
export function actualPreference(game: BaseGame, goal: GoalId, match: MatchResult): Preference {
  const target = game.preference[goal];
  if (match.status === 'unknown') return { level: 'unknown', reason: 'Paytable not in rulebook' };
  if (match.status === 'match' || match.status === 'above-target') return target;
  // A lesser table changes nothing for goals that do not depend on return.
  if (goal === 'state' || target.level === 'pass' || target.level === 'unknown') return target;
  const rule = VARIANT_LEVELS.find((r) => match.config.rtp >= r.minRtp)!;
  if (goal === 'practice') {
    return { level: target.level, reason: `${target.reason} (practice only — this table is ${match.config.label})` };
  }
  // Never grade a lesser table above the target table.
  const level = ORDER[Math.max(ORDER.indexOf(rule.level), ORDER.indexOf(target.level))];
  return { level, reason: rule.reason };
}
