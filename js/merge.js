export function mergeData(local, remote) {
  if (!local || !remote) throw new TypeError("Both local and remote data are required for merging.");
  const completions = mergeEntities(local.completions, remote.completions, false);
  const latestCompletionByDateAndGoal = new Map();
  for (const item of completions) {
    if (item.deleted) continue;
    const key = `${item.date}\u0000${item.goalId}`;
    const previous = latestCompletionByDateAndGoal.get(key);
    if (!previous || timestamp(item) > timestamp(previous)
      || (timestamp(item) === timestamp(previous) && item.id.localeCompare(previous.id) > 0)) {
      latestCompletionByDateAndGoal.set(key, item);
    }
  }
  const activeIds = new Set([...latestCompletionByDateAndGoal.values()].map(({ id }) => id));
  return {
    version: Math.max(Number(local.version) || 1, Number(remote.version) || 1),
    goals: mergeEntities(local.goals, remote.goals, true).sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id)),
    completions: completions.map((item) => item.deleted || activeIds.has(item.id)
      ? item
      : { ...item, deleted: true }),
    rewards: mergeEntities(local.rewards, remote.rewards, true),
    purchases: mergeEntities(local.purchases, remote.purchases, false)
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
  const leftValue = JSON.stringify(left, Object.keys(left).sort());
  const rightValue = JSON.stringify(right, Object.keys(right).sort());
  return leftValue.localeCompare(rightValue);
}

function timestamp(item) {
  const value = Date.parse(item.updatedAt);
  return Number.isFinite(value) ? value : 0;
}
