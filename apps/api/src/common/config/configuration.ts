/**
 * Centralized config loader for @nestjs/config. Consumers read typed values
 * via `ConfigService.get(...)`. All env access is funneled through here so
 * tests and prod configs can swap by injecting a different loader.
 */
export interface AppConfig {
  nodeEnv: "development" | "production" | "test";
  port: number;
  /**
   * One or more allowed web origins for CORS. In dev this is a single
   * `http://localhost:3000`; in production it's typically a comma-
   * separated list (`https://app.berberica.com,https://berberica.vercel.app`)
   * so production + preview deploys can both call the same API.
   */
  webOrigins: string[];
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
  sameSite: "strict" | "lax" | "none";
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
      // Hosted platforms (Railway, Render, Fly) inject $PORT — respect it
      // first. Fall back to API_PORT for the local docker-compose flow.
      port: Number(process.env.PORT ?? process.env.API_PORT ?? 4000),
      webOrigins: (process.env.WEB_ORIGIN ?? "http://localhost:3000")
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0),
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
      // SameSite=None is required when web and api are on different sites
      // (e.g. separate Railway *.up.railway.app subdomains, which the public
      // suffix list treats as cross-site). The /refresh route keeps an
      // x-requested-with header check as CSRF defense.
      sameSite:
        (process.env.COOKIE_SAMESITE as CookieConfig["sameSite"]) ?? "strict",
    },
    redis: {
      url: process.env.REDIS_URL ?? "redis://localhost:6379",
    },
  };
}
