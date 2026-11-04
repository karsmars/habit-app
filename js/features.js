// Per-device feature switches (stored in this browser like the theme, not synced).
export const FITNESS_KEY = "habit-fitness-enabled";
export const UNITS_KEY = "habit-unit-system";

export function fitnessEnabled() {
  return localStorage.getItem(FITNESS_KEY) === "true";
}

export function setFitnessEnabled(enabled) {
  localStorage.setItem(FITNESS_KEY, enabled ? "true" : "false");
}

export function unitSystem() {
  return localStorage.getItem(UNITS_KEY) === "metric" ? "metric" : "imperial";
}

export function setUnitSystem(system) {
  localStorage.setItem(UNITS_KEY, system === "metric" ? "metric" : "imperial");
}
