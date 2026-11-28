import type { BaseGame, PaytableConfig } from '../data/types';
import { cardFit, formatRtp } from '../games/paytable';

/** The game's hold order, with what it measures to on the given paytable. */
export function StrategyCard({ game, config }: { game: BaseGame; config: PaytableConfig }) {
  const lines = game.strategy.lines;
  const { cost } = cardFit(config);
  return (
    <>
      <p className="muted small">{game.strategy.note}</p>
      <ol className="strategy">
        {lines.map((line, i) => (
          <li key={i}>
            {line.group && line.group !== lines[i - 1]?.group && <span className="group">{line.group}</span>}
            {line.text}
          </li>
        ))}
      </ol>
      <p className="muted small">
        On the {config.label} table this card returns {formatRtp(config.cardRtp)} when followed exactly — within{' '}
        {(cost * 100).toFixed(3)} of a point of perfect play, measured over every possible deal.
      </p>
    </>
  );
}
