import test from "node:test";
import assert from "node:assert/strict";

function installStorage() {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key)
  };
}

test("the Fitness tab is off by default and the choice is remembered", async () => {
  installStorage();
  const { fitnessEnabled, setFitnessEnabled, setUnitSystem, unitSystem } = await import("../js/features.js");
  assert.equal(fitnessEnabled(), false);
  setFitnessEnabled(true);
  assert.equal(fitnessEnabled(), true);
  setFitnessEnabled(false);
  assert.equal(fitnessEnabled(), false);
  assert.equal(unitSystem(), "imperial");
  setUnitSystem("metric");
  assert.equal(unitSystem(), "metric");
  setUnitSystem("anything else");
  assert.equal(unitSystem(), "imperial");
});
