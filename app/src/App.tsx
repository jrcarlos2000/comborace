import { useState } from 'react';
import { COMBOS } from './mock/combos';
import { fakeAddress, type Racer } from './game/session';
import type { FeedSource } from './feed/matchFeed';
import { unlockRaceAudio } from './audio/raceAudio';
import { Landing } from './landing/Landing';
import { Lobby } from './lobby/Lobby';
import { Flywheel } from './monetization/Flywheel';
import { RaceScreen } from './race/RaceScreen';

type View = 'landing' | 'lobby' | 'race' | 'flywheel';

// The static public bundle has no server behind it, so "Watch a race" plays a client-side replay
// there; the Docker / live build compiles the flag on and streams the WebSocket feed instead.
const WATCH_SOURCE: FeedSource = __COMBORACE_LIVE_FEED__ ? 'server' : 'replay';

// The wallet-free "Watch a race" field: the four house cars, with the over-goals car cast as you
// so the demo lands the "you received" beat when it cashes.
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
  const [source, setSource] = useState<FeedSource>(WATCH_SOURCE);
  const [runId, setRunId] = useState(0);

  const startRace = (next: Racer[], feedSource: FeedSource) => {
    // Unlock audio inside the tap gesture so the engine hum can start (autoplay policy).
    unlockRaceAudio();
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

  if (view === 'flywheel') {
    return <Flywheel onBack={() => setView('landing')} />;
  }

  return (
    <Landing
      onWatch={() => startRace(buildWatchField(), WATCH_SOURCE)}
      onLobby={() => setView('lobby')}
      onFlywheel={() => setView('flywheel')}
    />
  );
}
