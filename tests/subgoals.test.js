import test from "node:test";
import assert from "node:assert/strict";
import { mergeData } from "../js/merge.js";
import { normalizeData } from "../js/state.js";
import { completionRate, dayPoints, goalStreak, pointsByDate, pointsForGoal } from "../js/points.js";
import { daysDone, filterableSubgoals, goalSubgoals, matchesFilter, toggleSubId } from "../js/subgoals.js";

const practice = {
  id: "g1", name: "Practice", emoji: "🎯", points: 1, color: "#3E63DD", order: 0,
  subgoals: [
    { id: "s-guitar", name: "Guitar" },
    { id: "s-chinese", name: "Chinese" },
    { id: "s-old", name: "Old", archived: true }
  ]
};
const base = { version: 1, goals: [practice], completions: [], rewards: [], purchases: [] };
const withCompletions = (completions) => normalizeData({ ...base, completions });

test("sub-options never add points: one completion per day earns the habit's points once", () => {
  const data = withCompletions([
    { id: "c1", goalId: "g1", date: "2026-03-01", points: 1, subgoalIds: ["s-chinese", "s-guitar"] }
  ]);
  assert.equal(dayPoints(data, "2026-03-01"), 1);
  assert.equal(pointsForGoal(data, "g1", "2026-03-01"), 1);
});

test("a second active completion for the same habit and day is still rejected", () => {
  assert.throws(() => withCompletions([
    { id: "c1", goalId: "g1", date: "2026-03-01", points: 1, subgoalIds: ["s-guitar"] },
    { id: "c2", goalId: "g1", date: "2026-03-01", points: 1, subgoalIds: ["s-chinese"] }
  ]), /more than one active completion/);
});

test("filters by sub-option for points, streaks, rates, and chart data", () => {
  const data = withCompletions([
    { id: "c1", goalId: "g1", date: "2026-03-01", points: 1, subgoalIds: ["s-guitar"] },
    { id: "c2", goalId: "g1", date: "2026-03-02", points: 1, subgoalIds: ["s-guitar", "s-chinese"] },
    { id: "c3", goalId: "g1", date: "2026-03-03", points: 1, subgoalIds: ["s-chinese"] },
    { id: "c4", goalId: "g1", date: "2026-03-04", points: 1 }
  ]);
  assert.equal(pointsForGoal(data, "g1", "2026-03-03", "s-guitar"), 0);
  assert.equal(pointsForGoal(data, "g1", "2026-03-03", "s-chinese"), 1);
  assert.equal(goalStreak(data, "g1", "2026-03-02", "s-guitar"), 2);
  assert.equal(goalStreak(data, "g1", "2026-03-04"), 4);
  assert.equal(completionRate(data, "g1", "2026-03-04", 4, "s-chinese"), 50);
  assert.deepEqual(pointsByDate(data, ["2026-03-01", "2026-03-03"], { goalId: "g1", subId: "s-guitar" }).map(({ points }) => points), [1, 0]);
  assert.equal(daysDone(data, "g1", "s-guitar", "2026-03-01", "2026-03-31"), 2);
  assert.equal(daysDone(data, "g1", null, "2026-03-01", "2026-03-31"), 4);
  assert.equal(matchesFilter(data.completions[3], "g1", "s-guitar"), false);
});

test("archived sub-options are hidden from lists but kept in filters while they have history", () => {
  const data = withCompletions([{ id: "c1", goalId: "g1", date: "2026-03-01", points: 1, subgoalIds: ["s-old"] }]);
  assert.deepEqual(goalSubgoals(practice).map(({ id }) => id), ["s-guitar", "s-chinese"]);
  assert.deepEqual(filterableSubgoals(data, practice).map(({ id }) => id), ["s-guitar", "s-chinese", "s-old"]);
  assert.deepEqual(filterableSubgoals(withCompletions([]), practice).map(({ id }) => id), ["s-guitar", "s-chinese"]);
});

test("toggleSubId adds and removes ids in sorted order", () => {
  assert.deepEqual(toggleSubId(["b"], "a"), ["a", "b"]);
  assert.deepEqual(toggleSubId(["a", "b"], "a"), ["b"]);
});

test("validation rejects malformed sub-options", () => {
  const bad = (subgoals) => () => normalizeData({ ...base, goals: [{ ...practice, subgoals }] });
  assert.throws(bad("nope"), /sub-options must be a list/);
  assert.throws(bad([{ id: "x", name: " " }]), /must have a name/);
  assert.throws(bad([{ id: "x", name: "A" }, { id: "x", name: "B" }]), /unique/);
  assert.throws(() => withCompletions([{ id: "c1", goalId: "g1", date: "2026-03-01", points: 1, subgoalIds: [1] }]), /list of ids/);
});

test("goals without sub-options are unchanged by normalization", () => {
  const goal = { id: "g2", name: "Read", emoji: "", points: 2, color: "#3E63DD", order: 0 };
  assert.deepEqual(normalizeData({ ...base, goals: [goal] }).goals[0], goal);
});

test("merging two devices that ticked different sub-options on the same day keeps both ticks", () => {
  const phone = { ...base, completions: [{ id: "c-phone", goalId: "g1", date: "2026-03-01", points: 1, subgoalIds: ["s-guitar"], updatedAt: "2026-03-01T10:00:00Z" }] };
  const laptop = { ...base, completions: [{ id: "c-laptop", goalId: "g1", date: "2026-03-01", points: 1, subgoalIds: ["s-chinese"], updatedAt: "2026-03-01T11:00:00Z" }] };
  const merged = mergeData(phone, laptop);
  const active = merged.completions.filter(({ deleted }) => !deleted);
  assert.equal(active.length, 1);
  assert.equal(active[0].id, "c-laptop");
  assert.deepEqual(active[0].subgoalIds, ["s-chinese", "s-guitar"]);
  const byId = (list) => [...list].sort((a, b) => a.id.localeCompare(b.id));
  assert.deepEqual(byId(mergeData(laptop, phone).completions), byId(merged.completions));
  assert.equal(dayPoints(normalizeData(merged), "2026-03-01"), 1);
});

test("un-ticking a sub-option on one device is not undone by merging an older copy of the same completion", () => {
  const older = { ...base, completions: [{ id: "c1", goalId: "g1", date: "2026-03-01", points: 1, subgoalIds: ["s-chinese", "s-guitar"], updatedAt: "2026-03-01T10:00:00Z" }] };
  const newer = { ...base, completions: [{ id: "c1", goalId: "g1", date: "2026-03-01", points: 1, subgoalIds: ["s-guitar"], updatedAt: "2026-03-01T12:00:00Z" }] };
  assert.deepEqual(mergeData(older, newer).completions[0].subgoalIds, ["s-guitar"]);
});
