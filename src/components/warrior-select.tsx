import { ChevronLeft, Flame, Heart, Shield, Sparkles, Swords, Wind, Waves, Zap } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { FINAL_LEVEL } from "@/game/levels";
import { PLAYABLE, getChar } from "@/game/roster";
import { useGame } from "@/game/store";
import type { CharacterDef } from "@/game/types";
import { cn } from "@/lib/utils";

/**
 * Warrior select: only the four protagonists can be chosen to enter the
 * arena. Framed skill slots on the left, stat slots on the right, the chosen
 * warrior in the middle of a misty forest, and a detail panel below.
 * Tall screens stack the panel and button; wide screens put them side by side.
 */

const SKILL_ICONS = [Wind, Waves, Shield, Flame];

function useLayout() {
  const [layout, setLayout] = useState<{ wide: boolean; short: boolean }>({ wide: true, short: false });
  useEffect(() => {
    const wideQ = window.matchMedia("(min-aspect-ratio: 11/10)");
    const shortQ = window.matchMedia("(max-height: 560px)");
    const update = () => setLayout({ wide: wideQ.matches, short: shortQ.matches });
    update();
    wideQ.addEventListener("change", update);
    shortQ.addEventListener("change", update);
    return () => {
      wideQ.removeEventListener("change", update);
      shortQ.removeEventListener("change", update);
    };
  }, []);
  return layout;
}

