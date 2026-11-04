import test from "node:test";
import assert from "node:assert/strict";
import { mergeData } from "../js/merge.js";
import { normalizeData } from "../js/state.js";
import {
  detectPRs, estimateOneRepMax, formatMetric, formatPace, niceScale, roundWeight, suggestSet, formatSet, formatSets, formatTarget, metricsFor, personalRecords, progressionHint,
  recordSessionIds, sessionsFor, lastSession
} from "../js/fitness.js";

const base = { version: 1, goals: [], completions: [], rewards: [], purchases: [] };
const squat = { id: "e-squat", name: "Squat", kind: "weight", unit: "lb" };
const plank = { id: "e-plank", name: "Plank", kind: "time", unit: "" };
const pullup = { id: "e-pull", name: "Pull-up", kind: "bodyweight", unit: "lb" };
const run = { id: "e-run", name: "Run", kind: "cardio", unit: "mi" };

const log = (id, date, exerciseId, sets, extra = {}) => ({
  id, date, workoutId: "w1", name: "Workout 1", entries: [{ exerciseId: exerciseId, sets }], deleted: false, updatedAt: `${date}T10:00:00Z`, ...extra
});
const dataWith = (workoutLogs, exercises = [squat, plank, pullup, run]) => normalizeData({ ...base, exercises, workoutLogs });

test("targets format like the written program, including ranges and timed holds", () => {
  assert.equal(formatTarget({ setsMin: 3, setsMax: 3, targetMin: 6, targetMax: 10 }, "weight"), "3 × 6–10");
  assert.equal(formatTarget({ setsMin: 2, setsMax: 3, targetMin: 8, targetMax: 10 }, "weight"), "2–3 × 8–10");
  assert.equal(formatTarget({ setsMin: 3, setsMax: 3, targetMin: 30, targetMax: 60 }, "time"), "3 × 30–60s");
  assert.equal(formatTarget({}, "time"), "");
  assert.equal(formatTarget({ setsMax: 3 }, "time"), "3 sets");
});

test("sets format per exercise type", () => {
  assert.equal(formatSet({ weight: 135, reps: 8 }, "weight", "lb"), "135 × 8");
  assert.equal(formatSet({ reps: 8, weight: 25 }, "bodyweight", "lb"), "8 reps +25 lb");
  assert.equal(formatSet({ reps: 10 }, "bodyweight", "lb"), "10 reps");
  assert.equal(formatSet({ seconds: 45 }, "time"), "45s");
  assert.equal(formatSet({ distance: 3.1, minutes: 28 }, "cardio", "mi"), "3.1 mi · 28 min");
  assert.equal(formatSets([{ weight: 135, reps: 8 }, { weight: 135, reps: 7 }], "weight", "lb"), "135 × 8, 135 × 7");
});

test("estimated one-rep max uses Epley and ignores incomplete sets", () => {
  assert.equal(estimateOneRepMax(100, 1), 100);
  assert.equal(Math.round(estimateOneRepMax(100, 10)), 133);
  assert.equal(estimateOneRepMax(0, 5), null);
  assert.equal(estimateOneRepMax(100, 0), null);
});

test("weight metrics summarise a session: top weight, estimated 1RM and volume", () => {
  const sets = [{ weight: 135, reps: 8 }, { weight: 145, reps: 6 }, { weight: 145, reps: 5 }];
  const [top, oneRepMax, volume] = metricsFor("weight");
  assert.equal(top.value(sets), 145);
  assert.equal(Math.round(oneRepMax.value(sets)), 174);
  assert.equal(volume.value(sets), 135 * 8 + 145 * 6 + 145 * 5);
  assert.equal(top.value([]), null);
});

test("timed, bodyweight and cardio metrics", () => {
  assert.equal(metricsFor("time")[0].value([{ seconds: 40 }, { seconds: 55 }]), 55);
  assert.equal(metricsFor("time")[1].value([{ seconds: 40 }, { seconds: 55 }]), 95);
  assert.equal(metricsFor("bodyweight")[0].value([{ reps: 6 }, { reps: 9 }]), 9);
  assert.equal(metricsFor("bodyweight")[2].value([{ reps: 6 }]), null);
  const pace = metricsFor("cardio")[2];
  assert.equal(pace.value([{ distance: 3, minutes: 30 }]), 10);
  assert.equal(pace.value([{ distance: 3 }]), null);
});

