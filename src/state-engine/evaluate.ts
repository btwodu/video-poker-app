/** Persistent-state decision: does the visible state meet a sourced entry rule for this exact configuration? */
import type { StateConfig, StateRule } from '../data/types';

export type StateDecision =
  | { verdict: 'no-rule' }
  | { verdict: 'incomplete' }
  | { verdict: 'pass'; closest: { rule: StateRule; value: number } | null }
  | { verdict: 'play'; satisfied: StateRule[]; deals: number };

/**
 * @param config  the selected sourced configuration, or null for "other / not listed"
 * @param values  observed totals by input key; missing keys have not been entered
 */
export function evaluateState(config: StateConfig | null, values: Record<string, number | undefined>): StateDecision {
  if (!config || config.rules.length === 0) return { verdict: 'no-rule' };
  const entered = config.rules.filter((r) => values[r.input] !== undefined);
  const satisfied = entered.filter((r) => (values[r.input] as number) >= r.gte);
  if (satisfied.length > 0) {
    // The thesis is the abandoned multipliers that qualified: play until they are used up.
    return { verdict: 'play', satisfied, deals: Math.max(...satisfied.map((r) => r.deals)) };
  }
  if (entered.length < config.rules.length) return { verdict: 'incomplete' };
  let closest: { rule: StateRule; value: number } | null = null;
  for (const rule of entered) {
    const value = values[rule.input] as number;
    if (!closest || rule.gte - value < closest.rule.gte - closest.value) closest = { rule, value };
  }
  return { verdict: 'pass', closest };
}

/** Plain-language exit instruction for a PLAY decision. */
export function exitText(deals: number): string {
  const span = deals === 1 ? 'one deal' : `${deals} deals`;
  return `Play ${span} at the full feature bet — that uses up the abandoned multipliers that qualified. Then stop and re-enter what is on screen; keep playing only if it qualifies again.`;
}

/** Total wagered per deal in dollars. */
export const totalWager = (denomination: number, coinsPerHand: number, hands: number): number =>
  Math.round(denomination * coinsPerHand * hands * 100) / 100;
