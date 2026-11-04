// Pure logic for the optional Fitness tab: formatting, personal records, and progression.
//
// Data (all optional in data.json, soft-deleted like everything else):
//   exercises:   { id, name, kind, unit, ... }            kind: weight | bodyweight | time | cardio
//   workouts:    { id, name, items: [{ exerciseId, setsMin, setsMax, targetMin, targetMax }], order, ... }
//   workoutLogs: { id, date, workoutId, name, entries: [{ exerciseId, sets: [{ weight, reps, seconds, distance, minutes }] }], ... }
// A target range (targetMin–targetMax) is reps, or seconds for timed exercises.

export const KINDS = [
  { id: "weight", label: "Weights", hint: "weight × reps" },
  { id: "bodyweight", label: "Bodyweight", hint: "reps, optional added weight" },
  { id: "time", label: "Timed", hint: "seconds, e.g. plank" },
  { id: "cardio", label: "Cardio", hint: "distance and minutes" }
];

export const UNIT_SYSTEMS = [
  { id: "imperial", label: "Pounds and miles (lb, mi)" },
  { id: "metric", label: "Kilograms and kilometers (kg, km)" }
];

export function defaultUnit(kind, system = "imperial") {
  if (kind === "time") return "";
  if (kind === "cardio") return system === "metric" ? "km" : "mi";
  return system === "metric" ? "kg" : "lb";
}

export function unitOptions(kind) {
  if (kind === "time") return [];
  return kind === "cardio" ? ["mi", "km"] : ["lb", "kg"];
}

export function activeExercises(data) {
  return (data.exercises || []).filter((item) => !item.deleted && !item.archived);
}

export function activeWorkouts(data) {
  return (data.workouts || []).filter((item) => !item.deleted && !item.archived)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a.createdAt).localeCompare(String(b.createdAt)));
}

export function activeLogs(data) {
  return (data.workoutLogs || []).filter((item) => !item.deleted);
}

export function findExercise(data, id) {
  return (data.exercises || []).find((item) => item.id === id) || null;
}

export function findExerciseByName(data, name) {
  const wanted = String(name).trim().toLowerCase();
  if (!wanted) return null;
  return activeExercises(data).find((item) => item.name.trim().toLowerCase() === wanted) || null;
}

export function formatNumber(value) {
  if (!Number.isFinite(value)) return "";
  return String(Math.round(value * 100) / 100);
}

export function formatRange(min, max, suffix = "") {
  const low = Number.isFinite(min) && min > 0 ? min : null;
  const high = Number.isFinite(max) && max > 0 ? max : null;
  if (low === null && high === null) return "";
  if (low === null || high === null || low === high) return `${formatNumber(low ?? high)}${suffix}`;
  return `${formatNumber(Math.min(low, high))}–${formatNumber(Math.max(low, high))}${suffix}`;
}

// "3 × 6–10", "2–3 × 8–10", "2–3 × 30–60s" (timed). Returns "" when nothing is set.
export function formatTarget(item, kind) {
  const sets = formatRange(item.setsMin, item.setsMax);
  const target = kind === "cardio" ? "" : formatRange(item.targetMin, item.targetMax, kind === "time" ? "s" : "");
  if (sets && target) return `${sets} × ${target}`;
  return sets ? `${sets} sets` : target;
}

const has = (value) => Number.isFinite(value) && value > 0;

export function formatSet(set, kind, unit = "") {
  const weight = has(set.weight) ? `${formatNumber(set.weight)}${unit ? ` ${unit}` : ""}` : "";
  if (kind === "time") return has(set.seconds) ? `${formatNumber(set.seconds)}s` : "";
  if (kind === "cardio") {
    return [has(set.distance) ? `${formatNumber(set.distance)} ${unit}`.trim() : "", has(set.minutes) ? `${formatNumber(set.minutes)} min` : ""]
      .filter(Boolean).join(" · ");
  }
  if (kind === "bodyweight") {
    const reps = has(set.reps) ? `${formatNumber(set.reps)} reps` : "";
    return weight ? `${reps ? `${reps} ` : ""}+${weight}`.trim() : reps;
  }
  if (weight && has(set.reps)) return `${formatNumber(set.weight)} × ${formatNumber(set.reps)}`;
  return weight || (has(set.reps) ? `${formatNumber(set.reps)} reps` : "");
}

export function formatSets(sets, kind, unit = "") {
  return sets.map((set) => formatSet(set, kind, unit)).filter(Boolean).join(", ");
}

// Epley estimate of a one-rep max; only meaningful for reasonably low rep sets.
export function estimateOneRepMax(weight, reps) {
  if (!has(weight) || !has(reps)) return null;
  return reps === 1 ? weight : weight * (1 + reps / 30);
}

function maxOf(values) {
  const valid = values.filter(Number.isFinite);
  return valid.length ? Math.max(...valid) : null;
}

function sumOf(values) {
  const valid = values.filter(has);
  return valid.length ? valid.reduce((total, value) => total + value, 0) : null;
}

