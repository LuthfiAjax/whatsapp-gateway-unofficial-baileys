export interface AppConfig {
  appHost: string;
  appBaseUrl: string;
  nodeEnv: string;
  port: number;
  sqlitePath: string;
  webhookRetryCount: number;
  webhookTimeoutMs: number;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  dailyMessageQuota: number;
  bootstrapUserId: string;
  bootstrapApiKey: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  jwtRefreshExpiresIn: string;
  defaultCountryCode: string;
}

function readNumber(name: string, fallback: number): number {
  const value = Bun.env[name];
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid numeric env: ${name}`);
  }
  return parsed;
}

function readString(name: string, fallback: string): string {
  return Bun.env[name] ?? fallback;
}

export const config: AppConfig = {
  appHost: readString("APP_HOST", "0.0.0.0"),
  appBaseUrl: readString("APP_BASE_URL", "http://localhost:3010"),
  nodeEnv: readString("NODE_ENV", "development"),
  port: readNumber("PORT", 3010),
  sqlitePath: readString("SQLITE_PATH", "./data/app.db"),
  webhookRetryCount: readNumber("WEBHOOK_RETRY_COUNT", 3),
  webhookTimeoutMs: readNumber("WEBHOOK_TIMEOUT_MS", 5000),
  rateLimitWindowMs: readNumber("RATE_LIMIT_WINDOW_MS", 60_000),
  rateLimitMaxRequests: readNumber("RATE_LIMIT_MAX_REQUESTS", 120),
  dailyMessageQuota: readNumber("DAILY_MESSAGE_QUOTA", 10000),
  bootstrapUserId: readString("BOOTSTRAP_USER_ID", "demo-user"),
  bootstrapApiKey: readString("BOOTSTRAP_API_KEY", "change-me-now"),
  jwtSecret: readString("JWT_SECRET", "super-secret-jwt-key-replace-me-in-production"),
  jwtExpiresIn: readString("JWT_EXPIRES_IN", "15m"),
  jwtRefreshExpiresIn: readString("JWT_REFRESH_EXPIRES_IN", "7d"),
  defaultCountryCode: readString("DEFAULT_COUNTRY_CODE", "62")
};
