/** Paytable matching: resolve what the cabinet shows to a known configuration, or say it is unknown. */
import type { BaseGame, Pays, PaytableConfig } from '../data/types';

/** Every known configuration of a game, target first, with full pay rows. */
export function knownConfigs(game: BaseGame): PaytableConfig[] {
  return [
    game.target,
    ...game.variants.map((v) => ({
      id: v.id, label: v.label, pays: { ...game.target.pays, ...v.diff },
      rtp: v.rtp, variance: v.variance, sources: v.sources,
    })),
  ];
}

export interface RowDiff { key: string; label: string; actual: number; target: number }

export type MatchResult =
  | { status: 'match'; config: PaytableConfig; diffs: [] }
  | { status: 'below-target' | 'above-target'; config: PaytableConfig; diffs: RowDiff[] }
  | { status: 'unknown'; config: null; diffs: RowDiff[] };

const samePays = (game: BaseGame, a: Pays, b: Pays) => game.rows.every((r) => a[r.key] === b[r.key]);

/**
 * Compare an entered paytable with the rulebook. An RTP is only ever returned
 * for an exact match of every row; nothing is interpolated.
 */
export function matchPaytable(game: BaseGame, actual: Pays): MatchResult {
  const diffs: RowDiff[] = game.rows
    .filter((r) => actual[r.key] !== game.target.pays[r.key])
    .map((r) => ({ key: r.key, label: r.label, actual: actual[r.key], target: game.target.pays[r.key] }));
  const config = knownConfigs(game).find((c) => samePays(game, c.pays, actual));
  if (!config) return { status: 'unknown', config: null, diffs };
  if (config.id === game.target.id) return { status: 'match', config, diffs: [] };
  return { status: config.rtp < game.target.rtp ? 'below-target' : 'above-target', config, diffs };
}

export const formatRtp = (rtp: number): string => `${(rtp * 100).toFixed(2)}%`;
