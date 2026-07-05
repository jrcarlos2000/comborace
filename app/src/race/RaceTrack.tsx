import { useEffect, useRef, type CSSProperties, type RefObject } from 'react';
import { COMBOS, type ComboDef } from '../mock/combos';
import type { CarTick, MatchTick } from '../mock/mockFeed';
import type { ParticlesHandle } from './Particles';
import { clamp01, landingBounce } from '../anim/easing';
import { carSpriteFor } from './carSprites';

const SPRITE_W = 52;

// Per-car on-screen state. The feed only speaks once a second, so nothing here reads a
// target directly. renderPos chases the latest probability every frame and the car keeps a
// gentle idle bob, which is what stops the cars from teleporting between the coarse ticks.
interface RenderState {
  pos: number;
  lastPos: number;
  bob: number;
  seed: number;
  phase: 'racing' | 'crashing' | 'crashed' | 'cashing' | 'finished';
  phaseT: number;
  shakeT: number;
  cashT: number;
  opacity: number;
  has3d: boolean;
}

function spriteCenter(el: HTMLElement): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

// Four cars race one shared track. The finish (100% win chance) is the checkered right edge;
// the red crash zone is the left edge (0%). A bright central median splits the grid so two
// cars run above the line and two below it, which is what makes it read as a race and not a
// stack of dashboard rows.
export function RaceTrack({
  tick,
  particles,
  combos = COMBOS,
  pot = 0,
  youId,
  standings,
}: {
  tick: MatchTick | null;
  particles: RefObject<ParticlesHandle>;
  combos?: ComboDef[];
  pot?: number;
  youId?: string;
  standings?: Map<string, number>;
}) {
  const measureRef = useRef<HTMLDivElement>(null);
  const trackW = useRef(0);
  const spriteEls = useRef<Map<string, HTMLDivElement>>(new Map());
  const hullEls = useRef<Map<string, HTMLElement>>(new Map());
  const brakeEls = useRef<Map<string, HTMLElement>>(new Map());
  const heroEls = useRef<Map<string, HTMLElement>>(new Map());
  const crashEls = useRef<Map<string, HTMLElement>>(new Map());
  const rs = useRef<Map<string, RenderState>>(new Map());
  const carsRef = useRef<CarTick[]>([]);

  const top = combos.slice(0, 2);
  const bottom = combos.slice(2, 4);

  // Warm the crash sheets into the browser cache shortly after the race is up (they are the
  // heaviest sprite and only needed on an event) so the first crash swaps frames with no fetch
  // hitch, while the initial paint only pays for the light hero PNGs.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      for (const combo of combos) {
        const sprite = carSpriteFor(combo.colorRgb);
        if (sprite) new Image().src = sprite.crashSheet;
      }
    }, 900);
    return () => window.clearTimeout(timer);
  }, [combos]);

  useEffect(() => {
    const measure = () => {
      if (measureRef.current) trackW.current = measureRef.current.clientWidth;
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (measureRef.current) ro.observe(measureRef.current);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();

    const frame = (t: number) => {
      const dt = Math.min(0.05, Math.max(0, (t - last) / 1000));
      last = t;
      const width = trackW.current || 320;
      const travel = Math.max(40, width - SPRITE_W);

      for (const car of carsRef.current) {
        let s = rs.current.get(car.id);
        if (!s) {
          s = {
            pos: car.pct,
            lastPos: car.pct,
            bob: Math.random() * Math.PI * 2,
            seed: Math.random() * 10,
            phase: 'racing',
            phaseT: 0,
            shakeT: 0,
            cashT: 0,
            opacity: 1,
            has3d: carSpriteFor(car.colorRgb) !== null,
          };
          rs.current.set(car.id, s);
        }

        const target = car.status === 'crashed' ? 0 : car.status === 'cashed' ? 1 : car.pct;
        const settling = s.phase === 'crashing' || s.phase === 'cashing';
        const tau = settling ? 0.16 : 0.42;
        s.lastPos = s.pos;
        s.pos += (target - s.pos) * (1 - Math.exp(-dt / tau));
        s.bob += dt;
        s.phaseT += dt;

        const el = spriteEls.current.get(car.id);
        const hull = hullEls.current.get(car.id);
        const brake = brakeEls.current.get(car.id);
        if (!el) continue;

        if (s.phase === 'crashing') {
          if (s.has3d) {
            // Hold the sprite readable through its tumble sequence, then settle to a dim wreck
            // that keeps the last crash frame parked at the crash zone.
            s.opacity = s.phaseT < 0.95 ? 1 : Math.max(0.5, 1 - (s.phaseT - 0.95) / 0.5);
            if (s.phaseT > 1.45) {
              s.phase = 'crashed';
              s.opacity = 0.5;
            }
          } else {
            s.opacity = Math.max(0, 1 - Math.max(0, s.phaseT - 0.12) / 0.6);
            if (s.phaseT > 0.9) {
              s.phase = 'crashed';
              s.opacity = 0.14;
            }
          }
        }
        if (s.phase === 'cashing' && s.pos > 0.985) {
          const c = spriteCenter(el);
          particles.current?.confetti(c.x, c.y, car.colorRgb);
          particles.current?.pulse(c.x, c.y, car.colorRgb);
          s.phase = 'finished';
          s.cashT = 0;
        }

        // Idle bob plus, once a car has cashed, a short damped landing bounce so it lands at
        // the finish with weight (the squash math is the same one the sting scenes use).
        const idleAmp = s.phase === 'crashed' ? 0 : s.phase === 'finished' ? 1.2 : 2.6;
        let y = Math.sin(s.bob * 2.3 + s.seed) * idleAmp;
        let bounceSquash = 0;
        if (s.phase === 'finished') {
          s.cashT += dt;
          y -= landingBounce(s.cashT);
          bounceSquash = 0.32 * Math.exp(-4.5 * s.cashT) * Math.cos(11 * s.cashT);
        }
        let x = s.pos * travel;
        if (s.shakeT > 0) {
          s.shakeT -= dt;
          const amp = 8 * Math.max(0, s.shakeT / 0.4);
          x += (Math.random() * 2 - 1) * amp;
          y += (Math.random() * 2 - 1) * amp;
        }

        // Signed speed: climbing toward the finish stretches the hull into the run; losing
        // ground (a rival scored, the odds dropped) reads as a brake, not a UI glitch, so we
        // flash a skid streak on the leading edge instead of just sliding backwards.
        const vel = (s.pos - s.lastPos) / (dt || 0.016);
        const forward = clamp01(vel / 3);
        const braking = s.phase === 'racing' ? clamp01(-vel / 2.5) : 0;
        const sx = 1 + forward * 0.18 - braking * 0.1 - bounceSquash * 0.5;
        const sy = 1 - forward * 0.12 + braking * 0.06 + bounceSquash;

        el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
        el.style.opacity = s.opacity.toFixed(3);
        if (hull) hull.style.transform = `scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
        if (brake) brake.style.opacity = braking.toFixed(3);
      }
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [particles]);

  useEffect(() => {
    if (!tick) return;
    carsRef.current = tick.cars;
    for (const ev of tick.events) {
      if (ev.type === 'crash') {
        const s = rs.current.get(ev.carId);
        if (s) {
          s.phase = 'crashing';
          s.phaseT = 0;
          s.shakeT = 0.4;
        }
        const el = spriteEls.current.get(ev.carId);
        const car = tick.cars.find((c) => c.id === ev.carId);
        if (el && car) {
          const c = spriteCenter(el);
          particles.current?.explode(c.x, c.y, car.colorRgb);
          // Swap the rendered hero for its crash-tumble sheet. The sheet plays once via a CSS
          // steps() animation on the crash element; toggling the class imperatively keeps it
          // clear of React's className on the sprite, which never sees these two child nodes.
          const sprite = carSpriteFor(car.colorRgb);
          const hero = heroEls.current.get(ev.carId);
          const crash = crashEls.current.get(ev.carId);
          if (sprite && hero && crash) {
            hero.style.opacity = '0';
            crash.style.backgroundImage = `url(${sprite.crashSheet})`;
            crash.classList.add('is-tumbling');
          }
        }
      } else if (ev.type === 'cash') {
        const s = rs.current.get(ev.carId);
        if (s) {
          s.phase = 'cashing';
          s.phaseT = 0;
        }
      }
    }
  }, [tick, particles]);

  const carById = new Map((tick?.cars ?? []).map((c) => [c.id, c] as const));

  const register = (id: string) => (el: HTMLDivElement | null) => {
    if (el) {
      spriteEls.current.set(id, el);
      const hull = el.querySelector<HTMLElement>('.car-hull');
      if (hull) hullEls.current.set(id, hull);
      const brake = el.querySelector<HTMLElement>('.brake-streak');
      if (brake) brakeEls.current.set(id, brake);
      const hero = el.querySelector<HTMLElement>('.car-hero');
      if (hero) heroEls.current.set(id, hero);
      const crash = el.querySelector<HTMLElement>('.car-crash');
      if (crash) crashEls.current.set(id, crash);
    } else {
      spriteEls.current.delete(id);
      hullEls.current.delete(id);
      brakeEls.current.delete(id);
      heroEls.current.delete(id);
      crashEls.current.delete(id);
    }
  };

  return (
    <div className="flex flex-1 flex-col px-3 pb-3">
      <div className="race-arena flex flex-col">
        <span className="speed-lines" aria-hidden="true" />
        <span className="grid-line" style={{ left: '25%' }} aria-hidden="true" />
        <span className="grid-line" style={{ left: '50%' }} aria-hidden="true" />
        <span className="grid-line" style={{ left: '75%' }} aria-hidden="true" />
        <span className="crash-band" aria-hidden="true">
          <span className="crash-label">crash</span>
        </span>
        <span className="finish-band" aria-hidden="true" />
        <div className="finish-prize" aria-hidden="true">
          <span className="finish-flag">🏁 finish</span>
          <span className="finish-amount">${pot}</span>
          <span className="finish-sub">winner takes all</span>
        </div>

        {top.map((combo, i) => (
          <CarLane
            key={combo.id}
            combo={combo}
            car={carById.get(combo.id)}
            isYou={combo.id === youId}
            place={standings?.get(combo.id)}
            measureRef={i === 0 ? measureRef : undefined}
            registerSprite={register(combo.id)}
          />
        ))}

        <div className="median-band" aria-hidden="true">
          <span className="median-axis">chance to win →</span>
        </div>

        {bottom.map((combo) => (
          <CarLane
            key={combo.id}
            combo={combo}
            car={carById.get(combo.id)}
            isYou={combo.id === youId}
            place={standings?.get(combo.id)}
            registerSprite={register(combo.id)}
          />
        ))}
      </div>
    </div>
  );
}

function CarLane({
  combo,
  car,
  isYou,
  place,
  measureRef,
  registerSprite,
}: {
  combo: ComboDef;
  car: CarTick | undefined;
  isYou: boolean;
  place?: number;
  measureRef?: RefObject<HTMLDivElement>;
  registerSprite: (el: HTMLDivElement | null) => void;
}) {
  const status = car?.status ?? 'racing';
  const pct = car?.pct ?? 0;
  const sprite = carSpriteFor(combo.colorRgb);

  const spriteClass = [
    'car-sprite',
    sprite ? 'has-3d' : '',
    isYou ? 'is-you' : '',
    status === 'crashed' ? 'is-crashed' : '',
    status === 'cashed' ? 'is-finished' : '',
    status === 'racing' && pct < 0.14 ? 'is-redline' : '',
    status === 'racing' && pct > 0.86 ? 'is-surge' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const picks = car?.legs ?? combo.legs.map((l) => ({ ...l, pct: 0, status: 'pending' as const }));

  return (
    <div className={`lane-row${isYou ? ' is-you-lane' : ''}`}>
      <div className="lane-plate">
        <span className={`pos-badge${place === 1 && status !== 'crashed' ? ' pos-lead' : ''}`}>
          {status === 'crashed' ? 'X' : place ? `P${place}` : 'P-'}
        </span>
        <span className="car-chip h-2 w-2 shrink-0" style={{ background: combo.color }} />
        <span className="truncate text-[12px] font-bold" style={{ color: combo.color }}>
          {combo.handle}
        </span>
        {isYou && <span className="you-badge">YOU</span>}
        {status === 'crashed' && <span className="ml-auto font-mono text-[11px] font-black text-crash">CRASHED</span>}
        {status === 'cashed' && <span className="ml-auto font-mono text-[11px] font-black text-cash">WON</span>}
      </div>

      <div className="lane-picks">
        {picks.map((leg) => (
          <PickPill key={leg.id} short={leg.short} status={leg.status} />
        ))}
      </div>

      <div ref={measureRef} className="lane-strip">
        <div
          ref={registerSprite}
          className={spriteClass}
          style={{ '--c': combo.color, '--crgb': combo.colorRgb } as CSSProperties}
        >
          <span className="car-hull">
            {sprite ? (
              <>
                <img className="car-hero" src={sprite.hero} alt="" draggable={false} />
                <span className="car-crash" aria-hidden="true" />
              </>
            ) : (
              <span className="car-body" />
            )}
          </span>
          <span className="brake-streak" aria-hidden="true" />
          <span className="car-pct">
            {status === 'crashed' ? '0%' : status === 'cashed' ? '100%' : `${Math.round(pct * 100)}%`}
          </span>
        </div>
      </div>
    </div>
  );
}

function PickPill({ short, status }: { short: string; status: 'pending' | 'won' | 'lost' }) {
  const tone =
    status === 'won'
      ? 'bg-cash/15 text-cash ring-cash/30'
      : status === 'lost'
        ? 'bg-crash/15 text-crash ring-crash/30 line-through'
        : 'bg-white/[0.05] text-white/60 ring-white/10';
  const mark = status === 'won' ? '✓' : status === 'lost' ? '✕' : '';
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[9.5px] font-semibold ring-1 ${tone}`}>
      {mark && <span className="text-[9px]">{mark}</span>}
      <span>{short}</span>
    </span>
  );
}
