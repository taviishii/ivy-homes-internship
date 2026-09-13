"use client";

import { useEffect } from "react";

/**
 * Access tokens last 15 minutes. Normal navigation already refreshes the
 * session transparently (proxy.ts checks on every request), but a tab left
 * open without any navigation for 30+ minutes wouldn't trigger that. This
 * pings a lightweight route periodically so the session — and proxy's
 * refresh-on-request logic — stays current even on a fully idle tab.
 */
export function SessionKeepAlive() {
  useEffect(() => {
    const id = setInterval(() => {
      fetch("/api/session/ping", { method: "POST" }).catch(() => {});
    }, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  return null;
}
