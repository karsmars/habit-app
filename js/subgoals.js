// Helpers for habits with sub-options (e.g. "Practice" → Guitar, Chinese, Game dev).
// A habit still has at most ONE completion per day, so points never exceed the habit's value.
// The completion records which sub-options were done in `subgoalIds`.

export const MAX_SUBGOALS = 12;

export function goalSubgoals(goal, { includeArchived = false } = {}) {
  const list = Array.isArray(goal?.subgoals) ? goal.subgoals : [];
  return includeArchived ? list : list.filter((sub) => !sub.archived);
}

export function hasSubgoals(goal) {
  return goalSubgoals(goal).length > 0;
}

export function completionSubIds(completion) {
  return Array.isArray(completion?.subgoalIds) ? completion.subgoalIds : [];
}

// True when a completion belongs to the goal and (if given) includes the sub-option.
export function matchesFilter(completion, goalId, subId = null) {
  if (!goalId || completion.goalId !== goalId) return false;
  return !subId || completionSubIds(completion).includes(subId);
}

export function sortedUnique(ids) {
  return [...new Set(ids)].sort();
}

// Toggles one sub-option in a list; result is sorted so merges are deterministic.
export function toggleSubId(ids, subId) {
  return ids.includes(subId) ? ids.filter((id) => id !== subId) : sortedUnique([...ids, subId]);
}

// Sub-options referenced by any active completion of the goal (used to keep history visible after archiving).
export function usedSubIds(data, goalId) {
  const used = new Set();
  for (const item of data.completions) {
    if (item.goalId === goalId && !item.deleted) completionSubIds(item).forEach((id) => used.add(id));
  }
  return used;
}

// Sub-options to offer in filters: active ones, plus archived ones that still have history.
export function filterableSubgoals(data, goal) {
  const used = usedSubIds(data, goal.id);
  return goalSubgoals(goal, { includeArchived: true }).filter((sub) => !sub.archived || used.has(sub.id));
}

// Number of distinct days in [start, end] where the sub-option (or goal, if subId is null) was done.
export function daysDone(data, goalId, subId, start, end) {
  const dates = new Set();
  for (const item of data.completions) {
    if (!item.deleted && item.date >= start && item.date <= end && matchesFilter(item, goalId, subId)) dates.add(item.date);
  }
  return dates.size;
}
