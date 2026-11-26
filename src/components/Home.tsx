import { BASE_GAMES, FEATURE_GAMES, GOALS } from '../data';
import type { Game, GoalId, Level } from '../data/types';
import { formatRtp } from '../games/paytable';
import { targetPreference } from '../games/preference';
import { Badge } from './common';

const RANK: Level[] = ['preferred', 'good', 'situational', 'unknown', 'pass'];

function Tile({ game, goal }: { game: Game; goal: GoalId }) {
  const pref = targetPreference(game, goal);
  return (
    <a className={`tile tile-${pref.level}`} href={`#/game/${game.id}`}>
      <span className="tile-name">{game.name}</span>
      {game.kind === 'base' ? (
        <>
          <span className="tile-line">{game.target.label} target</span>
          <span className="tile-rtp">{formatRtp(game.target.rtp)}</span>
          <span className="tile-line muted">{game.target.volatility}</span>
        </>
      ) : (
        <>
          <span className="tile-line">{game.tileHeadline}</span>
          <span className="tile-line muted">{game.tileNote}</span>
        </>
      )}
      <Badge pref={pref} />
    </a>
  );
}

export function Home({ goal, setGoal }: { goal: GoalId; setGoal: (g: GoalId) => void }) {
  const byPreference = (games: Game[]) =>
    [...games].sort((a, b) => RANK.indexOf(targetPreference(a, goal).level) - RANK.indexOf(targetPreference(b, goal).level));
  const stateGames = FEATURE_GAMES.filter((g) => g.state);
  const videoPoker = [...BASE_GAMES, ...FEATURE_GAMES.filter((g) => !g.state)];

  return (
    <div className="page">
      <header className="home-header">
        <h1>Casino Rule Book</h1>
        <label className="goal">
          <span>My goal</span>
          <select value={goal} onChange={(e) => setGoal(e.target.value as GoalId)}>
            {GOALS.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
          </select>
        </label>
      </header>
      <main>
        <h2 className="section-title">Video Poker</h2>
        <div className="tiles">{byPreference(videoPoker).map((g) => <Tile key={g.id} game={g} goal={goal} />)}</div>

        <h2 className="section-title">Persistent State</h2>
        <div className="tiles">{byPreference(stateGames).map((g) => <Tile key={g.id} game={g} goal={goal} />)}</div>
        <p className="muted small pad">
          Slot machines appear here only once their entry condition has a citation. None are in the rulebook yet.
        </p>

        <nav className="footer-nav">
          <a href="#/log">Observation log</a>
          <a href="#/sources">Sources</a>
        </nav>
        <p className="muted small pad">
          Badges grade the benchmark paytable for your goal. They are not a prediction and never a guarantee of
          profit; returns assume optimal strategy over the long run.
        </p>
      </main>
    </div>
  );
}
