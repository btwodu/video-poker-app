/**
 * Local persistence (localStorage, JSON). Everything stays on the device.
 * All access is wrapped so the app still works when storage is unavailable.
 */
import type { GoalId, Pays } from '../data/types';

const PREFIX = 'crb.v1.';

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function save<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: keep working in memory */
  }
}

export const loadGoal = (): GoalId => load<GoalId>('goal', 'preserve');
export const saveGoal = (goal: GoalId) => save('goal', goal);

/** The paytable the player last entered for a game (what is on the machine). */
export const loadActualPays = (gameId: string): Pays | null => load<Pays | null>(`pays.${gameId}`, null);
export const saveActualPays = (gameId: string, pays: Pays | null) => save(`pays.${gameId}`, pays);

export interface TrainerStats {
  attempted: number;
  correct: number;
  streak: number;
  bestStreak: number;
  /** Expected return given up across all mistakes, in bets. */
  evLost: number;
  /** Misses keyed by the hold that was correct, e.g. "Four to a flush". */
  missed: Record<string, number>;
  /** Attempts keyed the same way, so a miss rate can be shown. */
  seen: Record<string, number>;
}

export const emptyStats = (): TrainerStats =>
  ({ attempted: 0, correct: 0, streak: 0, bestStreak: 0, evLost: 0, missed: {}, seen: {} });

export const loadStats = (configId: string): TrainerStats =>
  ({ ...emptyStats(), ...load<Partial<TrainerStats>>(`trainer.${configId}`, {}) });
export const saveStats = (configId: string, stats: TrainerStats) => save(`trainer.${configId}`, stats);

export interface Observation {
  id: string;
  time: string;
  game: string;
  casino: string;
  machine: string;
  denomination: string;
  bet: string;
  paytable: string;
  state: string;
  outcome: string;
  notes: string;
}

export const loadObservations = (): Observation[] => load<Observation[]>('observations', []);
export const saveObservations = (list: Observation[]) => save('observations', list);
