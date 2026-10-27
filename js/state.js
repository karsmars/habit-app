import { localDateString } from "./dates.js";
import { isValidDateString } from "./dates.js";
import { GOAL_COLORS } from "./themes.js";

export const DATA_KEY = "habit-data-cache";
export const CONFIG_KEY = "habit-github-config";

export function emptyData() {
  return { version: 1, goals: [], completions: [], rewards: [], purchases: [] };
}

export function exampleData() {
  const now = new Date().toISOString();
  const goals = [
    ["Exercise", "🏃", 10, "#E5484D"],
    ["Read 20 minutes", "📚", 5, "#3E63DD"],
    ["Drink water", "💧", 3, "#12A594"],
    ["No phone before bed", "🌙", 5, "#8E4EC6"]
  ].map(([name, emoji, points, color], index) => ({
    id: crypto.randomUUID(), name, emoji, points, color,
    archived: false, deleted: false, createdAt: now, updatedAt: now, order: index
  }));
  const rewards = [
    ["Coffee treat", "☕", 25, true],
    ["Movie night", "🎬", 75, true],
    ["New book", "📖", 150, false]
  ].map(([name, emoji, cost, repeatable]) => ({
    id: crypto.randomUUID(), name, emoji, cost, repeatable,
    archived: false, deleted: false, createdAt: now, updatedAt: now
  }));
  return { version: 1, goals, completions: [], rewards, purchases: [] };
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
  for (const key of ["goals", "completions", "rewards", "purchases"]) {
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
  }
  if (key === "completions") {
    if (!isValidDateString(item.date) || typeof item.goalId !== "string" || !item.goalId || !Number.isFinite(item.points) || item.points < 0) {
      throw new TypeError("Each completion must have a valid local date, goal id, and non-negative points value.");
    }
  }
  if (key === "purchases") {
    if (!isValidDateString(item.date) || typeof item.rewardId !== "string" || !item.rewardId || typeof item.rewardName !== "string" || !Number.isFinite(item.cost) || item.cost < 0) {
      throw new TypeError("Each purchase must have a valid local date, reward id, name, and non-negative cost.");
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
  if (!raw) return { owner: "karsmars", repo: "habit-data", path: "data.json", token: "" };
  try {
    const value = JSON.parse(raw);
    return {
      owner: typeof value.owner === "string" ? value.owner : "karsmars",
      repo: typeof value.repo === "string" ? value.repo : "habit-data",
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