// Metrics shown for each kind of exercise. `value(sets)` summarises one session; null means "no data".
// `better` says which direction is a record; `pr` marks the metrics celebrated as personal records.
export function metricsFor(kind) {
  if (kind === "time") {
    return [
      { id: "longest", label: "Longest hold", better: "max", pr: true, unit: "s", value: (sets) => maxOf(sets.map((set) => set.seconds)) },
      { id: "total", label: "Total time", better: "max", pr: false, unit: "s", value: (sets) => sumOf(sets.map((set) => set.seconds)) }
    ];
  }
  if (kind === "cardio") {
    return [
      { id: "distance", label: "Distance", better: "max", pr: true, unit: "distance", value: (sets) => sumOf(sets.map((set) => set.distance)) },
      { id: "duration", label: "Duration", better: "max", pr: false, unit: "min", value: (sets) => sumOf(sets.map((set) => set.minutes)) },
      { id: "pace", label: "Pace", better: "min", pr: true, unit: "pace", value: (sets) => {
        const distance = sumOf(sets.filter((set) => has(set.distance) && has(set.minutes)).map((set) => set.distance));
        const minutes = sumOf(sets.filter((set) => has(set.distance) && has(set.minutes)).map((set) => set.minutes));
        return distance && minutes ? minutes / distance : null;
      } }
    ];
  }
  if (kind === "bodyweight") {
    return [
      { id: "bestReps", label: "Best set (reps)", better: "max", pr: true, unit: "reps", value: (sets) => maxOf(sets.filter((set) => has(set.reps)).map((set) => set.reps)) },
      { id: "totalReps", label: "Total reps", better: "max", pr: false, unit: "reps", value: (sets) => sumOf(sets.map((set) => set.reps)) },
      { id: "topWeight", label: "Added weight", better: "max", pr: true, unit: "weight", value: (sets) => maxOf(sets.filter((set) => has(set.weight)).map((set) => set.weight)) }
    ];
  }
  return [
    { id: "topWeight", label: "Top weight", better: "max", pr: true, unit: "weight", value: (sets) => maxOf(sets.filter((set) => has(set.weight)).map((set) => set.weight)) },
    { id: "oneRepMax", label: "Est. 1RM", better: "max", pr: true, chart: false, unit: "weight", value: (sets) => maxOf(sets.map((set) => estimateOneRepMax(set.weight, set.reps))) },
    { id: "volume", label: "Volume", better: "max", pr: false, unit: "weight", value: (sets) => sumOf(sets.map((set) => has(set.weight) && has(set.reps) ? set.weight * set.reps : null)) }
  ];
}

// "Nice" axis for a chart: round tick values that cover [min, max].
export function niceScale(min, max, ticks = 3) {
  const range = max - min;
  const rough = (range || Math.max(1, Math.abs(max) * 0.2)) / ticks;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((factor) => factor * magnitude).find((candidate) => candidate >= rough);
  // A flat line (one session, or no change) sits in the middle of the chart instead of on an edge.
  const lo = Math.max(0, Math.floor(min / step) * step - (range ? 0 : step));
  let hi = Math.ceil(max / step) * step;
  if (hi - lo < step * ticks) hi = lo + step * ticks;
  return { lo, hi, step, ticks: Array.from({ length: Math.round((hi - lo) / step) + 1 }, (_, index) => lo + index * step) };
}

export function metricUnitLabel(metric, exercise) {
  if (metric.unit === "weight") return exercise.unit || "";
  if (metric.unit === "distance") return exercise.unit || "";
  if (metric.unit === "pace") return exercise.unit ? `min/${exercise.unit}` : "min";
  return metric.unit;
}

