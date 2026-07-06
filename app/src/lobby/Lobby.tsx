import { useMemo, useState } from 'react';
import { difficultyLabel, type ComboDef } from '../mock/combos';
import { BUY_IN, fakeAddress, type Racer } from '../game/session';
import { DRAFT_POOL, FRIEND_IDS, FRIEND_NAMES } from './draftPool';

const JOIN_CODE = 'LOS3';

type Pick = { kind: 'draft'; combo: ComboDef } | { kind: 'copy'; friend: Racer };

export function Lobby({ onStart, onBack }: { onStart: (field: Racer[]) => void; onBack: () => void }) {
  const [stage, setStage] = useState<'gate' | 'draft'>('gate');
  const [hostCode, setHostCode] = useState<string | null>(null);

  const friends = useMemo<Racer[]>(
    () =>
      FRIEND_IDS.map((id) => {
        const combo = DRAFT_POOL.find((c) => c.id === id);
        if (!combo) throw new Error(`draft pool missing ${id}`);
        return { address: fakeAddress(), combo, isYou: false, copiedFrom: null };
      }),
    [],
  );

  const remaining = useMemo(
    () => DRAFT_POOL.filter((c) => !FRIEND_IDS.some((id) => id === c.id)),
    [],
  );

  if (stage === 'gate') {
    return (
      <InviteGate
        onBack={onBack}
        onEnter={(code) => {
          setHostCode(code);
          setStage('draft');
        }}
      />
    );
  }

  return (
    <DraftBoard
      friends={friends}
      remaining={remaining}
      code={hostCode ?? JOIN_CODE}
      onBack={onBack}
      onLockIn={(pick) => {
        const you: Racer =
          pick.kind === 'draft'
            ? { address: fakeAddress(), combo: pick.combo, isYou: true, copiedFrom: null }
            : {
                address: fakeAddress(),
                combo: cloneForCopy(pick.friend.combo),
                isYou: true,
                copiedFrom: pick.friend.combo.handle,
              };
        onStart([you, ...friends]);
      }}
    />
  );
}

function cloneForCopy(base: ComboDef): ComboDef {
  return {
    ...base,
    id: `${base.id}-you`,
    handle: `${base.handle} II`,
    legs: base.legs.map((l) => ({ ...l })),
  };
}

function InviteGate({ onBack, onEnter }: { onBack: () => void; onEnter: (code: string) => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);

  const submit = () => {
    if (code.trim().toUpperCase() === JOIN_CODE) onEnter(JOIN_CODE);
    else setError(true);
  };

  const host = () => {
    const generated = Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
    onEnter(generated);
  };

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col px-6 pb-10 pt-14">
      <BackBar onBack={onBack} label="Private lobby" />
      <div className="flex flex-1 flex-col justify-center">
        <div className="rounded-3xl border border-grey-200 bg-track-panel p-6 shadow-card-drop">
          <h2 className="text-xl font-black tracking-tight text-grey-950">Join with an invite</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-grey-500">
            Combo Race lobbies are invite-only. Ask your group for the code.
          </p>
          <input
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setError(false);
            }}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="enter code"
            autoCapitalize="characters"
            aria-label="Lobby invite code"
            className={`mt-5 w-full rounded-xl border bg-grey-50 px-4 py-3.5 text-center text-lg font-black uppercase tracking-[0.3em] text-grey-950 outline-none transition duration-150 placeholder:text-grey-300 placeholder:tracking-normal focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-track-base ${
              error ? 'border-crash shake' : 'border-grey-200 focus:border-brand'
            }`}
          />
          {error && <p className="mt-2 text-center text-xs font-semibold text-crash">Wrong code. Try {JOIN_CODE}.</p>}
          {!error && <p className="mt-2 text-center text-[11px] text-grey-400">demo code: {JOIN_CODE}</p>}
          <button onClick={submit} className="btn-primary mt-4 w-full py-3.5 text-sm">
            Join lobby
          </button>
        </div>
        <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-widest text-grey-300">
          <span className="h-px flex-1 bg-grey-200" />
          or
          <span className="h-px flex-1 bg-grey-200" />
        </div>
        <button onClick={host} className="btn-secondary w-full py-3.5 text-sm">
          Host a new lobby
        </button>
      </div>
    </div>
  );
}

