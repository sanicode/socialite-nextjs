// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

Sentry.init({
  dsn: "https://cb7ac346bc7eae100b5fbf31891b7dfe@o4511200692076544.ingest.de.sentry.io/4511200694763600",

  // Capture 100% of transactions for tracing
  tracesSampleRate: 1,

  // Capture 100% of sampled transactions for profiling
  profilesSampleRate: 1,

  integrations: [
    nodeProfilingIntegration(),
    Sentry.consoleLoggingIntegration({ levels: ["log", "warn", "error"] }),
  ],

  // Enable logs to be sent to Sentry
  enableLogs: true,

  sendDefaultPii: true,
});
