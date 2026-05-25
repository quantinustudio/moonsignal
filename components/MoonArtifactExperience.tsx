"use client";

import {
  Cigarette,
  Dumbbell,
  Frown,
  Meh,
  Moon,
  Mars,
  Smile,
  Venus,
  VenusAndMars,
  Volume2,
  VolumeX,
  Circle,
  Share2,
  Link2,
  Check,
  Wine,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  MAX_BIRTH_YEAR,
  MIN_BIRTH_YEAR,
  buildAffirmationPool,
  resolvedProjectedEndMs,
  remainingParts,
  YEAR_MS,
  type Level,
  type LifeProfile,
  type LifetimeParts,
  type Sex,
} from "@/lib/lifetime";

const AFFIRMATION_ONLY_UNDER_YEARS = 10;
const AFFIRMATION_DISPLAY_MS = 60_000;
type TimerDebugConfig = {
  timerX: number;
  timerY: number;
  timerWidth: number;
  timerHeight: number;
  rotate: number;
  scale: number;
};

const TIMER_DEBUG_STORAGE_KEY = "quantinu-timer-debug-v1";

const IDLE_CELLS: LedCells = ["00", "00", "00", "00", "00"];

const TIMER_ROWS = [
  { label: "YRS", index: 0 },
  { label: "DAYS", index: 1 },
  { label: "HRS", index: 2 },
  { label: "MINS", index: 3 },
  { label: "SECS", index: 4 },
] as const;

type DisplayColorId =
  | "red"
  | "orange"
  | "purple"
  | "green"
  | "cyan"
  | "blue"
  | "yellow"
  | "white";

type DisplayColorPreset = {
  id: DisplayColorId;
  label: string;
  main: string;
  unit: string;
  glow: string;
  glowSoft: string;
};

const DISPLAY_COLOR_STORAGE_KEY = "quantinu-display-color-v1";

const DISPLAY_COLORS: DisplayColorPreset[] = [
  {
    id: "red",
    label: "红",
    main: "#ff2d2d",
    unit: "#ff9090",
    glow: "rgba(255, 45, 45, 0.85)",
    glowSoft: "rgba(255, 45, 45, 0.45)",
  },
  {
    id: "orange",
    label: "橙",
    main: "#ff6b1a",
    unit: "rgba(255, 160, 90, 0.95)",
    glow: "rgba(255, 120, 40, 0.55)",
    glowSoft: "rgba(255, 120, 40, 0.35)",
  },
  {
    id: "purple",
    label: "紫",
    main: "#c084ff",
    unit: "#d8b4fe",
    glow: "rgba(168, 85, 247, 0.85)",
    glowSoft: "rgba(147, 51, 234, 0.45)",
  },
  {
    id: "green",
    label: "绿",
    main: "#4ade80",
    unit: "#86efac",
    glow: "rgba(74, 222, 128, 0.85)",
    glowSoft: "rgba(34, 197, 94, 0.45)",
  },
  {
    id: "cyan",
    label: "青",
    main: "#22d3ee",
    unit: "#67e8f9",
    glow: "rgba(34, 211, 238, 0.85)",
    glowSoft: "rgba(6, 182, 212, 0.45)",
  },
  {
    id: "blue",
    label: "蓝",
    main: "#60a5fa",
    unit: "#93c5fd",
    glow: "rgba(96, 165, 250, 0.85)",
    glowSoft: "rgba(59, 130, 246, 0.45)",
  },
  {
    id: "yellow",
    label: "黄",
    main: "#facc15",
    unit: "#fde047",
    glow: "rgba(250, 204, 21, 0.85)",
    glowSoft: "rgba(234, 179, 8, 0.45)",
  },
  {
    id: "white",
    label: "白",
    main: "#f5f5f5",
    unit: "#e5e5e5",
    glow: "rgba(255, 255, 255, 0.75)",
    glowSoft: "rgba(255, 255, 255, 0.35)",
  },
];

function isDisplayColorId(value: string): value is DisplayColorId {
  return DISPLAY_COLORS.some((c) => c.id === value);
}

function loadDisplayColorId(): DisplayColorId {
  if (typeof window === "undefined") return "orange";
  try {
    const raw = localStorage.getItem(DISPLAY_COLOR_STORAGE_KEY);
    if (raw && isDisplayColorId(raw)) return raw;
  } catch {
    /* ignore */
  }
  return "orange";
}

