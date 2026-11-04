import { localDateString } from "./dates.js";
import { isValidDateString } from "./dates.js";
import { GOAL_COLORS } from "./themes.js";

const REQUIRED_KEYS = ["goals", "completions", "rewards", "purchases"];
export const DATA_KEY = "habit-data-cache";
export const CONFIG_KEY = "habit-github-config";

export const FITNESS_KEYS = ["exercises", "workouts", "workoutLogs"];
export const EXERCISE_KINDS = ["weight", "bodyweight", "time", "cardio"];
const SET_FIELDS = ["weight", "reps", "seconds", "distance", "minutes"];

export function emptyData() {
  return { version: 1, goals: [], completions: [], rewards: [], purchases: [], exercises: [], workouts: [], workoutLogs: [] };
}

export function loadLocalData() {
  const raw = localStorage.getItem(DATA_KEY);
  if (!raw) return emptyData();
  try {
    return normalizeData(JSON.parse(raw));
  } catch (error) {
    throw new Error("Saved data on this device could not be read. Export or clear browser storage before continuing.", { cause: error });
  }
}

export function saveLocalData(data) {
  localStorage.setItem(DATA_KEY, JSON.stringify(normalizeData(data)));
}

export function normalizeData(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new TypeError("Data must be a JSON object.");
  if (data.version !== undefined && (!Number.isInteger(data.version) || data.version < 1)) throw new TypeError("Data version must be a positive whole number.");
  const normalized = { version: data.version || 1 };
  for (const key of [...REQUIRED_KEYS, ...FITNESS_KEYS]) {
    // Fitness lists are optional so data files created before the Fitness tab still load.
    if (data[key] === undefined && FITNESS_KEYS.includes(key)) {
      normalized[key] = [];
      continue;
    }
    if (!Array.isArray(data[key])) throw new TypeError(`Data field "${key}" must be an array.`);
    normalized[key] = data[key].map((item, index) => {
      if (!item || typeof item !== "object" || typeof item.id !== "string" || !item.id) {
        throw new TypeError(`Every item in "${key}" must have a non-empty id.`);
      }
      validateItem(key, item);
      if (key === "goals") {
        const order = item.order === undefined ? index : item.order;
        if (!Number.isInteger(order) || order < 0) throw new TypeError("Habit order must be a non-negative whole number.");
        return { ...item, order };
      }
      return { ...item };
    });
  }
  validateUniqueCompletions(normalized.completions);
  return normalized;
}

function validateItem(key, item) {
  if (key === "goals" || key === "rewards") {
    if (typeof item.name !== "string" || !item.name.trim()) throw new TypeError(`Every ${key.slice(0, -1)} must have a name.`);
    const value = key === "goals" ? item.points : item.cost;
    if (!Number.isFinite(value) || value < 0) throw new TypeError(`Every ${key.slice(0, -1)} must have a non-negative numeric value.`);
    if (key === "goals" && !Number.isInteger(value)) throw new TypeError("Habit points must be whole numbers.");
    if (typeof item.emoji !== "string") throw new TypeError(`Every ${key.slice(0, -1)} must have a text emoji field.`);
    if (key === "goals" && !GOAL_COLORS.includes(item.color)) throw new TypeError("Habit colors must use one of the supported color choices.");
    if (key === "rewards" && typeof item.repeatable !== "boolean") throw new TypeError("Every reward must specify whether it is repeatable.");
    if (key === "goals") validateSubgoals(item.subgoals);
  }
  if (key === "completions") {
    if (!isValidDateString(item.date) || typeof item.goalId !== "string" || !item.goalId || !Number.isFinite(item.points) || item.points < 0) {
      throw new TypeError("Each completion must have a valid local date, goal id, and non-negative points value.");
    }
    if (item.subgoalIds !== undefined && (!Array.isArray(item.subgoalIds) || item.subgoalIds.some((id) => typeof id !== "string" || !id))) {
      throw new TypeError("Completion sub-options must be a list of ids.");
    }
  }
  if (key === "purchases") {
    if (!isValidDateString(item.date) || typeof item.rewardId !== "string" || !item.rewardId || typeof item.rewardName !== "string" || !Number.isFinite(item.cost) || item.cost < 0) {
      throw new TypeError("Each purchase must have a valid local date, reward id, name, and non-negative cost.");
    }
  }
  if (key === "exercises") validateExercise(item);
  if (key === "workouts") validateWorkout(item);
  if (key === "workoutLogs") validateWorkoutLog(item);
}

