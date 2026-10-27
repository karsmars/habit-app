import test from "node:test";
import assert from "node:assert/strict";
import { GitHubStorage } from "../js/storage-github.js";

function encodedContent(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64");
}

function githubFile(data, sha) {
  return new Response(JSON.stringify({ content: encodedContent(data), sha }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

test("GitHub Contents API round-trips UTF-8 names and retries a conflicting write", async () => {
  const remoteOne = {
    version: 1,
    goals: [{ id: "g1", name: "Coffee ☕", emoji: "☕", points: 2, color: "#E5484D", order: 0, updatedAt: "2026-01-01T00:00:00Z" }],
    completions: [],
    rewards: [],
    purchases: []
  };
  const remoteTwo = {
    ...remoteOne,
    rewards: [{ id: "r1", name: "映画 night 🎬", emoji: "🎬", cost: 5, repeatable: true, updatedAt: "2026-01-02T00:00:00Z" }]
  };
  const responses = [
    githubFile(remoteOne, "sha-one"),
    new Response(JSON.stringify({ message: "conflict" }), { status: 409 }),
    githubFile(remoteTwo, "sha-two"),
    new Response(JSON.stringify({ content: { sha: "sha-three" } }), { status: 200 })
  ];
  const originalFetch = globalThis.fetch;
  const originalNavigator = globalThis.navigator;
  const putBodies = [];
  globalThis.navigator = { onLine: true };
  globalThis.fetch = async (_url, options) => {
    if (options.method === "PUT") putBodies.push(JSON.parse(options.body));
    const response = responses.shift();
    assert.ok(response, "unexpected GitHub request");
    return response;
  };
  try {
    const storage = new GitHubStorage({ owner: "owner", repo: "data", path: "data.json", token: "test-token" });
    const result = await storage.sync({
      version: 1,
      goals: [{ id: "g2", name: "Read 📖", emoji: "📖", points: 3, color: "#3E63DD", order: 1, updatedAt: "2026-01-03T00:00:00Z" }],
      completions: [],
      rewards: [],
      purchases: []
    });
    assert.equal(result.data.goals.some(({ name }) => name === "Coffee ☕"), true);
    assert.equal(result.data.goals.some(({ name }) => name === "Read 📖"), true);
    assert.equal(result.data.rewards[0].name, "映画 night 🎬");
    assert.equal(putBodies.length, 2);
    assert.equal(putBodies[0].sha, "sha-one");
    assert.equal(putBodies[1].sha, "sha-two");
    assert.equal(responses.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalNavigator === undefined) delete globalThis.navigator;
    else globalThis.navigator = originalNavigator;
  }
});
