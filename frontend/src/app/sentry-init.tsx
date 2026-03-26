"use client";

import { useEffect } from "react";

export function SentryInit() {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      import("@/lib/sentry").then((m) => m.initSentry());
    }
  }, []);

  return null;
}
