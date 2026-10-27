import test from "node:test";
import assert from "node:assert/strict";
import { heatLevel } from "../js/ui-calendar.js";

test("calendar shades scale to the highest points total in the month", () => {
  assert.deepEqual([1, 2, 3].map((points) => heatLevel(points, 3)), [2, 3, 4]);
  assert.equal(heatLevel(0, 3), 0);
  assert.equal(heatLevel(3, 3), 4);
});

test("calendar shading uses the strongest level when all points are equal", () => {
  assert.equal(heatLevel(1, 1), 4);
});