function DraftBoard({
  friends,
  remaining,
  code,
  onBack,
  onLockIn,
}: {
  friends: Racer[];
  remaining: ComboDef[];
  code: string;
  onBack: () => void;
  onLockIn: (pick: Pick) => void;
}) {
  const [pick, setPick] = useState<Pick | null>(null);
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    void navigator.clipboard?.writeText(code).catch(() => undefined);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  const isPicked = (id: string) => pick?.kind === 'draft' && pick.combo.id === id;
  const isCopied = (addr: string) => pick?.kind === 'copy' && pick.friend.address === addr;

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col px-4 pb-28 pt-14">
      <BackBar onBack={onBack} label="Pick your car" />

      <button
        onClick={copyCode}
        className="focus-ring surface-card card-interactive mb-5 flex items-center justify-between px-4 py-3 text-left"
      >
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-grey-400">lobby code</div>
          <div className="mt-0.5 font-mono text-lg font-black tracking-[0.3em] text-grey-950">{code}</div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-lg bg-brand/10 px-2.5 py-1.5 text-xs font-bold text-brand ring-1 ring-brand/25">
          {copied ? 'copied' : 'share'}
        </span>
      </button>

      <SectionLabel>Locked in ({friends.length})</SectionLabel>
      <div className="space-y-2">
        {friends.map((f) => (
          <FriendRow
            key={f.address}
            racer={f}
            copied={isCopied(f.address)}
            onCopy={() => setPick({ kind: 'copy', friend: f })}
          />
        ))}
      </div>

      <SectionLabel>Pick your car (your turn)</SectionLabel>
      {remaining.length === 0 ? (
        <div className="surface-card px-4 py-8 text-center">
          <div className="text-sm font-bold text-grey-700">Every car is taken</div>
          <div className="mt-1 text-xs text-grey-400">Copy a friend&apos;s car above to join the grid.</div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {remaining.map((combo) => (
            <CandidateCard
              key={combo.id}
              combo={combo}
              selected={isPicked(combo.id)}
              onSelect={() => setPick({ kind: 'draft', combo })}
            />
          ))}
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-grey-200 bg-track-bg/90 px-4 pb-6 pt-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-grey-400">your car</div>
            <div className="truncate text-sm font-bold text-grey-950">
              {pick
                ? pick.kind === 'draft'
                  ? pick.combo.handle
                  : `copy of ${pick.friend.combo.handle}`
                : 'pick one above'}
            </div>
          </div>
          <button
            disabled={!pick}
            onClick={() => pick && onLockIn(pick)}
            className="btn-primary shrink-0 px-5 py-3 text-sm"
          >
            Chip in ${BUY_IN} &amp; race
          </button>
        </div>
      </div>
    </div>
  );
}

function FriendRow({ racer, copied, onCopy }: { racer: Racer; copied: boolean; onCopy: () => void }) {
  const c = racer.combo;
  const friendName = FRIEND_NAMES[c.id] ?? c.handle;
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-grey-200 bg-track-panel px-3 py-2.5 shadow-card-drop">
      <span className="car-chip h-2.5 w-2.5 shrink-0" style={{ background: c.color }} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-bold" style={{ color: c.color }}>
            {c.handle}
          </span>
          <span className="rounded-md bg-grey-100 px-1.5 py-px text-[10px] font-semibold text-grey-500">{friendName}</span>
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {c.legs.map((l) => (
            <span key={l.id} className="rounded-md bg-grey-100 px-1.5 py-0.5 text-[10px] font-medium text-grey-600">
              {l.short}
            </span>
          ))}
        </div>
      </div>
      <button
        onClick={onCopy}
        className={`focus-ring shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition duration-150 active:scale-95 ${
          copied ? 'bg-brand text-white shadow-primary' : 'bg-grey-100 text-grey-700 hover:bg-grey-200 hover:text-grey-900'
        }`}
      >
        {copied ? 'copied' : 'copy car'}
      </button>
    </div>
  );
}

function CandidateCard({ combo, selected, onSelect }: { combo: ComboDef; selected: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      aria-pressed={selected}
      className={`focus-ring rounded-2xl border p-3 text-left shadow-card-drop transition duration-150 active:scale-[0.98] ${
        selected
          ? 'border-brand bg-brand/[0.06] shadow-car-select'
          : 'border-grey-200 bg-track-panel hover:border-grey-300 hover:bg-grey-50'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="car-chip h-2 w-2 shrink-0" style={{ background: combo.color }} />
        <span className="truncate text-sm font-bold" style={{ color: combo.color }}>
          {combo.handle}
        </span>
      </div>
      <div className="mt-1 text-[11px] text-grey-400">{combo.tagline}</div>
      <div className="mt-2.5 flex flex-wrap gap-1">
        {combo.legs.map((l) => (
          <span key={l.id} className="rounded-md bg-grey-100 px-1.5 py-0.5 text-[10px] font-medium text-grey-600">
            {l.short}
          </span>
        ))}
      </div>
      <div className="mt-2.5">
        <DifficultyPill multiplier={combo.multiplier} />
      </div>
    </button>
  );
}

function DifficultyPill({ multiplier }: { multiplier: number }) {
  const { text, tone } = difficultyLabel(multiplier);
  const cls =
    tone === 'safe'
      ? 'bg-cash/15 text-cash ring-cash/30'
      : tone === 'even'
        ? 'bg-grey-100 text-grey-600 ring-grey-200'
        : tone === 'risky'
          ? 'bg-yellow-400/15 text-yellow-600 ring-yellow-400/40'
          : 'bg-crash/15 text-crash ring-crash/30';
  return <span className={`pill ${cls}`}>{text}</span>;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-2.5 mt-6 text-[11px] font-bold uppercase tracking-[0.25em] text-grey-400">{children}</div>;
}

function BackBar({ onBack, label }: { onBack: () => void; label: string }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <button
        onClick={onBack}
        className="focus-ring flex h-8 w-8 items-center justify-center rounded-full border border-grey-200 bg-white text-grey-600 shadow-button transition duration-150 hover:border-grey-300 hover:text-grey-900 active:scale-95"
        aria-label="Back"
      >
        &#8592;
      </button>
      <span className="text-sm font-bold text-grey-800">{label}</span>
    </div>
  );
}