test("sessions are listed oldest first and personal records track the best session", () => {
  const data = dataWith([
    log("l2", "2026-03-08", "e-squat", [{ weight: 145, reps: 6 }]),
    log("l1", "2026-03-01", "e-squat", [{ weight: 135, reps: 8 }]),
    log("l3", "2026-03-15", "e-squat", [{ weight: 140, reps: 8 }]),
    log("gone", "2026-03-20", "e-squat", [{ weight: 300, reps: 1 }], { deleted: true })
  ]);
  assert.deepEqual(sessionsFor(data, "e-squat").map(({ logId }) => logId), ["l1", "l2", "l3"]);
  const [top] = personalRecords(data, squat);
  assert.equal(top.value, 145);
  assert.equal(top.date, "2026-03-08");
  assert.deepEqual([...recordSessionIds(sessionsFor(data, "e-squat"), metricsFor("weight")[0])], ["l2"]);
  assert.equal(lastSession(data, "e-squat", { beforeDate: "2026-03-10" }).logId, "l2");
  assert.equal(lastSession(data, "e-squat", { excludeLogId: "l3" }).logId, "l2");
});

test("detectPRs flags a beaten record but not a first session or a lighter one", () => {
  const first = log("l1", "2026-03-01", "e-squat", [{ weight: 135, reps: 8 }]);
  assert.deepEqual(detectPRs(dataWith([first]), first), []);
  const heavier = log("l2", "2026-03-08", "e-squat", [{ weight: 145, reps: 6 }]);
  const prs = detectPRs(dataWith([first, heavier]), heavier);
  assert.deepEqual(prs.map(({ metric }) => metric.id), ["topWeight", "oneRepMax"]);
  const lighter = log("l3", "2026-03-15", "e-squat", [{ weight: 125, reps: 8 }]);
  assert.deepEqual(detectPRs(dataWith([first, heavier, lighter]), lighter), []);
});

test("a faster pace is a record for cardio", () => {
  const slow = log("r1", "2026-03-01", "e-run", [{ distance: 3, minutes: 33 }]);
  const fast = log("r2", "2026-03-08", "e-run", [{ distance: 3, minutes: 30 }]);
  assert.ok(detectPRs(dataWith([slow, fast]), fast).some(({ metric }) => metric.id === "pace"));
});

test("progression hint appears once every set reaches the top of the rep range", () => {
  const item = { setsMin: 3, setsMax: 3, targetMin: 6, targetMax: 10 };
  assert.match(progressionHint([{ reps: 10 }, { reps: 10 }, { reps: 11 }], item, "weight"), /adding weight/);
  assert.equal(progressionHint([{ reps: 10 }, { reps: 9 }, { reps: 10 }], item, "weight"), null);
  assert.equal(progressionHint([{ reps: 10 }, { reps: 10 }], item, "weight"), null);
  assert.equal(progressionHint([{ seconds: 60 }], { targetMax: 60 }, "time"), null);
});

test("the sample two-day program validates and round-trips through normalization", () => {
  const exercises = ["Squat", "Bench", "One-arm row", "Pull-up/pulldown", "Plank", "RDL", "Overhead press"].map((name, index) => ({
    id: `e${index}`, name, kind: name === "Plank" ? "time" : "weight", unit: name === "Plank" ? "" : "lb", archived: false, deleted: false, createdAt: "t", updatedAt: "t"
  }));
  const item = (exerciseId, setsMin, setsMax, targetMin, targetMax) => ({ exerciseId, setsMin, setsMax, targetMin, targetMax });
  const workouts = [
    { id: "w1", name: "Workout 1", order: 0, items: [item("e0", 3, 3, 6, 10), item("e1", 3, 3, 6, 10), item("e2", 3, 3, 8, 12), item("e3", 2, 3, 6, 10), item("e4", 2, 3, 30, 60)], updatedAt: "t" },
    { id: "w2", name: "Workout 2", order: 1, items: [item("e0", 2, 3, 8, 10), item("e5", 2, 3, 8, 10), item("e6", 3, 3, 6, 10), item("e3", 3, 3, 6, 12), item("e4", 2, 3, 30, 60)], updatedAt: "t" }
  ];
  const data = normalizeData({ ...base, exercises, workouts, workoutLogs: [] });
  assert.equal(data.workouts.length, 2);
  assert.equal(formatTarget(data.workouts[0].items[3], "weight"), "2–3 × 6–10");
});

test("validation rejects malformed fitness data", () => {
  const bad = (extra) => () => normalizeData({ ...base, ...extra });
  assert.throws(bad({ exercises: [{ id: "x", name: "A", kind: "magic" }] }), /supported type/);
  assert.throws(bad({ exercises: [{ id: "x", name: "", kind: "weight" }] }), /must have a name/);
  assert.throws(bad({ workouts: [{ id: "w", name: "A", items: "nope" }] }), /list of exercises/);
  assert.throws(bad({ workouts: [{ id: "w", name: "A", items: [{ exerciseId: "x", targetMin: -1 }] }] }), /non-negative/);
  assert.throws(bad({ workoutLogs: [{ id: "l", date: "nope", entries: [] }] }), /valid local date/);
  assert.throws(bad({ workoutLogs: [{ id: "l", date: "2026-03-01", entries: [{ exerciseId: "e", sets: [{ weight: -5 }] }] }] }), /non-negative/);
  assert.throws(bad({ workoutLogs: [{ id: "l", date: "2026-03-01", entries: [{ exerciseId: "e", sets: [{ weight: "heavy" }] }] }] }), /non-negative/);
});

