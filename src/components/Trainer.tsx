import { useEffect, useMemo, useState } from 'react';
import type { BaseGame } from '../data/types';
import { cardLabel, cardsInMask, rankOf, suitOf } from '../engine/cards';
import { matchPaytable } from '../games/paytable';
import { emptyStats, loadActualPays, loadStats, saveStats, type TrainerStats } from '../storage/store';
import { gradeAnswer, labelHold, nextQuestion, recordAnswer, weakSpots, type Grade, type Question } from '../trainer/engine';
import { Page, Section } from './common';

export function Trainer({ game }: { game: BaseGame }) {
  // Train against the table on the machine if one was entered, else the benchmark.
  const pays = useMemo(() => loadActualPays(game.id) ?? game.target.pays, [game]);
  const match = useMemo(() => matchPaytable(game, pays), [game, pays]);
  const configId = match.config?.id ?? `custom.${game.id}.${game.rows.map((r) => pays[r.key]).join('-')}`;
  const tableName = match.config ? `${match.config.label} ${game.name}` : `Custom ${game.name} table`;

  const [stats, setStats] = useState<TrainerStats>(() => loadStats(configId));
  const [mode, setMode] = useState<'random' | 'weak'>('random');
  const [question, setQuestion] = useState<Question | null>(null);
  const [held, setHeld] = useState(0);
  const [grade, setGrade] = useState<Grade | null>(null);

  const deal = (nextMode = mode, current = stats) => {
    setQuestion(null); setGrade(null); setHeld(0);
    // Solve after the "Dealing" state has painted.
    setTimeout(() => setQuestion(nextQuestion(game, pays, nextMode, current)), 20);
  };
  useEffect(() => { deal(); /* first hand */ }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = () => {
    if (!question) return;
    const result = gradeAnswer(game, pays, question, held);
    const updated = recordAnswer(stats, question, result);
    setGrade(result); setStats(updated); saveStats(configId, updated);
  };
  const reset = () => { const fresh = emptyStats(); setStats(fresh); saveStats(configId, fresh); };
  const switchMode = (m: 'random' | 'weak') => { setMode(m); deal(m); };

  const accuracy = stats.attempted ? Math.round((stats.correct / stats.attempted) * 100) : null;
  const weak = weakSpots(stats, 5);
  const topHolds = question && grade
    ? question.result.evs.map((ev, mask) => ({ ev, mask })).sort((a, b) => b.ev - a.ev).slice(0, 3)
    : [];

  return (
    <Page title="Trainer" back={`#/game/${game.id}`}>
      <Section title={tableName} felt>
        <div className="scores">
          <div><strong>{stats.attempted}</strong><span>hands</span></div>
          <div><strong>{accuracy === null ? '–' : `${accuracy}%`}</strong><span>accuracy</span></div>
          <div><strong>{stats.streak}</strong><span>streak</span></div>
          <div><strong>{stats.bestStreak}</strong><span>best</span></div>
        </div>
        <div className="chips">
          <button type="button" className={mode === 'random' ? 'chip on' : 'chip'} onClick={() => switchMode('random')}>Random hands</button>
          <button type="button" className={mode === 'weak' ? 'chip on' : 'chip'} disabled={weak.length === 0} onClick={() => switchMode('weak')}>My weak spots</button>
        </div>

        <p className="prompt">{question ? (grade ? 'Result' : 'What do you hold?') : 'Dealing…'}</p>
        <div className="hand">
          {(question?.hand ?? [-1, -1, -1, -1, -1]).map((card, i) => {
            if (card < 0) return <div key={i} className="playing-card blank" />;
            const on = (held & (1 << i)) !== 0;
            const best = grade && (question!.result.bestMask & (1 << i)) !== 0;
            const red = suitOf(card) === 1 || suitOf(card) === 2;
            return (
              <button
                type="button" key={card} disabled={!!grade} aria-pressed={on}
                aria-label={`${cardLabel(card)}${on ? ', held' : ''}`}
                className={`playing-card${on && !grade ? ' held' : ''}${best ? ' best' : ''}${red ? ' red' : ''}`}
                onClick={() => setHeld(held ^ (1 << i))}
              >
                <span className="rank">{rankOf(card) === 8 ? '10' : cardLabel(card).slice(0, -1)}</span>
                <span className="suit">{cardLabel(card).slice(-1)}</span>
                <span className="tag">{best ? 'BEST' : on ? 'HELD' : ''}</span>
              </button>
            );
          })}
        </div>

        {!grade && (
          <button type="button" className="btn" disabled={!question} onClick={submit}>
            {held === 0 ? 'Discard all five' : `Hold ${cardsInMask(question?.hand ?? [], held).length} card${held & (held - 1) ? 's' : ''}`}
          </button>
        )}
        {grade && question && (
          <>
            <div className={grade.correct ? 'verdict verdict-play' : 'verdict verdict-pass'}>
              <strong>{grade.correct ? 'CORRECT' : 'INCORRECT'}</strong>
              {!grade.correct && <span>You held: {cardsInMask(question.hand, held).map(cardLabel).join(' ') || 'nothing'} ({grade.chosenLabel})</span>}
              <span>Correct hold: {grade.bestCards} ({grade.bestLabel})</span>
              <span>{grade.reason}</span>
            </div>
            <table className="paytable">
              <tbody>
                {topHolds.map((h) => (
                  <tr key={h.mask} className={h.mask === held ? 'key' : ''}>
                    <td>{labelHold(game, pays, question.hand, h.mask)}</td>
                    <td className="num">{h.ev.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="small muted">Average return in bets for the three best holds, from the exact solver.</p>
            <button type="button" className="btn" onClick={() => deal()}>Next hand</button>
          </>
        )}
      </Section>

      <Section title="Commonly missed">
        {weak.length === 0 ? <p className="muted">No mistakes recorded yet.</p> : (
          <ul className="missed">
            {weak.map((c) => <li key={c}><span>{c}</span><span>{stats.missed[c]} of {stats.seen[c]} missed</span></li>)}
          </ul>
        )}
        {stats.attempted > 0 && (
          <p className="small muted">
            Mistakes so far have given up {stats.evLost.toFixed(2)} bets of expected return over {stats.attempted} hand{stats.attempted === 1 ? '' : 's'}{' '}
            ({((stats.evLost / stats.attempted) * 100).toFixed(2)}% of each bet on average).
          </p>
        )}
        <button type="button" className="btn ghost" onClick={reset}>Reset score for this table</button>
      </Section>
    </Page>
  );
}
