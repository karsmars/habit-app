import test from "node:test";
import assert from "node:assert/strict";
import { balance, completionRate, dayPoints, earnedPoints, goalStreak, pointsByDate, spentPoints, streaks } from "../js/points.js";

const data = {
  version: 1,
  goals: [],
  completions: [
    { id: "c1", goalId: "g1", date: "2026-03-01", points: 10, updatedAt: "2026-03-01T10:00:00Z" },
    { id: "c2", goalId: "g1", date: "2026-03-02", points: 5, updatedAt: "2026-03-02T10:00:00Z" },
    { id: "c3", goalId: "g2", date: "2026-03-02", points: 3, deleted: true },
    { id: "c4", goalId: "g1", date: "2026-03-04", points: 7 }
  ],
  rewards: [],
  purchases: [
    { id: "p1", cost: 8, refunded: false },
    { id: "p2", cost: 4, refunded: true }
  ]
};

test("points math excludes deleted completions and refunded purchases", () => {
  assert.equal(dayPoints(data, "2026-03-02"), 5);
  assert.equal(earnedPoints(data), 22);
  assert.equal(spentPoints(data), 8);
  assert.equal(balance(data), 14);
});

test("streaks calculate current and best consecutive local dates", () => {
  const consecutive = {
    ...data,
    completions: [
      { id: "a", date: "2026-03-01", goalId: "g1", points: 1 },
      { id: "b", date: "2026-03-02", goalId: "g2", points: 1 },
      { id: "c", date: "2026-03-03", goalId: "g2", points: 1 },
      { id: "d", date: "2026-03-05", goalId: "g1", points: 1 }
    ]
  };
  assert.deepEqual(streaks(consecutive, "2026-03-03"), { current: 3, best: 3 });
  assert.equal(goalStreak(consecutive, "g1", "2026-03-05"), 1);
  assert.deepEqual(streaks(consecutive, "2026-03-04"), { current: 3, best: 3 });
});

test("chart and completion rate aggregate expected dates", () => {
  assert.deepEqual(pointsByDate(data, ["2026-03-01", "2026-03-02"]), [
    { date: "2026-03-01", points: 10 },
    { date: "2026-03-02", points: 5 }
  ]);
  assert.equal(completionRate(data, "g1", "2026-03-04", 4), 75);
});
