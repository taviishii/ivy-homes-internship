// Minimal server-side API client for reconnaissance.
// Reads IVY_API_KEY / IVY_API_BASE_URL from env (never prints the key).
"use strict";

const fs = require("fs");
const path = require("path");

function loadEnvLocal() {
  const envPath = path.join(__dirname, "..", "..", ".env.local");
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadEnvLocal();

const BASE_URL = process.env.IVY_API_BASE_URL || "https://solve.ivy.homes";
const API_KEY = process.env.IVY_API_KEY;

if (!API_KEY) {
  throw new Error("IVY_API_KEY not set in environment / .env.local");
}

function redact(url) {
  return url.replace(/api_key=[^&]+/, "api_key=REDACTED");
}

const LOG_PATH = path.join(__dirname, "..", "log", "requests.jsonl");

function appendLog(entry) {
  fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
  fs.appendFileSync(LOG_PATH, JSON.stringify(entry) + "\n");
}

let requestCount = 0;

/**
 * @param {string} pathAndQuery e.g. "/v1/listings?page=1"
 * @param {object} opts { method, token, body }
 */
async function apiRequest(pathAndQuery, opts = {}) {
  const { method = "GET", token, body, apiKeyMode = "header" } = opts;
  const url = new URL(BASE_URL + pathAndQuery);
  const headers = { Accept: "application/json" };
  if (apiKeyMode === "query") {
    if (!url.searchParams.has("api_key")) url.searchParams.set("api_key", API_KEY);
  } else if (apiKeyMode === "header") {
    headers["X-API-Key"] = API_KEY;
  }
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (body) headers["Content-Type"] = "application/json";

  const started = Date.now();
  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const durationMs = Date.now() - started;
  requestCount++;

  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // not JSON
  }

  appendLog({
    n: requestCount,
    ts: new Date().toISOString(),
    method,
    url: redact(url.toString()),
    status: res.status,
    durationMs,
    bodySent: body ? redactBody(body) : undefined,
  });

  return { status: res.status, headers: res.headers, json, text };
}

const SECRET_FIELD_NAMES = new Set([
  "password",
  "token",
  "access_token",
  "refresh_token",
  "api_key",
]);

function redactBody(body) {
  const clone = { ...body };
  for (const key of Object.keys(clone)) {
    if (SECRET_FIELD_NAMES.has(key)) clone[key] = "REDACTED";
  }
  return clone;
}

// Use this to print any parsed response body to stdout/logs safely.
function redactForDisplay(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(redactForDisplay);
  const clone = {};
  for (const [key, val] of Object.entries(value)) {
    if (SECRET_FIELD_NAMES.has(key) && typeof val === "string") {
      clone[key] = `REDACTED(len=${val.length})`;
    } else if (typeof val === "object") {
      clone[key] = redactForDisplay(val);
    } else {
      clone[key] = val;
    }
  }
  return clone;
}

function getRequestCount() {
  return requestCount;
}

module.exports = { apiRequest, getRequestCount, BASE_URL, redactForDisplay };
