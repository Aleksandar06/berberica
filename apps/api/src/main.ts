import fastifyCookie from "@fastify/cookie";
import fastifyCors from "@fastify/cors";
import fastifyHelmet from "@fastify/helmet";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";

import { AppModule } from "./app.module";
import type {
  AppConfig,
  CookieConfig,
} from "./common/config/configuration";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      trustProxy: true,
      // Bumped from the 1 MB default so the tenant-branding PATCH can carry
      // a base64-encoded logo (up to 2 MB raw → ~2.7 MB JSON after base64).
      // No other endpoint sends bodies anywhere near this size.
      bodyLimit: 5 * 1024 * 1024,
    }),
  );

  // Pull typed config from the same loader used by app.module.
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
  const { default: loadConfig } = require("./common/config/configuration") as {
    default: () => { app: AppConfig; cookie: CookieConfig };
  };
  const cfg = loadConfig();

  // --- Fastify plugins ---------------------------------------------------
  // Cookie parser — required for the refresh token HttpOnly cookie.
  await app.register(fastifyCookie, { secret: cfg.cookie.secret });
  // Sensible security headers (no CSP because we serve no HTML; the API
  // is JSON-only).
  await app.register(fastifyHelmet, { contentSecurityPolicy: false });
  // CORS — explicit allowlist of web origins (comma-separated WEB_ORIGIN).
  // Vercel preview URLs change per deploy, so we accept the production
  // origin + any `https://*-<team>.vercel.app` preview that matches one of
  // the configured origins by suffix. Credentials are on so cookies flow.
  const allowed = new Set(cfg.app.webOrigins);
  await app.register(fastifyCors, {
    credentials: true,
    origin: (origin, cb) => {
      // Server-to-server / curl have no Origin header — let those through.
      if (!origin) return cb(null, true);
      if (allowed.has(origin)) return cb(null, true);
      cb(new Error(`CORS: origin not allowed: ${origin}`), false);
    },
  });

  // --- Routing -----------------------------------------------------------
  // All app routes live under /api. /health stays unprefixed for trivial
  // uptime checks from infra that doesn't know about /api.
  app.setGlobalPrefix("api", { exclude: ["health"] });

  // --- Listen ------------------------------------------------------------
  await app.listen({ port: cfg.app.port, host: "0.0.0.0" });

  // eslint-disable-next-line no-console
  console.log(`[api] listening on http://localhost:${cfg.app.port}`);
}

void bootstrap();
