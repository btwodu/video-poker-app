/** Trainer question engine. Every answer comes from the exact solver for the exact paytable. */
import { cardLabel, cardsInMask, dealHand, type Card } from '../engine/cards';
import { describeHold } from '../engine/describe';
import { compilePays, evaluatorFor, rowKeyForCode, type GameRules } from '../engine/evaluate';
import { isOptimalHold, solveHand, type HoldResult } from '../engine/solver';
import type { BaseGame, Pays } from '../data/types';
import type { TrainerStats } from '../storage/store';

export interface Question {
  hand: Card[];
  result: HoldResult;
  /** Category of the correct hold, used for mistake tracking. */
  category: string;
}

/** Label for a hold, naming the paying hand when all five cards are kept. */
export function labelHold(game: BaseGame, pays: Pays, hand: Card[], mask: number): string {
  let made: string | undefined;
  if (mask === 31) {
    const code = evaluatorFor(game.rules.family)(hand[0], hand[1], hand[2], hand[3], hand[4]);
    const key = rowKeyForCode(game.rules, pays, code);
    if (key && compilePays(game.rules, pays)[code] > 0) made = game.rows.find((r) => r.key === key)?.label;
  }
  return describeHold(game.rules as GameRules, hand, mask, made);
}

export function makeQuestion(game: BaseGame, pays: Pays, hand: Card[]): Question {
  const result = solveHand(game.rules, pays, hand);
  return { hand, result, category: labelHold(game, pays, hand, result.bestMask) };
}

/** Categories the player misses most (at least one miss), worst first. */
export function weakSpots(stats: TrainerStats, limit = 3): string[] {
  return Object.entries(stats.missed)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] / (stats.seen[b[0]] || 1) - a[1] / (stats.seen[a[0]] || 1) || b[1] - a[1])
    .slice(0, limit)
    .map(([category]) => category);
}

/**
 * Deal the next question. Random mode skips most "discard everything" hands so
 * practice time goes to real decisions; weak-spot mode looks for hands whose
 * correct play is in one of the player's most-missed categories.
 */
export function nextQuestion(
  game: BaseGame, pays: Pays, mode: 'random' | 'weak', stats: TrainerStats, rand: () => number = Math.random,
): Question {
  const targets = mode === 'weak' ? weakSpots(stats) : [];
  let question = makeQuestion(game, pays, dealHand(rand));
  for (let tries = 0; tries < 20; tries++) {
    const wanted = targets.length
      ? targets.includes(question.category)
      : question.result.bestMask !== 0 || rand() < 0.25;
    if (wanted) break;
    question = makeQuestion(game, pays, dealHand(rand));
  }
  return question;
}

export interface Grade {
  correct: boolean;
  chosenLabel: string;
  bestLabel: string;
  chosenEv: number;
  bestEv: number;
  bestCards: string;
  reason: string;
}

export function gradeAnswer(game: BaseGame, pays: Pays, question: Question, mask: number): Grade {
  const { hand, result } = question;
  const correct = isOptimalHold(result, mask);
  const chosenLabel = labelHold(game, pays, hand, mask);
  const bestLabel = question.category;
  const chosenEv = result.evs[mask], bestEv = result.bestEv;
  const reason = correct
    ? `${bestLabel} is the highest expected return for this paytable: ${bestEv.toFixed(3)} bets on average.`
    : `${bestLabel} returns ${bestEv.toFixed(3)} bets on average; ${chosenLabel.toLowerCase()} returns ${chosenEv.toFixed(3)}. That choice gives up ${(bestEv - chosenEv).toFixed(3)} bets.`;
  return {
    correct, chosenLabel, bestLabel, chosenEv, bestEv, reason,
    bestCards: cardsInMask(hand, result.bestMask).map(cardLabel).join(' ') || 'none',
  };
}

export function recordAnswer(stats: TrainerStats, question: Question, grade: Grade): TrainerStats {
  const streak = grade.correct ? stats.streak + 1 : 0;
  const bump = (map: Record<string, number>) => ({ ...map, [question.category]: (map[question.category] ?? 0) + 1 });
  return {
    attempted: stats.attempted + 1,
    correct: stats.correct + (grade.correct ? 1 : 0),
    streak,
    bestStreak: Math.max(stats.bestStreak, streak),
    evLost: stats.evLost + (grade.bestEv - grade.chosenEv),
    seen: bump(stats.seen),
    missed: grade.correct ? stats.missed : bump(stats.missed),
  };
}
