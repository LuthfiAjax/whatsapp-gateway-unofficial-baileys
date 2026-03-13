import jwt from "jsonwebtoken";
import { config } from "../config/env";
import type { DatabaseService } from "../database/DatabaseService";
import { AppError } from "../utils/errors";
import { sha256 } from "../utils/crypto";

function parseExpiry(input: string): number {
  const match = /^(\d+)([smhd])$/.exec(input.trim());
  if (!match) {
    throw new Error(`Unsupported expiry format: ${input}`);
  }
  const value = Number(match[1]);
  const multiplier = match[2] === "s" ? 1000 : match[2] === "m" ? 60_000 : match[2] === "h" ? 3_600_000 : 86_400_000;
  return value * multiplier;
}

export class AuthService {
  public constructor(private readonly databaseService: DatabaseService) {}

  public async register(username: string, password: string) {
    const existing = this.databaseService.users.findByUsername(username);
    if (existing) {
      throw new AppError(409, "CONFLICT", "Username already exists");
    }
    const passwordHash = await Bun.password.hash(password, { algorithm: "bcrypt" });
    const user = this.databaseService.users.create({ id: crypto.randomUUID(), username, passwordHash });
    const tokens = await this.issueTokens(user.id);
    return {
      user: { id: user.id, username: user.username },
      ...tokens
    };
  }

  public async login(username: string, password: string) {
    const user = this.databaseService.users.findByUsername(username);
    if (!user) {
      throw new AppError(401, "UNAUTHORIZED", "Invalid credentials");
    }
    const valid = await Bun.password.verify(password, user.passwordHash);
    if (!valid) {
      throw new AppError(401, "UNAUTHORIZED", "Invalid credentials");
    }
    const tokens = await this.issueTokens(user.id);
    return {
      user: { id: user.id, username: user.username },
      ...tokens
    };
  }

  public async refresh(refreshToken: string) {
    const tokenHash = await sha256(refreshToken);
    const record = this.databaseService.refreshTokens.findByHash(tokenHash);
    if (!record || record.revokedAt || Date.parse(record.expiresAt) <= Date.now()) {
      throw new AppError(401, "UNAUTHORIZED", "Invalid refresh token");
    }
    this.databaseService.refreshTokens.revokeByHash(tokenHash);
    return this.issueTokens(record.userId);
  }

  public async logout(refreshToken: string | undefined, userId: string): Promise<void> {
    if (refreshToken) {
      const tokenHash = await sha256(refreshToken);
      this.databaseService.refreshTokens.revokeByHash(tokenHash);
      return;
    }
    this.databaseService.refreshTokens.revokeAllByUserId(userId);
  }

  private async issueTokens(userId: string) {
    const accessToken = jwt.sign({ sub: userId, type: "access" }, config.jwtSecret, { expiresIn: config.jwtExpiresIn as any });
    const refreshToken = jwt.sign({ sub: userId, type: "refresh" }, config.jwtSecret, { expiresIn: config.jwtRefreshExpiresIn as any });
    const expiresAt = new Date(Date.now() + parseExpiry(config.jwtRefreshExpiresIn)).toISOString();
    this.databaseService.refreshTokens.create({
      id: crypto.randomUUID(),
      userId,
      tokenHash: await sha256(refreshToken),
      expiresAt
    });
    return {
      accessToken,
      refreshToken,
      expiresIn: config.jwtExpiresIn,
      refreshExpiresIn: config.jwtRefreshExpiresIn
    };
  }
}
