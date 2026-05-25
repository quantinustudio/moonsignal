/**
 * Life expectancy model (illustrative, not medical advice).
 * Regional baselines trace WHO-style cohort averages; sums of lifestyle deltas follow
 * CHANCES, MVP, and meta-analyses. An optional forward-looking uplift reflects optimism
 * about medicine, prevention, and health-related AI over the coming decades.
 */

export type Level = 0 | 1 | 2 | 3;

/** Empty string = not specified (uses regional all-sexes baseline only). */
export type Sex = "" | "male" | "female";

export type LifeProfile = {
  region: string;
  sex: Sex;
  smoking: Level;
  alcohol: Level;
  exercise: Level;
  sleep: Level;
  happiness: Level;
};

const MS = 1000;
const MIN = 60 * MS;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
export const YEAR_MS = 365.25 * DAY;

/** All zeros; 6th segment for visual balance on the monolith slot (no extra meaning). */
export const TIMER_EXPIRED_DISPLAY = "00:000:00:00:00:00";

export const MIN_BIRTH_YEAR = 1;
export const MAX_BIRTH_YEAR = 2100;

/** Above this age, if the cohort horizon has passed, we do not extend the clock (illustrative). */
const EXTREME_SURVIVOR_AGE_CAP = 118;

/** Years added to the model to suggest longer, healthier lives under advancing care + health AI (illustrative). */
const MEDICAL_AI_OUTLOOK_YEARS = 6;

/** Floors / caps keep the portrait humane and stable; cap allows very healthy profiles room to grow. */
const LIFESPAN_MIN_YEARS = 55;
const LIFESPAN_MAX_YEARS = 104;

/** Regional cohort baselines (WHO-era statistics); outlook is layered on top. */
const REGION_BASE_YEARS: Record<string, number> = {
  "": 73.4,
  asia: 74.2,
  europe: 78.2,
  americas: 75.4,
  oceania: 81.1,
  africa: 63.8,
};

/** Level 0 = none / unknown, 1 = mild, 2 = moderate, 3 = strong. */
const SMOKING_DELTA = [0, -1.2, -4.5, -9.0] as const;
const ALCOHOL_DELTA = [0, -0.7, -2.2, -4.8] as const;
const EXERCISE_DELTA = [0, 1.2, 2.8, 4.5] as const;
const SLEEP_DELTA = [0, 1.4, -0.5, -3.2] as const;
const HAPPINESS_DELTA = [0, 0.6, 1.4, 2.2] as const;

/**
 * Versus a typical all-sexes regional baseline: cohort women live longer on average
 * (illustrative gap; not medical advice).
 */
const SEX_DELTA: Record<Sex, number> = {
  "": 0,
  male: -2.6,
  female: +2.8,
};

function sexDelta(sex: Sex): number {
  return SEX_DELTA[sex] ?? 0;
}

function levelDelta(table: readonly number[], level: Level): number {
  return table[level] ?? 0;
}

export function expectedLifespanYears(profile: LifeProfile): number {
  const base = REGION_BASE_YEARS[profile.region] ?? REGION_BASE_YEARS[""];
  const total =
    base +
    MEDICAL_AI_OUTLOOK_YEARS +
    sexDelta(profile.sex) +
    levelDelta(SMOKING_DELTA, profile.smoking) +
    levelDelta(ALCOHOL_DELTA, profile.alcohol) +
    levelDelta(EXERCISE_DELTA, profile.exercise) +
    levelDelta(SLEEP_DELTA, profile.sleep) +
    levelDelta(HAPPINESS_DELTA, profile.happiness);

  return Math.max(LIFESPAN_MIN_YEARS, Math.min(LIFESPAN_MAX_YEARS, total));
}

export function projectedEndMs(birthMs: number, profile: LifeProfile): number {
  return birthMs + expectedLifespanYears(profile) * YEAR_MS;
}

/**
 * True when the model's **typical** lifespan from birth has already elapsed (`now`),
 * i.e. the person is "past the demographic average" in this illustration—not a verdict on vitality.
 */
export function isPastTypicalLifespanFromBirth(
  birthMs: number,
  profile: LifeProfile,
  nowMs: number = Date.now(),
): boolean {
  if (birthMs > nowMs) return false;
  return projectedEndMs(birthMs, profile) <= nowMs;
}

/**
 * Horizon used for the countdown. If the cohort model's "typical" lifespan from birth is
 * already in the past but the person could still be alive, we add a **survivor tail** from
 * `now` based on approximate remaining expectancy at their current age (illustrative).
 */
export function resolvedProjectedEndMs(
  birthMs: number,
  profile: LifeProfile,
  nowMs: number = Date.now(),
): number {
  if (birthMs > nowMs) {
    return projectedEndMs(birthMs, profile);
  }

  const naiveEnd = projectedEndMs(birthMs, profile);
  if (naiveEnd > nowMs) {
    return naiveEnd;
  }

  const ageYears = (nowMs - birthMs) / YEAR_MS;
  if (ageYears >= EXTREME_SURVIVOR_AGE_CAP) {
    return naiveEnd;
  }

  const tailYears = survivorTailYearsFromCurrentAge(ageYears, profile);
  return nowMs + tailYears * YEAR_MS;
}

