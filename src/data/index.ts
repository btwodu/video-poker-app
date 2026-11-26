/** Single entry point for all rule/config data. Numbers live in the JSON files, never in components. */
import jacks from './video-poker/jacks-or-better.json';
import bonus from './video-poker/bonus-poker.json';
import doubleBonus from './video-poker/double-bonus.json';
import tripleBonus from './video-poker/triple-bonus.json';
import deuces from './video-poker/deuces-wild.json';
import superTimesPay from './video-poker/super-times-pay.json';
import tenPlay from './video-poker/ten-play.json';
import ultimateX from './video-poker/ultimate-x.json';
import bonusStreak from './video-poker/ultimate-x-bonus-streak.json';
import sourcesJson from './sources.json';
import preferenceRules from './preference-rules.json';
import type { BaseGame, FeatureGame, Game, GoalId, Level, Source } from './types';

export const BASE_GAMES = [jacks, bonus, doubleBonus, tripleBonus, deuces] as unknown as BaseGame[];
export const FEATURE_GAMES = [superTimesPay, tenPlay, ultimateX, bonusStreak] as unknown as FeatureGame[];
export const GAMES: Game[] = [...BASE_GAMES, ...FEATURE_GAMES];

export const SOURCES = sourcesJson as unknown as Record<string, Source>;
export const GOALS = preferenceRules.goals as { id: GoalId; label: string; short: string }[];
export const VARIANT_LEVELS = preferenceRules.variantLevels as { minRtp: number; level: Level; reason: string }[];

export const findGame = (id: string): Game | undefined => GAMES.find((g) => g.id === id);
