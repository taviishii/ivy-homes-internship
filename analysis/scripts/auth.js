// Logs in and caches the session token to analysis/raw/session.json (gitignored).
// Never print this file's contents to stdout/logs.
"use strict";

const fs = require("fs");
const path = require("path");
const { apiRequest } = require("./client.js");

const SESSION_PATH = path.join(__dirname, "..", "raw", "session.json");

async function login(email = "demo1@ivy.homes") {
  const password = process.env.IVY_DEMO_PASSWORD;
  if (!password) throw new Error("IVY_DEMO_PASSWORD not set");
  const r = await apiRequest("/auth/login", { method: "POST", body: { email, password } });
  if (r.status !== 200) {
    throw new Error(`login failed: ${r.status} ${JSON.stringify(r.json ?? r.text)}`);
  }
  fs.mkdirSync(path.dirname(SESSION_PATH), { recursive: true });
  fs.writeFileSync(
    SESSION_PATH,
    JSON.stringify({ ...r.json, email, obtained_at: Date.now() }, null, 2)
  );
  return r.json;
}

function loadSession() {
  if (!fs.existsSync(SESSION_PATH)) return null;
  return JSON.parse(fs.readFileSync(SESSION_PATH, "utf8"));
}

async function getValidToken(email = "demo1@ivy.homes") {
  const session = loadSession();
  if (session && session.email === email) {
    const ageMs = Date.now() - session.obtained_at;
    const expiresMs = (session.expires_in || 0) * 1000;
    if (ageMs < expiresMs - 30_000) {
      return session.access_token;
    }
    // try refresh
    if (session.refresh_token) {
      const r = await apiRequest("/auth/refresh", {
        method: "POST",
        body: { refresh_token: session.refresh_token },
      });
      if (r.status === 200 && r.json && r.json.access_token) {
        const merged = { ...session, ...r.json, obtained_at: Date.now() };
        fs.writeFileSync(SESSION_PATH, JSON.stringify(merged, null, 2));
        return merged.access_token;
      }
    }
  }
  const fresh = await login(email);
  return fresh.access_token;
}

module.exports = { login, loadSession, getValidToken, SESSION_PATH };
