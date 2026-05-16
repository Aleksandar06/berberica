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
    new FastifyAdapter({ trustProxy: true }),
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
  // CORS — allow the web app to call with credentials so cookies flow.
  await app.register(fastifyCors, {
    origin: cfg.app.webOrigin,
    credentials: true,
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