// 9.9 minutes per mile -> "9:54"
export function formatPace(minutes) {
  const total = Math.round(minutes * 60);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function formatMetric(value, metric, exercise) {
  if (value === null || value === undefined) return "–";
  if (metric.unit === "pace") return `${formatPace(value)} /${exercise.unit || "unit"}`;
  const unit = metricUnitLabel(metric, exercise);
  const rounded = Math.round(value * 10) / 10;
  if (!unit) return formatNumber(rounded);
  return unit === "s" ? `${formatNumber(rounded)}s` : `${formatNumber(rounded)} ${unit}`;
}

// Every logged session of an exercise, oldest first: { date, logId, name, sets }.
export function sessionsFor(data, exerciseId) {
  const sessions = [];
  for (const log of activeLogs(data)) {
    for (const entry of log.entries) {
      if (entry.exerciseId === exerciseId && entry.sets.length) {
        sessions.push({ date: log.date, logId: log.id, name: log.name || "", sets: entry.sets, updatedAt: log.updatedAt || "" });
      }
    }
  }
  return sessions.sort((a, b) => a.date.localeCompare(b.date) || a.updatedAt.localeCompare(b.updatedAt) || a.logId.localeCompare(b.logId));
}

// Ids of sessions that set a new best for the metric (the first session never counts as a record).
export function recordSessionIds(sessions, metric) {
  const ids = new Set();
  let best = null;
  for (const session of sessions) {
    const value = metric.value(session.sets);
    if (value === null) continue;
    const beats = best === null ? false : metric.better === "max" ? value > best : value < best;
    if (beats) ids.add(session.logId);
    if (best === null || beats) best = value;
  }
  return ids;
}

// Best-ever value of each metric across all sessions.
export function personalRecords(data, exercise) {
  const sessions = sessionsFor(data, exercise.id);
  return metricsFor(exercise.kind).map((metric) => {
    let best = null;
    let date = "";
    for (const session of sessions) {
      const value = metric.value(session.sets);
      if (value === null) continue;
      if (best === null || (metric.better === "max" ? value > best : value < best)) {
        best = value;
        date = session.date;
      }
    }
    return { metric, value: best, date };
  });
}

// Most recent earlier session for the exercise (optionally excluding one log).
export function lastSession(data, exerciseId, { beforeDate = null, excludeLogId = null } = {}) {
  const sessions = sessionsFor(data, exerciseId)
    .filter((session) => session.logId !== excludeLogId && (!beforeDate || session.date <= beforeDate));
  return sessions.length ? sessions[sessions.length - 1] : null;
}

// Records set by a log compared with everything logged on or before its date.
export function detectPRs(data, log) {
  const found = [];
  for (const entry of log.entries) {
    const exercise = findExercise(data, entry.exerciseId);
    if (!exercise) continue;
    const earlier = sessionsFor(data, exercise.id).filter((session) => session.logId !== log.id && session.date <= log.date);
    if (!earlier.length) continue;
    for (const metric of metricsFor(exercise.kind).filter((item) => item.pr)) {
      const value = metric.value(entry.sets);
      if (value === null) continue;
      const previous = earlier.map((session) => metric.value(session.sets)).filter((item) => item !== null);
      if (!previous.length) continue;
      const best = metric.better === "max" ? Math.max(...previous) : Math.min(...previous);
      if (metric.better === "max" ? value > best : value < best) {
        found.push({ exercise, metric, value });
      }
    }
  }
  return found;
}

// Nearest plate-friendly weight: 5 lb or 2.5 kg steps (never below one step).
export function roundWeight(value, unit) {
  const step = unit === "kg" ? 2.5 : 5;
  return Math.max(step, Math.round(value / step) * step);
}

export const WORKING_PERCENT = 0.8;
// Reps that 80% of a one-rep max is worth under the Epley formula (about 7.5).
const REPS_AT_WORKING_WEIGHT = 8;

// What to prefill for every set of an exercise so the user only edits what differs.
// Weights use 80% of the estimated 1RM from the last session when there is one, otherwise last session's numbers.
// With no history nothing is prefilled (an exercise you skip must not be logged as done); typing one value in the
// first set fills the sets below it. Returns { set, source, e1rm } where set holds numbers (or nothing).
export function suggestSet(kind, unit, lastSets, target = {}) {
  const last = lastSets || [];
  const first = last[0] || {};
  const lowTarget = has(target?.targetMin) ? target.targetMin : null;
  const clamp = (reps) => {
    if (has(target?.targetMax) && reps > target.targetMax) return target.targetMax;
    if (lowTarget && reps < lowTarget) return lowTarget;
    return reps;
  };
  if (kind === "weight") {
    const e1rm = maxOf(last.map((set) => estimateOneRepMax(set.weight, set.reps)));
    if (e1rm) return { set: { weight: roundWeight(e1rm * WORKING_PERCENT, unit), reps: clamp(REPS_AT_WORKING_WEIGHT) }, source: "e1rm", e1rm };
    if (has(first.weight)) return { set: { weight: first.weight, ...(has(first.reps) ? { reps: first.reps } : {}) }, source: "last", e1rm: null };
    if (has(first.reps)) return { set: { reps: first.reps }, source: "last", e1rm: null };
    return { set: {}, source: null, e1rm: null };
  }
  if (kind === "bodyweight") {
    return has(first.reps) ? { set: { reps: first.reps }, source: "last", e1rm: null } : { set: {}, source: null, e1rm: null };
  }
  if (kind === "time") {
    return has(first.seconds) ? { set: { seconds: first.seconds }, source: "last", e1rm: null } : { set: {}, source: null, e1rm: null };
  }
  const set = {};
  if (has(first.distance)) set.distance = first.distance;
  if (has(first.minutes)) set.minutes = first.minutes;
  return { set, source: Object.keys(set).length ? "last" : null, e1rm: null };
}

// Double progression: once every set reaches the top of the target range, it is time to add weight.
export function progressionHint(lastSets, item, kind) {
  if (!lastSets?.length || !has(item?.targetMax) || (kind !== "weight" && kind !== "bodyweight")) return null;
  const needed = item.setsMin || item.setsMax || 1;
  if (lastSets.length < needed) return null;
  return lastSets.every((set) => has(set.reps) && set.reps >= item.targetMax)
    ? `You hit ${formatNumber(item.targetMax)} reps on every set last time. Try adding weight.`
    : null;
}