function displayColorStyle(preset: DisplayColorPreset): CSSProperties {
  return {
    ["--display-color" as string]: preset.main,
    ["--display-unit" as string]: preset.unit,
    ["--display-glow" as string]: preset.glow,
    ["--display-glow-soft" as string]: preset.glowSoft,
  };
}

const DEFAULT_TIMER_DEBUG: TimerDebugConfig = {
  timerX: 50,
  timerY: 50,
  timerWidth: 22,
  timerHeight: 11,
  rotate: 0,
  scale: 1,
};

function loadTimerDebug(): TimerDebugConfig {
  if (typeof window === "undefined") return DEFAULT_TIMER_DEBUG;
  try {
    const raw = localStorage.getItem(TIMER_DEBUG_STORAGE_KEY);
    if (!raw) return DEFAULT_TIMER_DEBUG;
    const parsed = JSON.parse(raw) as Partial<TimerDebugConfig>;
    return { ...DEFAULT_TIMER_DEBUG, ...parsed };
  } catch {
    return DEFAULT_TIMER_DEBUG;
  }
}

function saveTimerDebug(config: TimerDebugConfig) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TIMER_DEBUG_STORAGE_KEY, JSON.stringify(config));
}

const pad2 = (n: number) => n.toString().padStart(2, "0");
const pad3 = (n: number) => n.toString().padStart(3, "0");

function parseBirthUtc(yyyy: string, mm: string, dd: string): number | null {
  const yRaw = yyyy.trim();
  if (!yRaw) return null;

  const y = Number(yRaw);
  if (!Number.isInteger(y) || y < MIN_BIRTH_YEAR || y > MAX_BIRTH_YEAR) return null;

  const m = mm.trim() ? Number(mm) : 1;
  const d = dd.trim() ? Number(dd) : 1;
  if (!Number.isInteger(m) || m < 1 || m > 12) return null;
  if (!Number.isInteger(d) || d < 1 || d > 31) return null;

  const t = Date.UTC(y, m - 1, d, 12, 0, 0);
  if (Number.isNaN(t)) return null;

  const check = new Date(t);
  if (
    check.getUTCFullYear() !== y ||
    check.getUTCMonth() !== m - 1 ||
    check.getUTCDate() !== d
  ) {
    return null;
  }
  return t;
}

type LedCells = [string, string, string, string, string];

function ledCellsFromParts(
  parts: LifetimeParts | null,
  started: boolean,
  lifeEnded: boolean,
): LedCells {
  if (!started || lifeEnded || !parts) {
    return ["00", "000", "00", "00", "00"];
  }
  const allZero =
    parts.years === 0 &&
    parts.days === 0 &&
    parts.hours === 0 &&
    parts.minutes === 0 &&
    parts.seconds === 0;
  if (allZero) {
    return ["00", "000", "00", "00", "00"];
  }
  return [
    pad2(parts.years),
    pad3(parts.days),
    pad2(parts.hours),
    pad2(parts.minutes),
    pad2(parts.seconds),
  ];
}

function cycleLevel(current: Level): Level {
  return ((current + 1) % 4) as Level;
}

function timerTransformStyle(cfg: TimerDebugConfig, debug: boolean): CSSProperties {
  if (!debug) return {};
  return {
    left: `${cfg.timerX}%`,
    top: `${cfg.timerY}%`,
    width: `${cfg.timerWidth}%`,
    height: `${cfg.timerHeight}%`,
    transform: `translate(-50%, -50%) rotate(${cfg.rotate}deg) scale(${cfg.scale})`,
    transformOrigin: "center center",
  };
}

