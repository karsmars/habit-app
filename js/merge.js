import { completionSubIds, sortedUnique } from "./subgoals.js";

export function mergeData(local, remote) {
  if (!local || !remote) throw new TypeError("Both local and remote data are required for merging.");
  const completions = mergeEntities(local.completions, remote.completions, false);
  const groups = new Map();
  for (const item of completions) {
    if (item.deleted) continue;
    const key = `${item.date}\u0000${item.goalId}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  // Only one completion per goal and day may stay active. The newest wins, but when two devices
  // created separate completions the sub-options ticked on either device are kept on the winner.
  const winners = new Map();
  for (const group of groups.values()) {
    const winner = group.reduce((best, item) => timestamp(item) > timestamp(best)
      || (timestamp(item) === timestamp(best) && item.id.localeCompare(best.id) > 0) ? item : best);
    const subIds = group.length > 1 ? sortedUnique(group.flatMap(completionSubIds)) : null;
    winners.set(winner.id, subIds && subIds.length ? { ...winner, subgoalIds: subIds } : winner);
  }
  return {
    version: Math.max(Number(local.version) || 1, Number(remote.version) || 1),
    goals: mergeEntities(local.goals, remote.goals, true).sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id)),
    completions: completions.map((item) => item.deleted
      ? item
      : winners.get(item.id) || { ...item, deleted: true }),
    rewards: mergeEntities(local.rewards, remote.rewards, true),
    purchases: mergeEntities(local.purchases, remote.purchases, false),
    exercises: mergeEntities(local.exercises, remote.exercises, true),
    workouts: mergeEntities(local.workouts, remote.workouts, true),
    workoutLogs: mergeEntities(local.workoutLogs, remote.workoutLogs, true)
  };
}

function mergeEntities(localItems = [], remoteItems = [], newestWins = false) {
  const byId = new Map();
  for (const item of [...localItems, ...remoteItems]) {
    if (!item || typeof item.id !== "string" || !item.id) continue;
    const previous = byId.get(item.id);
    if (!previous || compareRevisions(item, previous) > 0 || (newestWins && compareRevisions(item, previous) === 0)) {
      byId.set(item.id, item);
    }
  }
  return [...byId.values()];
}

function compareRevisions(left, right) {
  const timeDifference = timestamp(left) - timestamp(right);
  if (timeDifference) return timeDifference;
  return canonical(left).localeCompare(canonical(right));
}

// Key-sorted JSON at every depth, so nested data (sub-options, workout sets) takes part in tie-breaks.
function canonical(value) {
  return JSON.stringify(value, (_key, nested) => nested && typeof nested === "object" && !Array.isArray(nested)
    ? Object.fromEntries(Object.keys(nested).sort().map((name) => [name, nested[name]]))
    : nested);
}

function timestamp(item) {
  const value = Date.parse(item.updatedAt);
  return Number.isFinite(value) ? value : 0;
}