test("merging restores fitness data that a device running an older version dropped", () => {
  const withFitness = dataWith([log("l1", "2026-03-01", "e-squat", [{ weight: 135, reps: 8 }])]);
  const staleClient = normalizeData({ ...base });
  const merged = mergeData(staleClient, withFitness);
  assert.equal(merged.workoutLogs.length, 1);
  assert.equal(merged.exercises.length, 4);
  assert.deepEqual(mergeData(withFitness, staleClient).workoutLogs, merged.workoutLogs);
});

test("the newest edit of a workout log wins and a deletion is kept", () => {
  const older = dataWith([log("l1", "2026-03-01", "e-squat", [{ weight: 135, reps: 8 }])]);
  const newer = dataWith([log("l1", "2026-03-01", "e-squat", [{ weight: 140, reps: 8 }], { updatedAt: "2026-03-02T10:00:00Z" })]);
  assert.equal(mergeData(older, newer).workoutLogs[0].entries[0].sets[0].weight, 140);
  const deleted = dataWith([log("l1", "2026-03-01", "e-squat", [{ weight: 140, reps: 8 }], { deleted: true, updatedAt: "2026-03-03T10:00:00Z" })]);
  assert.equal(mergeData(newer, deleted).workoutLogs[0].deleted, true);
});

test("equal-timestamp workout edits merge the same way in both directions", () => {
  const a = dataWith([log("l1", "2026-03-01", "e-squat", [{ weight: 135, reps: 8 }])]);
  const b = dataWith([log("l1", "2026-03-01", "e-squat", [{ weight: 140, reps: 8 }])]);
  assert.deepEqual(mergeData(a, b).workoutLogs, mergeData(b, a).workoutLogs);
});

test("chart axes use round tick values that cover the data", () => {
  const scale = niceScale(135, 145);
  assert.ok(scale.lo <= 135 && scale.hi >= 145);
  assert.ok(scale.ticks.every((tick) => Number.isInteger(tick * 2)));
  const flat = niceScale(50, 50);
  assert.ok(flat.lo < 50 && flat.hi > 50);
  assert.ok(niceScale(0.5, 2).lo >= 0);
});

test("pace shows as minutes:seconds per unit", () => {
  assert.equal(formatPace(9.9), "9:54");
  assert.equal(formatPace(10), "10:00");
  const pace = metricsFor("cardio")[2];
  assert.equal(formatMetric(9.9, pace, run), "9:54 /mi");
});

test("weights round to plate-friendly steps", () => {
  assert.equal(roundWeight(137, "lb"), 135);
  assert.equal(roundWeight(138, "lb"), 140);
  assert.equal(roundWeight(61, "kg"), 60);
  assert.equal(roundWeight(63.5, "kg"), 62.5);
  assert.equal(roundWeight(1, "lb"), 5);
});

test("prefill uses 80% of the last estimated 1RM, rounded, with reps inside the target range", () => {
  const last = [{ weight: 135, reps: 10 }, { weight: 135, reps: 9 }, { weight: 135, reps: 8 }];
  const result = suggestSet("weight", "lb", last, { targetMin: 6, targetMax: 10 });
  assert.equal(result.source, "e1rm");
  assert.equal(Math.round(result.e1rm), 180);
  assert.deepEqual(result.set, { weight: 145, reps: 8 });
  assert.deepEqual(suggestSet("weight", "lb", last, { targetMin: 10, targetMax: 12 }).set, { weight: 145, reps: 10 });
  assert.deepEqual(suggestSet("weight", "kg", [{ weight: 60, reps: 5 }], {}).set, { weight: 55, reps: 8 });
});

test("prefill falls back to last session, and never prefills an exercise with no history", () => {
  assert.deepEqual(suggestSet("weight", "lb", [{ weight: 100 }], { targetMin: 6 }), { set: { weight: 100 }, source: "last", e1rm: null });
  assert.deepEqual(suggestSet("weight", "lb", [], { targetMin: 6, targetMax: 10 }), { set: {}, source: null, e1rm: null });
  assert.deepEqual(suggestSet("weight", "lb", undefined, {}).set, {});
  assert.deepEqual(suggestSet("bodyweight", "lb", [{ reps: 9 }, { reps: 7 }], {}).set, { reps: 9 });
  assert.deepEqual(suggestSet("time", "", [{ seconds: 45 }], { targetMin: 30 }).set, { seconds: 45 });
  assert.deepEqual(suggestSet("time", "", [], { targetMin: 30 }).set, {});
  assert.deepEqual(suggestSet("cardio", "mi", [{ distance: 3, minutes: 30 }], {}).set, { distance: 3, minutes: 30 });
});
