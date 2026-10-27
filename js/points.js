import { addDays, localDateString, parseDate } from "./dates.js";

export function activeCompletions(data, date) {
  return data.completions.filter((item) => item.date === date && item.deleted !== true);
}

export function dayPoints(data, date) {
  return activeCompletions(data, date).reduce((sum, item) => sum + validPoints(item.points), 0);
}

export function earnedPoints(data) {
  return data.completions.reduce((sum, item) => sum + (item.deleted ? 0 : validPoints(item.points)), 0);
}

export function spentPoints(data) {
  return data.purchases.reduce((sum, item) => sum + (item.refunded ? 0 : validPoints(item.cost)), 0);
}

export function balance(data) {
  return earnedPoints(data) - spentPoints(data);
}

export function pointsForGoal(data, goalId, date) {
  return activeCompletions(data, date)
    .filter((item) => item.goalId === goalId)
    .reduce((sum, item) => sum + validPoints(item.points), 0);
}

export function hasGoalCompletion(data, goalId, date) {
  return data.completions.some((item) => item.goalId === goalId && item.date === date && !item.deleted);
}

export function streaks(data, today = localDateString()) {
  const activeDates = new Set(data.completions.filter((item) => !item.deleted).map((item) => item.date));
  const sorted = [...activeDates].filter((date) => parseDate(date)).sort();
  let best = 0;
  let run = 0;
  let previous = null;
  for (const date of sorted) {
    run = previous && addDays(previous, 1) === date ? run + 1 : 1;
    best = Math.max(best, run);
    previous = date;
  }
  const currentAnchor = activeDates.has(today) ? today : addDays(today, -1);
  let current = 0;
  let cursor = currentAnchor;
  while (activeDates.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }
  return { current, best };
}

export function goalStreak(data, goalId, today = localDateString()) {
  const dates = new Set(data.completions
    .filter((item) => item.goalId === goalId && !item.deleted)
    .map((item) => item.date));
  let cursor = dates.has(today) ? today : addDays(today, -1);
  let count = 0;
  while (dates.has(cursor)) {
    count += 1;
    cursor = addDays(cursor, -1);
  }
  return count;
}

export function pointsByDate(data, dates) {
  return dates.map((date) => ({ date, points: dayPoints(data, date) }));
}

export function completionRate(data, goalId, today = localDateString(), days = 30) {
  const start = addDays(today, -(days - 1));
  const completed = new Set(data.completions
    .filter((item) => item.goalId === goalId && !item.deleted && item.date >= start && item.date <= today)
    .map((item) => item.date)).size;
  return Math.round((completed / days) * 100);
}

function validPoints(value) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}
