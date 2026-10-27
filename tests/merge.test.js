import test from "node:test";
import assert from "node:assert/strict";
import { mergeData } from "../js/merge.js";

const base = { version: 1, goals: [], completions: [], rewards: [], purchases: [] };

test("merge unions entries by id and newest goal/reward revision wins", () => {
  const local = {
    ...base,
    goals: [{ id: "g1", name: "Old", updatedAt: "2026-01-01T00:00:00Z" }],
    rewards: [{ id: "r1", name: "Treat", updatedAt: "2026-01-01T00:00:00Z" }],
    completions: [{ id: "c1", goalId: "g1", date: "2026-01-01", points: 5 }]
  };
  const remote = {
    ...base,
    goals: [{ id: "g1", name: "New", updatedAt: "2026-01-02T00:00:00Z" }],
    rewards: [{ id: "r1", name: "Reward", updatedAt: "2026-01-02T00:00:00Z" }],
    completions: [{ id: "c2", goalId: "g2", date: "2026-01-02", points: 3 }]
  };
  const merged = mergeData(local, remote);
  assert.equal(merged.goals.find(({ id }) => id === "g1").name, "New");
  assert.equal(merged.rewards.find(({ id }) => id === "r1").name, "Reward");
  assert.deepEqual(merged.completions.map(({ id }) => id).sort(), ["c1", "c2"]);
});

test("merge preserves soft deletions and resolves duplicate same-day completions", () => {
  const merged = mergeData({
    ...base,
    goals: [{ id: "g1", name: "Deleted", deleted: true, updatedAt: "2026-01-03T00:00:00Z" }],
    completions: [{ id: "c1", goalId: "g1", date: "2026-01-01", points: 5, updatedAt: "2026-01-01T00:00:00Z" }]
  }, {
    ...base,
    goals: [{ id: "g1", name: "Older", deleted: false, updatedAt: "2026-01-02T00:00:00Z" }],
    completions: [{ id: "c2", goalId: "g1", date: "2026-01-01", points: 6, updatedAt: "2026-01-02T00:00:00Z" }]
  });
  assert.equal(merged.goals[0].deleted, true);
  assert.equal(merged.completions.filter(({ deleted }) => !deleted).length, 1);
  assert.equal(merged.completions.find(({ id }) => id === "c2").deleted, undefined);
});

test("equal-timestamp conflicting revisions merge deterministically", () => {
  const first = {
    ...base,
    goals: [{ id: "g1", name: "Alpha", updatedAt: "2026-01-01T00:00:00Z", order: 0 }]
  };
  const second = {
    ...base,
    goals: [{ id: "g1", name: "Beta", updatedAt: "2026-01-01T00:00:00Z", order: 1 }]
  };
  assert.deepEqual(mergeData(first, second), mergeData(second, first));
});
