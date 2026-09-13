import { ivyFetch } from "./client";

/**
 * Actual /auth/login response shape. The documented shape
 * ({token, expires_in: 86400, user: {email, name}}) is wrong: the real
 * field is `access_token` (not `token`), there is a `refresh_token` and
 * `refresh_url` the docs say don't exist, `expires_in` is 900 seconds (15
 * minutes) not 86400, and `user` only carries `email`.
 */
export interface IvyLoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_url: string;
  user: { email: string };
}

export async function ivyLogin(
  email: string,
  password: string
): Promise<IvyLoginResponse> {
  return ivyFetch<IvyLoginResponse>("/auth/login", {
    method: "POST",
    body: { email, password },
  });
}

export async function ivyRefresh(
  refreshToken: string
): Promise<IvyLoginResponse> {
  return ivyFetch<IvyLoginResponse>("/auth/refresh", {
    method: "POST",
    body: { refresh_token: refreshToken },
  });
}

/**
 * /auth/logout is a stateless no-op server-side (confirmed: it returns
 * {"ok":true,"note":"tokens are stateless; discard them client side"} and
 * does not revoke the token). We still call it for completeness, but the
 * real logout guarantee comes entirely from destroying our own session
 * cookie — never assume the upstream token becomes invalid.
 */
export async function ivyLogout(accessToken: string): Promise<void> {
  try {
    await ivyFetch("/auth/logout", { method: "POST", accessToken });
  } catch {
    // Logging out should never fail the user-visible logout action.
  }
}
