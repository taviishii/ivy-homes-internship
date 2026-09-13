// Server-only configuration. Never import this from a Client Component —
// getIvyApiKey() must never run in browser-bundled code.
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const IVY_API_BASE_URL =
  process.env.IVY_API_BASE_URL || "https://solve.ivy.homes";

/** Never log, return, or otherwise expose this value. Server-only. */
export function getIvyApiKey(): string {
  return requireEnv("IVY_API_KEY");
}
