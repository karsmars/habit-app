import test from "node:test";
import assert from "node:assert/strict";
import { normalizeData } from "../js/state.js";

test("legacy goal arrays receive order from their stored position", () => {
  const data = normalizeData({
    version: 1,
    goals: [
      { id: "g1", name: "First", emoji: "", points: 2, color: "#E5484D" },
      { id: "g2", name: "Second", emoji: "", points: 3, color: "#3E63DD" }
    ],
    completions: [],
    rewards: [],
    purchases: []
  });
  assert.deepEqual(data.goals.map(({ order }) => order), [0, 1]);
});

test("import validation rejects duplicate active completions and invalid goal order", () => {
  const data = {
    version: 1,
    goals: [{ id: "g1", name: "Read", emoji: "", points: 2, color: "#3E63DD", order: -1 }],
    completions: [],
    rewards: [],
    purchases: []
  };
  assert.throws(() => normalizeData(data), /Habit order/);
  data.goals[0].order = 0;
  data.completions = [
    { id: "c1", goalId: "g1", date: "2026-03-01", points: 2 },
    { id: "c2", goalId: "g1", date: "2026-03-01", points: 2 }
  ];
  assert.throws(() => normalizeData(data), /more than one active completion/);
});
