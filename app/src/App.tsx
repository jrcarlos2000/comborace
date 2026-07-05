import { useState } from 'react';
import { COMBOS } from './mock/combos';
import { fakeAddress, type Racer } from './game/session';
import type { FeedSource } from './feed/matchFeed';
import { Landing } from './landing/Landing';
import { Lobby } from './lobby/Lobby';
import { RaceScreen } from './race/RaceScreen';

type View = 'landing' | 'lobby' | 'race';

// The wallet-free "Watch a race" field: the four house cars, with the Over 2.5 car cast as
// you so the demo lands the "you received" beat when it cashes.
function buildWatchField(): Racer[] {
  return COMBOS.map((combo) => ({
    address: fakeAddress(),
    combo,
    isYou: combo.id === 'messi',
    copiedFrom: null,
  }));
}

export default function App() {
  const [view, setView] = useState<View>('landing');
  const [field, setField] = useState<Racer[] | null>(null);
  const [source, setSource] = useState<FeedSource>('server');
  const [runId, setRunId] = useState(0);

  // 'server' streams the recorded house race over the server WebSocket (mock fallback if it is
  // down); the drafted lobby field races locally since the recorded stream only knows the house
  // cars.
  const startRace = (next: Racer[], feedSource: FeedSource) => {
    setField(next);
    setSource(feedSource);
    setRunId((n) => n + 1);
    setView('race');
  };

  if (view === 'race' && field) {
    return (
      <RaceScreen
        key={runId}
        field={field}
        feedSource={source}
        onExit={() => setView('landing')}
        onReplay={() => setRunId((n) => n + 1)}
      />
    );
  }

  if (view === 'lobby') {
    return <Lobby onStart={(next) => startRace(next, 'local')} onBack={() => setView('landing')} />;
  }

  return (
    <Landing onWatch={() => startRace(buildWatchField(), 'server')} onLobby={() => setView('lobby')} />
  );
}
