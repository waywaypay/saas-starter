import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Single source of truth for environment configuration.
 *
 * Design note (failure-mode #1 from the rebuild brief): the previous version
 * 500'd in production because env problems surfaced as opaque runtime errors.
 * Here we Zod-parse every variable and fail with ONE clear error listing what's
 * wrong. Critically, validation is RUNTIME, not build-time: `next build`
 * evaluates modules during page-data collection, so a module that throws when a
 * secret is absent would crash the build (which is exactly what killed the old
 * repo). `@t3-oss/env-nextjs` validates on first access and honors
 * SKIP_ENV_VALIDATION so the build step never needs real secrets, while also
 * enforcing the server/client boundary (DATABASE_URL can never leak into a
 * client bundle).
 */
export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    AUTH_SECRET: z
      .string()
      .min(16, "AUTH_SECRET must be at least 16 characters"),
    // AUTH_URL is optional because Auth.js can derive it from the request when
    // trustHost is enabled (we set trustHost), and Render injects the public
    // URL. When present it must be a valid URL.
    AUTH_URL: z.string().url().optional(),
    CRON_SECRET: z
      .string()
      .min(16, "CRON_SECRET must be at least 16 characters"),

    // Optional integrations.
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),

    // 64 hex chars == 32 bytes for AES-256-GCM. Optional in Phase 1 (mock
    // provider stores no tokens); becomes required when a real provider is
    // enabled (enforced in lib/crypto.ts at point of use).
    ENCRYPTION_KEY: z
      .string()
      .regex(/^[0-9a-fA-F]{64}$/u, "ENCRYPTION_KEY must be 64 hex chars")
      .optional(),

    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
  },
  client: {},
  // Next.js inlines NEXT_PUBLIC_* at build; nothing client-side needs config
  // right now, but the runtime mapping is required by the lib.
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_URL: process.env.AUTH_URL,
    CRON_SECRET: process.env.CRON_SECRET,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
    NODE_ENV: process.env.NODE_ENV,
  },
  // Skip during `next build` / lint / typecheck where secrets are absent by
  // design. Validation then runs on first real access at runtime.
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION || process.env.npm_lifecycle_event === "lint",
  emptyStringAsUndefined: true,
});

/** True when running as a deployed production server. */
export const isProduction = env.NODE_ENV === "production";

/** Google OAuth is available only when both halves of the credential exist. */
export const isGoogleAuthEnabled =
  !!env.GOOGLE_CLIENT_ID && !!env.GOOGLE_CLIENT_SECRET;