function survivorTailYearsFromCurrentAge(
  ageYears: number,
  profile: LifeProfile,
): number {
  let base: number;
  if (ageYears < 65) {
    base = 14;
  } else if (ageYears < 75) {
    base = Math.max(8, 20 - (ageYears - 65) * 0.85);
  } else if (ageYears < 85) {
    base = Math.max(5.5, 15 - (ageYears - 75) * 0.7);
  } else if (ageYears < 95) {
    base = Math.max(3.5, 10.5 - (ageYears - 85) * 0.55);
  } else if (ageYears < 105) {
    base = Math.max(2.5, 6.5 - (ageYears - 95) * 0.32);
  } else {
    base = Math.max(1.35, 3.8 - (ageYears - 105) * 0.35);
  }

  const sexTail =
    profile.sex === "female" ? 0.22 : profile.sex === "male" ? -0.16 : 0;
  const gentleBoost =
    profile.exercise * 0.25 +
    profile.sleep * 0.12 +
    profile.happiness * 0.15 -
    profile.smoking * 0.35 -
    profile.alcohol * 0.18 +
    sexTail;

  return Math.max(1.2, base + gentleBoost);
}

/** True when the resolved horizon is not after `nowMs`. */
export function isProjectedLifeEnded(
  birthMs: number,
  profile: LifeProfile,
  nowMs: number = Date.now(),
): boolean {
  return resolvedProjectedEndMs(birthMs, profile, nowMs) <= nowMs;
}

export type LifetimeParts = {
  years: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

export function remainingParts(fromMs: number, toMs: number): LifetimeParts {
  let left = Math.max(0, toMs - fromMs);
  const years = Math.floor(left / YEAR_MS);
  left -= years * YEAR_MS;
  const days = Math.floor(left / DAY);
  left -= days * DAY;
  const hours = Math.floor(left / HOUR);
  left -= hours * HOUR;
  const minutes = Math.floor(left / MIN);
  left -= minutes * MIN;
  const seconds = Math.floor(left / MS);
  return { years, days, hours, minutes, seconds };
}

/* ---- Gentle monolith copy (past "typical" span); not medical advice. ---- */

const AFFIRMATION_CORE: readonly string[] = [
  "Years are guesswork; your days are real.",
  "Seize the days that still find you quietly.",
  "Treasure what is here—it stayed for you.",
  "Love someone as you would wish to be loved.",
  "The clock measures averages; it does not own you.",
  "Morning light does not ask how old the window is.",
  "What you forgive in yourself, room appears for everything else.",
  "Walk gently; the path is shorter than the story you tell on it.",
  "Rest is not a failure—it is how the world keeps you.",
  "Listen for what still makes you curious; that is your compass.",
];

function affirmationHash(profile: LifeProfile, birthMs: number | null, nowMs: number): number {
  let h = (birthMs ?? nowMs) ^ nowMs;
  const s = `${profile.region}|${profile.sex}|${profile.smoking}${profile.alcohol}${profile.exercise}${profile.sleep}${profile.happiness}`;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i);
  }
  return Math.abs(h);
}

function uniqAffirmations(lines: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/**
 * Small rotating pool for the monolith when the model would show "expired" zeros but the
 * person may still be living—biased lightly by questionnaire; never shaming.
 */
export function buildAffirmationPool(
  profile: LifeProfile,
  birthMs: number | null,
  nowMs: number,
): string[] {
  const extra: string[] = [];

  const ageYears = birthMs != null ? (nowMs - birthMs) / YEAR_MS : null;
  if (ageYears != null && ageYears >= 80) {
    extra.push("You have outpaced a thousand spreadsheets; be tender with that.");
  }
  if (ageYears != null && ageYears >= 90) {
    extra.push("The world is quieter now—let what matters speak first.");
  }

  if (profile.happiness >= 2) {
    extra.push("The warmth you have practiced shows in how the room feels.");
  }
  if (profile.exercise >= 2) {
    extra.push("Movement kept its promise to you; gratitude still fits.");
  }
  if (profile.sleep >= 2) {
    extra.push("Sleep has been your quiet co-conspirator for rest.");
  }
  if (profile.smoking >= 2) {
    extra.push("Each easy breath you grant yourself is a quiet kindness.");
  }
  if (profile.alcohol >= 2) {
    extra.push("Soft evenings matter; so does whatever steadies you tomorrow.");
  }
  if (profile.region === "oceania" || profile.region === "europe") {
    extra.push("Distance and season change; belonging can be a small, daily act.");
  }

  const seed = affirmationHash(profile, birthMs, nowMs);
  const merged: string[] = [...AFFIRMATION_CORE, ...extra];

  const shuffled = [...merged];
  let x = seed;
  for (let i = shuffled.length - 1; i > 0; i--) {
    x = (x * 1664525 + 1013904223) % 4294967296;
    const j = x % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return uniqAffirmations(shuffled).slice(0, 9);
}