function validateSubgoals(subgoals) {
  if (subgoals === undefined) return;
  if (!Array.isArray(subgoals)) throw new TypeError("Habit sub-options must be a list.");
  const seen = new Set();
  for (const sub of subgoals) {
    if (!sub || typeof sub !== "object" || typeof sub.id !== "string" || !sub.id) throw new TypeError("Every sub-option must have an id.");
    if (typeof sub.name !== "string" || !sub.name.trim()) throw new TypeError("Every sub-option must have a name.");
    if (seen.has(sub.id)) throw new TypeError("Sub-option ids must be unique within a habit.");
    seen.add(sub.id);
  }
}

function validateExercise(item) {
  if (typeof item.name !== "string" || !item.name.trim()) throw new TypeError("Every exercise must have a name.");
  if (!EXERCISE_KINDS.includes(item.kind)) throw new TypeError("Every exercise must have a supported type.");
}

function validateWorkout(item) {
  if (typeof item.name !== "string" || !item.name.trim()) throw new TypeError("Every workout must have a name.");
  if (!Array.isArray(item.items)) throw new TypeError("Every workout must have a list of exercises.");
  for (const entry of item.items) {
    if (!entry || typeof entry.exerciseId !== "string" || !entry.exerciseId) throw new TypeError("Every workout exercise must reference an exercise id.");
    for (const field of ["setsMin", "setsMax", "targetMin", "targetMax"]) {
      if (entry[field] !== undefined && (!Number.isFinite(entry[field]) || entry[field] < 0)) throw new TypeError("Workout targets must be non-negative numbers.");
    }
  }
  if (item.order !== undefined && (!Number.isInteger(item.order) || item.order < 0)) throw new TypeError("Workout order must be a non-negative whole number.");
}

function validateWorkoutLog(item) {
  if (!isValidDateString(item.date)) throw new TypeError("Each workout log must have a valid local date.");
  if (!Array.isArray(item.entries)) throw new TypeError("Each workout log must have a list of exercise entries.");
  for (const entry of item.entries) {
    if (!entry || typeof entry.exerciseId !== "string" || !entry.exerciseId || !Array.isArray(entry.sets)) {
      throw new TypeError("Each workout log entry must have an exercise id and a list of sets.");
    }
    for (const set of entry.sets) {
      if (!set || typeof set !== "object") throw new TypeError("Each logged set must be an object.");
      for (const field of SET_FIELDS) {
        if (set[field] !== undefined && (!Number.isFinite(set[field]) || set[field] < 0)) throw new TypeError("Logged set values must be non-negative numbers.");
      }
    }
  }
}

export function validateUniqueCompletions(completions) {
  const seen = new Set();
  for (const item of completions) {
    if (item.deleted) continue;
    const key = `${item.date}\u0000${item.goalId}`;
    if (seen.has(key)) throw new TypeError("Data contains more than one active completion for the same goal and date.");
    seen.add(key);
  }
}

export function readConfig() {
  const raw = localStorage.getItem(CONFIG_KEY);
  if (!raw) return { owner: "", repo: "", path: "data.json", token: "" };
  try {
    const value = JSON.parse(raw);
    return {
      owner: typeof value.owner === "string" ? value.owner : "",
      repo: typeof value.repo === "string" ? value.repo : "",
      path: typeof value.path === "string" ? value.path : "data.json",
      token: typeof value.token === "string" ? value.token : ""
    };
  } catch (error) {
    throw new Error("Saved sync settings could not be read. Replace the settings in the Settings screen.", { cause: error });
  }
}

export function saveConfig(config) {
  const { owner, repo, path, token } = config;
  localStorage.setItem(CONFIG_KEY, JSON.stringify({ owner, repo, path, token }));
}

export function makeId() {
  if (!globalThis.crypto?.randomUUID) throw new Error("This browser does not support secure random IDs. Please update your browser.");
  return crypto.randomUUID();
}

export function timestamp() {
  return new Date().toISOString();
}

export function today() {
  return localDateString();
}