export function WarriorSelect({ onBack, onEnter }: { onBack: () => void; onEnter: () => void }) {
  const fighterId = useGame((s) => s.fighterId);
  const wins = useGame((s) => s.wins);
  const losses = useGame((s) => s.losses);
  const maxLevel = useGame((s) => s.maxLevel);
  const def = getChar(fighterId);
  const hero = def.playable ? def : PLAYABLE[0];
  const [skill, setSkill] = useState<number | null>(null);
  const { wide, short } = useLayout();
  // short landscape screens (phones on their side): slots in a 2×2 grid
  const grid2 = wide && short;
  const column = grid2 ? "grid grid-cols-2 content-start gap-x-2 gap-y-1" : "flex flex-col items-center gap-[calc(var(--slot)*0.16)]";

  // the arena only admits the four protagonists
  useEffect(() => {
    if (!def.playable) useGame.getState().setFighter(PLAYABLE[0].id);
  }, [def.playable]);
  useEffect(() => setSkill(null), [fighterId]);

  const skills = hero.skills ?? [];
  const chosen = skill !== null ? skills[skill] : null;
  // In matches each warrior currently has one Art (their power) plus Fold;
  // the other listed skills are the design target, shown as "Soon".
  const inBattle = (name: string) => name === hero.power.name;

  const stats = [
    { label: "Health", v: hero.hp, max: 140, icon: Heart },
    { label: "Attack", v: hero.atk, max: 22, icon: Swords },
    { label: "Defense", v: hero.def, max: 14, icon: Shield },
    { label: "Speed", v: Math.round(hero.spd * 100), max: 130, icon: Zap },
  ];

  const left = (
    <div className={cn(column, !wide && "pt-1")}>
      {skills.map((sk, i) => {
        const Icon = sk.ultimate ? Sparkles : SKILL_ICONS[i % SKILL_ICONS.length];
        return (
          <Slot
            key={sk.name}
            label={sk.ultimate ? "Ultimate" : `Skill ${i + 1}`}
            active={skill === i}
            onClick={() => setSkill(skill === i ? null : i)}
            testId={`skill-${i}`}
            glow={inBattle(sk.name)}
            badge={inBattle(sk.name) ? "Art" : "Soon"}
            dim={!inBattle(sk.name)}
          >
            <Icon className="size-[46%]" strokeWidth={1.6} />
          </Slot>
        );
      })}
    </div>
  );

  const right = (
    <div className={cn(column, !wide && "pt-1")}>
      {stats.map((st) => (
        <Slot key={st.label} label={st.label}>
          <div className="flex size-full flex-col items-center justify-center gap-1">
            <st.icon className="size-[30%] text-[#e8a25a]" strokeWidth={1.6} />
            <span className="font-display text-[calc(var(--slot)*0.26)] leading-none text-paper tabular-nums">{st.v}</span>
            <span className="h-[3px] w-[64%] overflow-hidden rounded-full bg-paper/10">
              <span className="block h-full bg-gradient-to-r from-[#b4232a] to-[#e8a25a]" style={{ width: `${Math.min(100, (st.v / st.max) * 100)}%` }} />
            </span>
          </div>
        </Slot>
      ))}
    </div>
  );

  const center = (
    <div className="relative flex min-h-0 flex-1 items-end justify-center">
      {/* rocky pedestal and ember light */}
      <div className="absolute bottom-[2%] left-1/2 h-[9%] w-[62%] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(ellipse_at_center,rgba(232,162,90,0.35),rgba(20,24,30,0.9)_55%,transparent_72%)]" />
      <Embers />
      <img
        key={hero.id}
        src={hero.portrait}
        alt={`${hero.name}, ${hero.title}`}
        className="relative z-[1] h-[96%] max-h-full w-auto max-w-full animate-[warrior-in_var(--dur-slow)_var(--ease-enter)] object-contain drop-shadow-[0_18px_30px_rgba(0,0,0,0.65)]"
        data-testid="warrior-art"
      />
    </div>
  );

  const panel = (
    <div className="flex min-h-0 items-start gap-3 rounded-sm border border-[#7fb2d6]/20 bg-[#07090d]/80 px-3 py-2.5 backdrop-blur-sm sm:px-4" data-testid="warrior-panel">
      <div className="grid size-[3.2rem] shrink-0 place-items-center overflow-hidden rounded-full border border-[#7fb2d6]/40 bg-[#0d1218] sm:size-[3.8rem]">
        {chosen ? (
          (() => {
            const Icon = chosen.ultimate ? Sparkles : SKILL_ICONS[(skill ?? 0) % SKILL_ICONS.length];
            return <Icon className="size-1/2 text-[#e8a25a]" strokeWidth={1.6} />;
          })()
        ) : (
          <img src={hero.portrait} alt="" className="size-full origin-top scale-[2.2] object-cover object-top" />
        )}
      </div>
      <div className="min-w-0">
        <p className="font-body text-[0.95rem] font-semibold tracking-[0.06em] text-[#e8a25a] uppercase sm:text-lg">
          {chosen ? chosen.name : `${hero.name} — ${hero.title}`}
        </p>
        <p className="mt-0.5 line-clamp-3 text-[0.8rem] leading-snug text-paper-dim sm:text-sm">
          {chosen ? chosen.desc : hero.blurb}
        </p>
        {chosen ? (
          <p className={cn("mt-1 font-body text-[0.6rem] tracking-[0.2em] uppercase", inBattle(chosen.name) ? "text-[#e8a25a]" : "text-mist")} data-testid="skill-status">
            {inBattle(chosen.name) ? "In battle now · Art button (Q)" : "Coming in a later update"}
          </p>
        ) : (
          <p className="mt-1 font-body text-[0.6rem] tracking-[0.2em] text-mist uppercase">
            {hero.weapon} · In battle: Slash, Parry, Leap, {hero.power.name}, Fold
          </p>
        )}
      </div>
    </div>
  );

  const enter = (
    <button
      type="button"
      onClick={onEnter}
      data-testid="enter-arena"
      className="group relative mx-auto flex h-12 w-full max-w-[22rem] items-center justify-center sm:h-14"
    >
      <span
        className="absolute inset-0 bg-gradient-to-b from-[#1b2633] to-[#0c121a] shadow-[0_0_24px_rgba(127,178,214,0.25)] transition-[filter] duration-(--dur-fast) ease-(--ease-enter) group-hover:brightness-125 group-active:brightness-90"
        style={{ clipPath: "polygon(6% 0, 94% 0, 100% 50%, 94% 100%, 6% 100%, 0 50%)" }}
      />
      <span
        className="absolute inset-[2px] border-0"
        style={{ clipPath: "polygon(6% 0, 94% 0, 100% 50%, 94% 100%, 6% 100%, 0 50%)", boxShadow: "inset 0 0 0 1px rgba(127,178,214,0.5)" }}
      />
      <span className="absolute left-[7%] text-[0.7rem] text-[#cfe3f2]">▲</span>
      <span className="absolute right-[7%] text-[0.7rem] text-[#cfe3f2]">▲</span>
      <span className="relative px-[14%] font-display text-[1.05rem] tracking-[0.14em] whitespace-nowrap text-[#e9f3fa] sm:text-[1.2rem]">Enter the Arena</span>
    </button>
  );

  const tabs = (
    <div className="flex items-center justify-center gap-[clamp(0.5rem,2.5vw,1.25rem)]" role="tablist" aria-label="Protagonists">
      {PLAYABLE.map((c) => (
        <PortraitTab key={c.id} c={c} active={c.id === hero.id} />
      ))}
    </div>
  );

  const progress = (
    <div className="flex items-center justify-end gap-4 border-t border-paper/10 bg-[#05070a]/90 px-4 py-1.5 font-body text-[0.68rem] tracking-[0.16em] text-paper-dim uppercase">
      <span>
        Battle <span className="text-paper tabular-nums">{Math.min(maxLevel, FINAL_LEVEL)}</span>/{FINAL_LEVEL}
      </span>
      <span>
        Wins <span className="text-paper tabular-nums">{wins}</span>
      </span>
      <span>
        Losses <span className="text-paper tabular-nums">{losses}</span>
      </span>
    </div>
  );

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-30 flex flex-col overflow-hidden text-paper"
      data-testid="warrior-select"
      style={
        {
          "--slot": grid2
            ? "clamp(2.5rem, calc((100dvh - 11.5rem) / 2.7), 4.6rem)"
            : wide
              ? "clamp(2.9rem, min(calc((100dvh - 13rem) / 5), 11vw), 5.4rem)"
              : "clamp(3.4rem, min(19vw, calc((100dvh - 26rem) / 4.4)), 5.6rem)",
        } as React.CSSProperties
      }
    >
      <ForestBackdrop />
      <style>{`@keyframes warrior-in{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:none}}@keyframes ember-rise{from{transform:translateY(0);opacity:0}15%{opacity:1}to{transform:translateY(-60vh);opacity:0}}`}</style>

      <header className="relative z-10 flex items-center gap-3 px-[max(0.75rem,env(safe-area-inset-left))] pt-[max(0.6rem,env(safe-area-inset-top))]">
        <button type="button" onClick={onBack} aria-label="Back" className="grid size-11 shrink-0 place-items-center rounded-full border border-[#cfe3f2]/50 bg-[#0b1118]/70 text-[#e9f3fa] shadow-[0_0_14px_rgba(127,178,214,0.3)] hover:bg-[#0b1118]">
          <ChevronLeft className="size-6" />
        </button>
        <h2 className={cn("font-display tracking-[0.2em] whitespace-nowrap text-[#e9f3fa] uppercase", wide ? "text-[1.15rem] sm:text-[1.45rem]" : "flex-1 pr-11 text-center text-[1.15rem]")}>Choose your warrior</h2>
        {wide && <div className="ml-auto pr-[max(0.75rem,env(safe-area-inset-right))]">{tabs}</div>}
      </header>

      {!wide && <div className="relative z-10 mt-2">{tabs}</div>}

      <div className="relative z-10 flex min-h-0 flex-1 gap-2 px-[max(0.75rem,env(safe-area-inset-left))] pt-2 sm:gap-4">
        {left}
        {center}
        {right}
      </div>

      {wide ? (
        <div className="relative z-10 flex items-center gap-3 px-[max(0.75rem,env(safe-area-inset-left))] pb-2 pt-1 sm:gap-5">
          <div className="min-w-0 flex-1">{panel}</div>
          <div className="w-[min(40%,22rem)] shrink-0">{enter}</div>
        </div>
      ) : (
        <div className="relative z-10 flex flex-col gap-2 px-3 pb-2 pt-1">
          {enter}
          {panel}
        </div>
      )}
      <div className="relative z-10 pb-[env(safe-area-inset-bottom)]">{progress}</div>
    </div>
  );
}

