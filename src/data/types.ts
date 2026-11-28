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
  /** Exact return of playing the game's strategy card line by line on this paytable. */
  cardRtp: number;
  sources: string[];
}

export interface StrategyLine {
  group?: string;
  text: string;
  /** Machine-readable form of the line (see src/strategy/card.ts); the tests play every deal with it. */
  rule: string;
  /** In wild games, the number of deuces dealt that this line applies to. */
  deuces?: number;
  /** A hand where this line is the first that fits and is the correct play; verified in tests. */
  example: { hand: string; hold: string };
}

export interface BaseGame {
  id: string;
  kind: 'base';
  name: string;
  rules: GameRules;
  rows: { key: string; label: string }[];
  keyRows: string[];
  target: Omit<PaytableConfig, 'cardRtp'> & { volatility: string; volatilityNote: string };
  variants: { id: string; label: string; diff: Pays; rtp: number; variance: number; cardRtp: number; sources: string[] }[];
  tileNote: string;
  preference: GoalPreferences;
  strategy: {
    title: string;
    note: string;
    /** Exact return of playing the card line by line, over every possible deal. */
    cardRtp: number;
    sources: string[];
    lines: StrategyLine[];
  };
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