function MonolithCountdown({
  cells,
  debug,
  timerDebug,
}: {
  cells: LedCells;
  debug: boolean;
  timerDebug: TimerDebugConfig;
}) {
  return (
    <div
      className={`monolith-timer${debug ? " monolith-timer--debug" : ""}`}
      style={timerTransformStyle(timerDebug, debug)}
      aria-label="countdown"
    >
      <div className="monolith-timer__digits">
        {TIMER_ROWS.map(({ label, index }) => (
          <div key={label} className="monolith-timer__group">
            <span className="monolith-timer__digit">{cells[index]}</span>
            <span className="monolith-timer__unit">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MonolithAffirmation({ line }: { line: string }) {
  return (
    <p className="monolith-affirmation" aria-live="polite">
      {line}
    </p>
  );
}

function nextDisplayColorId(current: DisplayColorId): DisplayColorId {
  const idx = DISPLAY_COLORS.findIndex((c) => c.id === current);
  const nextIdx = idx < 0 ? 0 : (idx + 1) % DISPLAY_COLORS.length;
  return DISPLAY_COLORS[nextIdx].id;
}

function DisplayColorPicker({
  colorId,
  onChange,
}: {
  colorId: DisplayColorId;
  onChange: (id: DisplayColorId) => void;
}) {
  const active = DISPLAY_COLORS.find((c) => c.id === colorId) ?? DISPLAY_COLORS[1];

  return (
    <button
      type="button"
      className="color-picker__toggle"
      onClick={() => onChange(nextDisplayColorId(colorId))}
      aria-label={`Display color: ${active.label}. Click to change.`}
    >
      <Circle
        className="color-picker__icon"
        strokeWidth={1.5}
        fill={active.main}
        color={active.main}
      />
    </button>
  );
}

function ShareControls() {
  const [copied, setCopied] = useState(false);

  const copyPageUrl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }, []);

  const sharePage = useCallback(async () => {
    const url = window.location.href;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Moon Signal", url });
        return;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
      }
    }
    await copyPageUrl();
  }, [copyPageUrl]);

  return (
    <>
      <button
        type="button"
        className="top-control-btn top-control-btn--share"
        onClick={sharePage}
        aria-label="分享至社群"
      >
        <Share2 className="top-control-btn__icon" strokeWidth={1.5} />
      </button>
      <button
        type="button"
        className="top-control-btn top-control-btn--copy"
        onClick={copyPageUrl}
        aria-label={copied ? "已複製" : "複製連結"}
      >
        {copied ? (
          <Check className="top-control-btn__icon" strokeWidth={1.5} />
        ) : (
          <Link2 className="top-control-btn__icon" strokeWidth={1.5} />
        )}
      </button>
    </>
  );
}

function StackedLevelIcon({
  icon,
  level,
  onClick,
  ariaLabel,
  stack = "down",
}: {
  icon: ReactNode;
  level: Level;
  onClick: () => void;
  ariaLabel: string;
  stack?: "left" | "right" | "down";
}) {
  const stackClass =
    stack === "left"
      ? "icon-row__stack icon-row__stack--left"
      : stack === "right"
        ? "icon-row__stack icon-row__stack--right"
        : "icon-row__stack icon-row__stack--down";

  return (
    <button
      type="button"
      className={`icon-row__item${stack !== "down" ? " icon-row__item--hstack" : ""}`}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      <div className={stackClass}>
        {level === 0 ? (
          <span className="icon-stack__cell icon-dim" aria-hidden>
            {icon}
          </span>
        ) : (
          ([1, 2, 3] as const)
            .filter((i) => i <= level)
            .map((i) => (
              <span key={i} className="icon-stack__cell icon-lit" aria-hidden>
                {icon}
              </span>
            ))
        )}
      </div>
    </button>
  );
}

function GenderIcon({ sex }: { sex: Sex }) {
  const iconSize = "h-[18px] w-[18px]";
  if (sex === "male") return <Mars className={iconSize} strokeWidth={1.25} />;
  if (sex === "female") return <Venus className={iconSize} strokeWidth={1.25} />;
  return <VenusAndMars className={iconSize} strokeWidth={1.25} />;
}

function MoodIcon({ level }: { level: Level }) {
  if (level === 1) return <Frown className="h-[18px] w-[18px]" strokeWidth={1.25} />;
  if (level === 2) return <Meh className="h-[18px] w-[18px]" strokeWidth={1.25} />;
  if (level === 3) return <Smile className="h-[18px] w-[18px]" strokeWidth={1.25} />;
  return <Meh className="h-[18px] w-[18px]" strokeWidth={1.25} />;
}

function IconRow({
  sex,
  setSex,
  smoking,
  setSmoking,
  alcohol,
  setAlcohol,
  exercise,
  setExercise,
  sleep,
  setSleep,
  happiness,
  setHappiness,
}: {
  sex: Sex;
  setSex: (v: Sex) => void;
  smoking: Level;
  setSmoking: (v: Level) => void;
  alcohol: Level;
  setAlcohol: (v: Level) => void;
  exercise: Level;
  setExercise: (v: Level) => void;
  sleep: Level;
  setSleep: (v: Level) => void;
  happiness: Level;
  setHappiness: (v: Level) => void;
}) {
  const iconSize = "h-[18px] w-[18px]";

  const toggleSex = () => {
    if (sex === "") setSex("male");
    else if (sex === "male") setSex("female");
    else setSex("");
  };

  return (
    <div className="icon-columns">
      <div className="icon-column icon-column--left">
        <button
          type="button"
          className="icon-row__item"
          onClick={toggleSex}
          aria-label="gender"
          aria-pressed={sex !== ""}
        >
          <div className={`icon-row__frame ${sex ? "icon-lit" : "icon-dim"}`}>
            <GenderIcon sex={sex} />
          </div>
        </button>

        <StackedLevelIcon
          icon={<Cigarette className={iconSize} strokeWidth={1.25} />}
          level={smoking}
          onClick={() => setSmoking(cycleLevel(smoking))}
          ariaLabel="smoking"
          stack="left"
        />
        <StackedLevelIcon
          icon={<Wine className={iconSize} strokeWidth={1.25} />}
          level={alcohol}
          onClick={() => setAlcohol(cycleLevel(alcohol))}
          ariaLabel="alcohol"
          stack="left"
        />
      </div>

      <div className="icon-column icon-column--right">
        <StackedLevelIcon
          icon={<Dumbbell className={iconSize} strokeWidth={1.25} />}
          level={exercise}
          onClick={() => setExercise(cycleLevel(exercise))}
          ariaLabel="exercise"
          stack="right"
        />
        <StackedLevelIcon
          icon={<Moon className={iconSize} strokeWidth={1.25} />}
          level={sleep}
          onClick={() => setSleep(cycleLevel(sleep))}
          ariaLabel="sleep"
          stack="right"
        />

        <button
          type="button"
          className="icon-row__item"
          onClick={() => setHappiness(cycleLevel(happiness))}
          aria-label="mood"
        >
          <div className={`icon-row__frame ${happiness ? "icon-lit" : "icon-dim"}`}>
            <MoodIcon level={happiness} />
          </div>
        </button>
      </div>
    </div>
  );
}

function BirthDatePanel({
  yyyy,
  setYyyy,
  mm,
  setMm,
  dd,
  setDd,
  begin,
  dateWarn,
}: {
  yyyy: string;
  setYyyy: (v: string) => void;
  mm: string;
  setMm: (v: string) => void;
  dd: string;
  setDd: (v: string) => void;
  begin: () => void;
  dateWarn: boolean;
}) {
  const inputClass = `birth-panel__input${dateWarn ? " birth-panel__input--warn" : ""}`;

  return (
    <motion.div
      className="birth-panel"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <p className="birth-panel__title">ENTER YOUR BIRTH DATE</p>
      <div className="birth-panel__inputs">
        <input
          inputMode="numeric"
          maxLength={4}
          placeholder="YYYY"
          value={yyyy}
          onChange={(e) => setYyyy(e.target.value.replace(/\D/g, "").slice(0, 4))}
          className={inputClass}
          aria-label="year"
        />
        <input
          inputMode="numeric"
          maxLength={2}
          placeholder="MM"
          value={mm}
          onChange={(e) => setMm(e.target.value.replace(/\D/g, "").slice(0, 2))}
          className={inputClass}
          aria-label="month"
        />
        <input
          inputMode="numeric"
          maxLength={2}
          placeholder="DD"
          value={dd}
          onChange={(e) => setDd(e.target.value.replace(/\D/g, "").slice(0, 2))}
          className={inputClass}
          aria-label="day"
        />
      </div>
      <button type="button" className="birth-panel__begin" onClick={begin}>
        BEGIN
      </button>
      <p className="birth-panel__sub">生年月日を入力してください</p>
    </motion.div>
  );
}

function InstagramIcon() {
  return (
    <svg
      className="page-footer__social-icon"
      viewBox="0 0 24 24"
      width="12"
      height="12"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.7202-2.1228 1.3877-.6652.6674-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0063 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1483.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1275 1.3802.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0813 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.7209 2.1228-1.3881.665-.6674 1.0745-1.337 1.3795-2.1274.2957-.7637.4965-1.6365.552-2.9128.056-1.2809.0692-1.6896.063-4.948-.0063-3.2583-.021-3.6668-.0816-4.9465-.0607-1.2799-.264-2.1487-.5633-2.9117-.3084-.7889-.7206-1.4578-1.3879-2.1228C21.2982 1.936 20.628.5268 19.8378.3368 19.0685.1497 18.1943.0366 16.9167.0106 15.6368-.0156 15.2278-.0042 11.9703.002 8.7129.0082 8.3026.035 7.0301.084zm.0288 4.9763c3.1103 0 5.6332 2.5228 5.6332 5.633 0 3.1124-2.521 5.6326-5.6332 5.6326-3.1123 0-5.6343-2.5202-5.6343-5.6326 0-3.1102 2.522-5.633 5.6343-5.633zm0 9.2952c2.0165 0 3.6506-1.6341 3.6506-3.6506S9.0749 7.7546 7.0584 7.7546 3.4079 9.3887 3.4079 11.4052 5.0419 15.3554 7.0584 15.3554zm5.784-10.0116c.7277 0 1.3176-.5899 1.3176-1.3176 0-.7277-.5899-1.3176-1.3176-1.3176-.7277 0-1.3175.5899-1.3175 1.3176 0 .7277.5898 1.3176 1.3175 1.3176z" />
    </svg>
  );
}

function ThreadsIcon() {
  return (
    <svg
      className="page-footer__social-icon"
      viewBox="0 0 192 192"
      width="12"
      height="12"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M141.537 88.9883C140.71 88.5919 139.87 88.2104 139.019 87.8451C137.537 60.5382 122.616 44.905 97.5619 44.745C97.4484 44.7443 97.3355 44.7443 97.222 44.7443C82.2364 44.7443 69.7731 51.1409 62.102 62.7807L75.881 72.2328C81.6116 63.5383 90.6052 61.6848 97.2286 61.6848C97.3051 61.6848 97.3819 61.6848 97.4576 61.6855C105.707 61.7381 111.932 64.1366 115.961 68.814C118.893 72.2193 120.854 76.925 121.825 82.8638C114.511 81.6207 106.601 81.2385 98.145 81.7233C74.3247 83.0954 59.0111 96.9879 60.0396 116.292C60.5615 126.084 65.4397 134.508 73.775 140.011C80.8224 144.663 89.899 146.938 99.3323 146.423C111.79 145.74 121.563 140.987 128.381 132.296C133.559 125.696 136.834 117.143 138.28 106.366C144.217 109.949 148.617 114.664 151.047 120.332C155.179 129.967 155.42 145.8 142.501 158.708C131.182 170.016 117.576 174.908 97.0135 175.059C74.2042 174.89 56.9538 167.575 45.7381 153.317C35.2355 139.966 29.8077 120.682 29.6052 96C29.8077 71.3178 35.2355 52.0336 45.7381 38.6827C56.9538 24.4249 74.2039 17.11 97.0132 16.9405C119.988 17.1113 137.539 24.4614 149.184 38.788C154.894 45.8136 159.199 54.6488 162.037 64.9503L178.184 60.6422C174.744 47.9622 169.331 37.0357 161.965 27.974C147.036 9.60668 125.202 0.195148 97.0695 0H96.9569C68.8816 0.19447 47.2921 9.6418 32.7883 28.0793C19.8819 44.4864 13.2244 67.3157 13.0007 95.9325L13 96L13.0007 96.0675C13.2244 124.684 19.8819 147.514 32.7883 163.921C47.2921 182.358 68.8816 191.806 96.9569 192H97.0695C122.03 191.827 139.624 185.292 154.118 170.811C173.081 151.866 172.51 128.119 166.26 113.541C161.776 103.087 153.227 94.5962 141.537 88.9883ZM98.4405 129.507C88.0005 130.095 77.1544 125.409 76.6196 115.372C76.2232 107.93 81.9158 99.626 99.0812 98.6368C101.047 98.5234 102.976 98.468 104.871 98.468C111.106 98.468 116.939 99.0737 122.242 100.233C120.264 124.935 108.662 128.946 98.4405 129.507Z" />
    </svg>
  );
}

function PageFooter() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const SESSION_KEY = "quantinu-signal-counted";

    async function loadCount() {
      try {
        if (!sessionStorage.getItem(SESSION_KEY)) {
          const hitRes = await fetch("/api/signals", { method: "POST" });
          if (hitRes.ok) {
            const hitData = await hitRes.json();
            setCount(typeof hitData.count === "number" ? hitData.count : 0);
            sessionStorage.setItem(SESSION_KEY, "1");
            return;
          }
        }

        const res = await fetch("/api/signals");
        if (!res.ok) return;
        const data = await res.json();
        setCount(typeof data.count === "number" ? data.count : 0);
      } catch {
        /* counter unavailable */
      }
    }

    loadCount();
  }, []);

  const display =
    count === null ? "-----" : String(count).padStart(5, "0");

  return (
    <footer className="page-footer">
      <p className="page-footer__signals">SiGNaLs ReCeiVed : {display}</p>
      <p className="page-footer__copy">
        <span>© 2026 Quantinu Studio. All rights reserved.</span>
        <span className="page-footer__social">
          <a
            href="https://www.instagram.com/quantinu_studio"
            target="_blank"
            rel="noopener noreferrer"
            className="page-footer__social-link"
            aria-label="Instagram @quantinu_studio"
          >
            <InstagramIcon />
          </a>
          <a
            href="https://www.threads.net/@quantinu_studio"
            target="_blank"
            rel="noopener noreferrer"
            className="page-footer__social-link"
            aria-label="Threads @quantinu_studio"
          >
            <ThreadsIcon />
          </a>
        </span>
      </p>
    </footer>
  );
}

