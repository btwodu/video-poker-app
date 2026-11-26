import type { GameRules } from '../engine/evaluate';

export type GoalId = 'preserve' | 'return' | 'state' | 'rewards' | 'practice';
export type Level = 'preferred' | 'good' | 'situational' | 'pass' | 'unknown';
export type Pays = Record<string, number>;

export interface Preference { level: Level; reason: string }
export type GoalPreferences = Record<GoalId, Preference>;

export interface Source {
  title: string;
  citation: string;
  url: string | null;
  /** computed = reproduced by this app; published-extract = seen in a search extract of the page. */
  strength: 'computed' | 'published-extract';
  lastVerified: string;
  notes: string;
}

export interface PaytableConfig {
  id: string;
  label: string;
  pays: Pays;
  rtp: number;
  variance: number;
  sources: string[];
}

export interface StrategyLine {
  group?: string;
  text: string;
  /** A hand where this line is the correct play; verified against the solver in tests. */
  example: { hand: string; hold: string };
}

export interface BaseGame {
  id: string;
  kind: 'base';
  name: string;
  rules: GameRules;
  rows: { key: string; label: string }[];
  keyRows: string[];
  target: PaytableConfig & { volatility: string; volatilityNote: string };
  variants: { id: string; label: string; diff: Pays; rtp: number; variance: number; sources: string[] }[];
  tileNote: string;
  preference: GoalPreferences;
  strategy: { title: string; note: string; sources: string[]; lines: StrategyLine[] };
}

export interface StateRule { input: string; gte: number; deals: number }
export interface StateConfig { id: string; label: string; hands: number; rules: StateRule[]; sources: string[] }

export interface FeatureGame {
  id: string;
  kind: 'feature';
  name: string;
  tileHeadline: string;
  tileNote: string;
  summary: string;
  facts: { label: string; value: string; sources: string[] }[];
  wager: { coinsPerHand: number; coinsNote: string; handOptions: number[]; defaultHands: number };
  preference: GoalPreferences;
  state?: {
    fixedPrompt: string;
    inputs: { key: string; label: string; help: string }[];
    configs: StateConfig[];
    noRuleText: string;
  };
}

export type Game = BaseGame | FeatureGame;