function Slot({
  children,
  label,
  active,
  onClick,
  glow,
  testId,
  badge,
  dim,
}: {
  children: ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
  glow?: boolean;
  testId?: string;
  badge?: string;
  dim?: boolean;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <div className="flex flex-col items-center">
      <Tag
        {...(onClick ? { type: "button" as const, onClick, "aria-pressed": !!active } : {})}
        data-testid={testId}
        className={cn(
          "relative grid place-items-center rounded-[6px] border bg-[linear-gradient(160deg,#151c25,#090c11)] text-[#e9f3fa] shadow-[inset_0_0_14px_rgba(0,0,0,0.7)] transition-colors duration-(--dur-fast) ease-(--ease-enter)",
          active ? "border-[#e8a25a] shadow-[0_0_14px_rgba(232,162,90,0.45),inset_0_0_14px_rgba(0,0,0,0.7)]" : "border-[#7fb2d6]/30",
          onClick && "hover:border-[#cfe3f2]/70",
          glow && !active && "border-[#e8a25a]/50",
        )}
        style={{ width: "var(--slot)", height: "var(--slot)" }}
      >
        <span className={cn("grid size-full place-items-center", dim && !active && "opacity-45")}>{children}</span>
        {badge && (
          <span
            className={cn(
              "absolute -top-1.5 -right-1.5 rounded-full px-1.5 py-px font-body text-[0.5rem] font-semibold tracking-[0.12em] uppercase shadow",
              badge === "Art" ? "bg-[#e8a25a] text-[#1a0f06]" : "bg-[#1b2633] text-[#9fb4c6] ring-1 ring-[#7fb2d6]/30",
            )}
          >
            {badge}
          </span>
        )}
      </Tag>
      <span className="mt-0.5 font-display text-[calc(var(--slot)*0.22)] leading-tight text-[#cfd9e2] [text-shadow:0_1px_3px_#000]">{label}</span>
    </div>
  );
}