function TimerDebugPanel({
  config,
  onChange,
  onClose,
}: {
  config: TimerDebugConfig;
  onChange: (next: TimerDebugConfig) => void;
  onClose: () => void;
}) {
  const sliders: {
    key: keyof TimerDebugConfig;
    label: string;
    min: number;
    max: number;
    step: number;
  }[] = [
    { key: "timerX", label: "timerX", min: 0, max: 100, step: 0.1 },
    { key: "timerY", label: "timerY", min: 0, max: 100, step: 0.1 },
    { key: "timerWidth", label: "timerWidth", min: 5, max: 50, step: 0.1 },
    { key: "timerHeight", label: "timerHeight", min: 3, max: 30, step: 0.1 },
    { key: "rotate", label: "rotate", min: -45, max: 45, step: 0.5 },
    { key: "scale", label: "scale", min: 0.3, max: 2.5, step: 0.01 },
  ];

  const set = (key: keyof TimerDebugConfig, value: number) => {
    const next = { ...config, [key]: value };
    onChange(next);
    saveTimerDebug(next);
  };

  return (
    <div className="timer-debug-panel" role="dialog" aria-label="Timer debug controls">
      <div className="timer-debug-panel__header">
        <span>Timer debug</span>
        <button type="button" className="timer-debug-panel__close" onClick={onClose}>
          x
        </button>
      </div>
      {sliders.map(({ key, label, min, max, step }) => (
        <label key={key} className="timer-debug-panel__row">
          <span>
            {label}: {config[key].toFixed(key === "scale" ? 2 : 1)}
          </span>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={config[key]}
            onChange={(e) => set(key, Number(e.target.value))}
          />
        </label>
      ))}
      <button
        type="button"
        className="timer-debug-panel__reset"
        onClick={() => {
          onChange(DEFAULT_TIMER_DEBUG);
          saveTimerDebug(DEFAULT_TIMER_DEBUG);
        }}
      >
        Reset defaults
      </button>
      <p className="timer-debug-panel__hint">
        Press D to toggle. Values saved to localStorage.
      </p>
    </div>
  );
}

