import { mergeData } from "./merge.js";
import { emptyData, normalizeData } from "./state.js";

const API_ROOT = "https://api.github.com/repos";
const MAX_ATTEMPTS = 3;

export class GitHubStorage {
  constructor(config) {
    this.config = config;
    this.sha = null;
  }

  get configured() {
    return Boolean(this.config.owner && this.config.repo && this.config.path && this.config.token);
  }

  async testConnection() {
    const result = await this.fetchRemote();
    this.sha = result.sha;
    return result;
  }

  async fetchRemote() {
    this.assertConfigured();
    const response = await request(this.fileUrl(), { headers: this.headers() });
    const payload = await responsePayload(response);
    if (!response.ok) throw apiError(response, payload);
    if (typeof payload.content !== "string" || typeof payload.sha !== "string") {
      throw new Error("GitHub returned an unexpected file response. Check the configured file path.");
    }
    const text = decodeBase64(payload.content.replace(/\s/g, ""));
    let data = emptyData();
    if (text.trim()) {
      try {
        data = JSON.parse(text);
      } catch (error) {
        throw new Error("The data file in GitHub is not valid JSON. Your local copy has been kept.", { cause: error });
      }
    }
    try {
      data = normalizeData(data);
    } catch (error) {
      throw new Error(`The data file in GitHub has an invalid format: ${error.message}`, { cause: error });
    }
    this.sha = payload.sha;
    return { data, sha: payload.sha };
  }

  async sync(localData, onConflict) {
    this.assertConfigured();
    let data = localData;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      if (!this.sha) {
        const remote = await this.fetchRemote();
        data = mergeData(data, remote.data);
      }
      const response = await request(this.fileUrl(), {
        method: "PUT",
        headers: this.headers(),
        body: JSON.stringify({
          message: `habit-app: sync ${new Date().toISOString().slice(0, 16)}`,
          content: encodeBase64(JSON.stringify(data, null, 2)),
          sha: this.sha,
          branch: "main"
        })
      });
      const payload = await responsePayload(response);
      if (response.ok) {
        this.sha = payload.content?.sha || this.sha;
        return { data, sha: this.sha };
      }
      if (response.status !== 409 && response.status !== 422) throw apiError(response, payload);
      if (attempt === MAX_ATTEMPTS) {
        throw new Error("Sync conflict persisted after 3 attempts. Your local changes are safe and will remain queued.");
      }
      const remote = await this.fetchRemote();
      data = mergeData(data, remote.data);
      if (onConflict) onConflict(data);
    }
    throw new Error("Sync failed after retrying. Your local changes are safe and will remain queued.");
  }

  async refresh(localData) {
    const remote = await this.fetchRemote();
    return { data: mergeData(localData, remote.data), sha: remote.sha };
  }

  fileUrl() {
    const encodedPath = this.config.path.split("/").map(encodeURIComponent).join("/");
    return `${API_ROOT}/${encodeURIComponent(this.config.owner)}/${encodeURIComponent(this.config.repo)}/contents/${encodedPath}`;
  }

  headers() {
    return {
      Authorization: `Bearer ${this.config.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json"
    };
  }

  assertConfigured() {
    if (!this.configured) throw new Error("Add your GitHub repository and access token in Settings before syncing.");
    if (!navigator.onLine) throw new Error("You are offline. Changes are saved on this device and will sync when you reconnect.");
  }
}

async function responsePayload(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function apiError(response, payload) {
  const remaining = response.headers.get("X-RateLimit-Remaining");
  if (response.status === 401) return new Error("GitHub rejected the token (401). Check that it is correct and has not expired.");
  if (response.status === 403 && remaining === "0") return new Error("GitHub rate limit reached. Wait a few minutes, then refresh.");
  if (response.status === 403) return new Error("GitHub denied access (403). Verify the token has Contents read and write permission for this repository.");
  if (response.status === 404) return new Error("GitHub could not find the repository or data file (404). Check the owner, repository, and file path.");
  if (response.status === 409 || response.status === 422) return new Error("GitHub could not save because the file changed. Refresh and retry.");
  if (response.status >= 500) return new Error("GitHub is temporarily unavailable. Your changes remain saved on this device.");
  return new Error(`GitHub request failed (${response.status}). Verify the repository settings and try again.`);
}

async function request(url, options) {
  try {
    return await fetch(url, options);
  } catch (error) {
    if (!navigator.onLine) throw new Error("You are offline. Changes are saved on this device and will sync when you reconnect.", { cause: error });
    throw new Error("Could not reach GitHub. Check your connection and try again.", { cause: error });
  }
}

function encodeBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function decodeBase64(value) {
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}
