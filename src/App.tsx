import { useEffect, useState } from 'react';
import { findGame } from './data';
import type { GoalId } from './data/types';
import { loadGoal, saveGoal } from './storage/store';
import { Home } from './components/Home';
import { BaseGameDetail } from './components/BaseGameDetail';
import { FeatureDetail } from './components/FeatureDetail';
import { Trainer } from './components/Trainer';
import { ObservationLog } from './components/ObservationLog';
import { SourcesPage } from './components/Sources';

const currentRoute = () => window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);

export function App() {
  const [route, setRoute] = useState(currentRoute);
  const [goal, setGoalState] = useState<GoalId>(loadGoal);

  useEffect(() => {
    const onHash = () => { setRoute(currentRoute()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const setGoal = (next: GoalId) => { setGoalState(next); saveGoal(next); };
  const [page, id] = route;
  const game = id ? findGame(id) : undefined;

  if (page === 'game' && game) {
    return game.kind === 'base'
      ? <BaseGameDetail key={game.id} game={game} goal={goal} />
      : <FeatureDetail key={game.id} game={game} goal={goal} />;
  }
  if (page === 'train' && game?.kind === 'base') return <Trainer key={game.id} game={game} />;
  if (page === 'log') return <ObservationLog />;
  if (page === 'sources') return <SourcesPage />;
  return <Home goal={goal} setGoal={setGoal} />;
}