export function MoonArtifactExperience() {
  const [yyyy, setYyyy] = useState("");
  const [mm, setMm] = useState("");
  const [dd, setDd] = useState("");
  const [sex, setSex] = useState<Sex>("");
  const [smoking, setSmoking] = useState<Level>(0);
  const [alcohol, setAlcohol] = useState<Level>(0);
  const [exercise, setExercise] = useState<Level>(0);
  const [sleep, setSleep] = useState<Level>(0);
  const [happiness, setHappiness] = useState<Level>(0);

  const [endMs, setEndMs] = useState<number | null>(null);
  const [parts, setParts] = useState<LifetimeParts | null>(null);
  const [started, setStarted] = useState(false);
  const [lifeEnded, setLifeEnded] = useState(false);
  const [dateWarn, setDateWarn] = useState(false);

  const [sessionBirthMs, setSessionBirthMs] = useState<number | null>(null);
  const [sessionProfile, setSessionProfile] = useState<LifeProfile | null>(null);
  const [sessionAnchorMs, setSessionAnchorMs] = useState<number | null>(null);
  const [affirmIdx, setAffirmIdx] = useState(0);

  const [timerDebug, setTimerDebug] = useState<TimerDebugConfig>(DEFAULT_TIMER_DEBUG);
  const [debugMode, setDebugMode] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);
  const [displayColorId, setDisplayColorId] = useState<DisplayColorId>("orange");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const active = started && endMs !== null;
  const displayColor =
    DISPLAY_COLORS.find((c) => c.id === displayColorId) ?? DISPLAY_COLORS[1];
  const stageStyle = useMemo(() => displayColorStyle(displayColor), [displayColor]);

  useEffect(() => {
    setDisplayColorId(loadDisplayColorId());
  }, []);

  const onDisplayColorChange = useCallback((id: DisplayColorId) => {
    setDisplayColorId(id);
    try {
      localStorage.setItem(DISPLAY_COLOR_STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    setTimerDebug(loadTimerDebug());
    const params = new URLSearchParams(window.location.search);
    if (params.get("debug") === "1") setDebugMode(true);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "d" || e.key === "D") {
        setDebugMode((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!active || endMs === null) return;
    const tick = () => {
      const now = Date.now();
      if (now >= endMs) {
        setLifeEnded(true);
        setParts({
          years: 0,
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
        });
        return;
      }
      setLifeEnded(false);
      setParts(remainingParts(now, endMs));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [active, endMs]);

  const tryPlayAudio = useCallback(() => {
    const el = audioRef.current;
    if (!el || el.muted) return;
    el.volume = 0.38;
    void el.play().catch(() => undefined);
  }, []);

  const toggleMute = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    setAudioMuted((prev) => {
      const next = !prev;
      el.muted = next;
      if (!next) {
        el.volume = 0.38;
        void el.play().catch(() => undefined);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    tryPlayAudio();
    const resumeOnGesture = () => tryPlayAudio();
    window.addEventListener("pointerdown", resumeOnGesture, { once: true });
    window.addEventListener("keydown", resumeOnGesture, { once: true });
    return () => {
      window.removeEventListener("pointerdown", resumeOnGesture);
      window.removeEventListener("keydown", resumeOnGesture);
    };
  }, [tryPlayAudio]);

  const begin = useCallback(() => {
    const yyy = yyyy.trim();
    const mmm = mm.trim();
    const ddd = dd.trim();
    const hasAnyDateField = Boolean(yyy || mmm || ddd);

    const parsed = parseBirthUtc(yyy, mmm, ddd);
    const profile: LifeProfile = {
      region: "",
      sex,
      smoking,
      alcohol,
      exercise,
      sleep,
      happiness,
    };
    const now = Date.now();

    if (parsed === null) {
      setDateWarn(true);
      window.setTimeout(() => setDateWarn(false), 1400);
      if (!hasAnyDateField) return;

      setSessionProfile(profile);
      setSessionBirthMs(null);
      setSessionAnchorMs(now);
      setAffirmIdx(0);
      setEndMs(now - 1);
      setParts({ years: 0, days: 0, hours: 0, minutes: 0, seconds: 0 });
      setLifeEnded(true);
      setStarted(true);
      return;
    }

    setDateWarn(false);
    const end = resolvedProjectedEndMs(parsed, profile, now);
    const ended = end <= now;

    setSessionProfile(profile);
    setSessionBirthMs(parsed);
    setSessionAnchorMs(now);
    setAffirmIdx(0);
    setEndMs(end);
    setParts(remainingParts(now, end));
    setLifeEnded(ended);
    setStarted(true);
  }, [
    yyyy,
    mm,
    dd,
    sex,
    smoking,
    alcohol,
    exercise,
    sleep,
    happiness,
  ]);

  const affirmationPool = useMemo(() => {
    if (!sessionProfile || sessionAnchorMs === null) return [];
    return buildAffirmationPool(sessionProfile, sessionBirthMs, sessionAnchorMs);
  }, [sessionProfile, sessionBirthMs, sessionAnchorMs]);

  const affirmationHorizonMs = AFFIRMATION_ONLY_UNDER_YEARS * YEAR_MS;
  const remainingMs =
    started && endMs !== null ? endMs - Date.now() : Number.POSITIVE_INFINITY;

  const showAffirmations =
    started &&
    sessionProfile !== null &&
    sessionAnchorMs !== null &&
    affirmationPool.length > 0 &&
    endMs !== null &&
    remainingMs < affirmationHorizonMs;

  useEffect(() => {
    if (sessionAnchorMs === null) return;
    setAffirmIdx(0);
  }, [sessionAnchorMs]);

  useEffect(() => {
    if (!showAffirmations || affirmationPool.length < 2) return;
    const id = window.setInterval(() => {
      setAffirmIdx((i) => (i + 1) % affirmationPool.length);
    }, AFFIRMATION_DISPLAY_MS);
    return () => window.clearInterval(id);
  }, [showAffirmations, affirmationPool]);

  const ledCells = ledCellsFromParts(parts, started, lifeEnded);
  const affirmationLine = showAffirmations
    ? affirmationPool[affirmIdx % affirmationPool.length] ?? ""
    : "";

  const displayCells: LedCells = !started ? IDLE_CELLS : ledCells;

  const onTimerDebugChange = (next: TimerDebugConfig) => {
    setTimerDebug(next);
    saveTimerDebug(next);
  };

  return (
    <div className="moon-stage" style={stageStyle}>
      <div className="moon-canvas-scaler">
        <div className="moon-canvas">
          <div className="moon-overlay-root">
            <AnimatePresence>
              {!started && (
                <>
                  <IconRow
                    sex={sex}
                    setSex={setSex}
                    smoking={smoking}
                    setSmoking={setSmoking}
                    alcohol={alcohol}
                    setAlcohol={setAlcohol}
                    exercise={exercise}
                    setExercise={setExercise}
                    sleep={sleep}
                    setSleep={setSleep}
                    happiness={happiness}
                    setHappiness={setHappiness}
                  />
                  <BirthDatePanel
                    yyyy={yyyy}
                    setYyyy={setYyyy}
                    mm={mm}
                    setMm={setMm}
                    dd={dd}
                    setDd={setDd}
                    begin={begin}
                    dateWarn={dateWarn}
                  />
                </>
              )}
            </AnimatePresence>

            {showAffirmations && affirmationLine && (
              <MonolithAffirmation line={affirmationLine} />
            )}

            {!showAffirmations && (
              <MonolithCountdown
                cells={displayCells}
                debug={debugMode}
                timerDebug={timerDebug}
              />
            )}

            <PageFooter />
          </div>
        </div>
      </div>

      <div className="top-left-controls">
        <button
          type="button"
          className="audio-mute-toggle"
          onClick={toggleMute}
          aria-label={audioMuted ? "Unmute audio" : "Mute audio"}
          aria-pressed={audioMuted}
        >
          {audioMuted ? (
            <VolumeX className="audio-mute-toggle__icon" strokeWidth={1.5} />
          ) : (
            <Volume2 className="audio-mute-toggle__icon" strokeWidth={1.5} />
          )}
        </button>

        <DisplayColorPicker colorId={displayColorId} onChange={onDisplayColorChange} />
        <ShareControls />
      </div>

      {debugMode && (
        <TimerDebugPanel
          config={timerDebug}
          onChange={onTimerDebugChange}
          onClose={() => setDebugMode(false)}
        />
      )}

      <audio ref={audioRef} src="/amibient.mp3" preload="auto" loop />
    </div>
  );
}
