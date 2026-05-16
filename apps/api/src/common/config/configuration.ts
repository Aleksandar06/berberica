/**
 * Centralized config loader for @nestjs/config. Consumers read typed values
 * via `ConfigService.get(...)`. All env access is funneled through here so
 * tests and prod configs can swap by injecting a different loader.
 */
export interface AppConfig {
  nodeEnv: "development" | "production" | "test";
  port: number;
  webOrigin: string;
}

export interface JwtConfig {
  accessSecret: string;
  refreshSecret: string;
  accessTtl: string; // e.g. "15m"
  refreshTtlSeconds: number; // numeric for DB expires_at math
}

export interface CookieConfig {
  secret: string;
  secure: boolean; // Secure flag on cookies; true in prod, false in dev (http)
}

export interface RedisConfig {
  url: string;
}

export interface RootConfig {
  app: AppConfig;
  jwt: JwtConfig;
  cookie: CookieConfig;
  redis: RedisConfig;
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.length === 0) {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return v;
}

export default function configuration(): RootConfig {
  const nodeEnv =
    (process.env.NODE_ENV as AppConfig["nodeEnv"]) ?? "development";
  return {
    app: {
      nodeEnv,
      port: Number(process.env.API_PORT ?? 4000),
      webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
    },
    jwt: {
      accessSecret: requireEnv("JWT_ACCESS_SECRET"),
      refreshSecret: requireEnv("JWT_REFRESH_SECRET"),
      accessTtl: process.env.JWT_ACCESS_TTL ?? "15m",
      refreshTtlSeconds: Number(
        process.env.JWT_REFRESH_TTL_SECONDS ?? 60 * 60 * 24 * 30,
      ),
    },
    cookie: {
      secret: requireEnv("COOKIE_SECRET"),
      secure: nodeEnv === "production",
    },
    redis: {
      url: process.env.REDIS_URL ?? "redis://localhost:6379",
    },
  };
}