function PortraitTab({ c, active }: { c: CharacterDef; active: boolean }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-label={`${c.name}, ${c.title}`}
      data-testid={`tab-${c.id}`}
      onClick={() => useGame.getState().setFighter(c.id)}
      className={cn(
        "relative grid size-[clamp(2.6rem,min(12vw,11dvh),4.2rem)] place-items-center overflow-hidden rounded-full border-2 bg-[#0b1118] transition-transform duration-(--dur-fast) ease-(--ease-enter)",
        active ? "scale-110 border-[#e9f3fa] shadow-[0_0_18px_rgba(207,227,242,0.55)]" : "border-[#7fb2d6]/40 opacity-80 hover:opacity-100",
      )}
    >
      <img src={c.portrait} alt="" className="absolute top-0 left-1/2 h-[300%] w-auto max-w-none -translate-x-1/2 object-cover" />
    </button>
  );
}

function ForestBackdrop() {
  return (
    <div className="absolute inset-0" aria-hidden>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,#2c4a5e_0%,#16263a_38%,#0a121c_72%,#05080c_100%)]" />
      <svg className="absolute inset-0 size-full" viewBox="0 0 400 700" preserveAspectRatio="xMidYMax slice">
        <defs>
          <linearGradient id="mist" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7fb2d6" stopOpacity="0" />
            <stop offset="100%" stopColor="#7fb2d6" stopOpacity="0.18" />
          </linearGradient>
        </defs>
        {/* far trunks */}
        {[20, 70, 120, 170, 230, 280, 330, 380].map((x, i) => (
          <rect key={`f${x}`} x={x} y={0} width={10 + (i % 3) * 4} height={700} fill="#1a2c3c" opacity={0.55} />
        ))}
        <rect x="0" y="380" width="400" height="320" fill="url(#mist)" />
        {/* near trunks */}
        {[-10, 48, 345, 392].map((x, i) => (
          <path key={`n${x}`} d={`M${x} 0 L${x + 26 + i * 4} 0 L${x + 34 + i * 4} 700 L${x - 8} 700 Z`} fill="#0b141d" />
        ))}
        {/* rocky ground */}
        <path d="M0 610 Q 80 585 160 600 T 300 596 T 400 604 L400 700 L0 700 Z" fill="#0d1820" />
        <path d="M0 640 Q 120 625 220 640 T 400 636 L400 700 L0 700 Z" fill="#081017" />
        {/* violet undergrowth glow, as in the forest the Twins haunt */}
        <circle cx="360" cy="620" r="40" fill="#6a3cc0" opacity="0.18" />
        <circle cx="40" cy="630" r="30" fill="#e8a25a" opacity="0.12" />
      </svg>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(0,0,0,0.55)_100%)]" />
    </div>
  );
}

function Embers() {
  const dots = Array.from({ length: 14 }, (_, i) => i);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden motion-reduce:hidden" aria-hidden>
      {dots.map((i) => (
        <span
          key={i}
          className="absolute bottom-[6%] size-[3px] rounded-full bg-[#ffb870] shadow-[0_0_6px_#ff8a3a]"
          style={{
            left: `${15 + ((i * 37) % 70)}%`,
            animation: `ember-rise ${4 + (i % 5)}s linear ${(i * 0.7) % 5}s infinite`,
          }}
        />
      ))}
    </div>
  );
}
