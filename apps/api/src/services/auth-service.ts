import { randomUUID } from 'node:crypto';

import type { AppEnv } from '@lp/config';
import type { DbClient } from '@lp/db';
import {
  findUserByEmail,
  findUserById,
  findValidRefreshToken,
  insertRefreshToken,
  insertUser,
  listMembershipsForUser,
  revokeRefreshToken,
} from '@lp/db';
import { hashPassword, normalizeEmail, toPublicUser, verifyPassword, type User } from '@lp/domain';

import { createRefreshTokenSecret, hashRefreshToken, signAccessToken } from '../auth/tokens.js';
import { conflict, unauthorized, validation } from '../errors.js';

export class AuthService {
  constructor(
    private readonly client: DbClient,
    private readonly env: AppEnv,
    private readonly jwtSecret: string,
  ) {}

  async register(input: {
    email: string;
    password: string;
    name: string;
    userAgent: string | null;
    ip: string | null;
  }): Promise<{ user: User; accessToken: string; refreshToken: string; expiresIn: number }> {
    const email = normalizeEmail(input.email);
    if (!email.includes('@') || email.length < 3) {
      throw validation('Invalid email');
    }
    if (!input.name || input.name.trim().length < 1 || input.name.trim().length > 200) {
      throw validation('Name must be 1–200 characters');
    }
    if (input.password.length < 8) {
      throw validation('Password must be at least 8 characters');
    }

    const existing = await findUserByEmail(this.client.db, email);
    if (existing) {
      throw conflict('Email already registered');
    }

    let passwordHash: string;
    try {
      passwordHash = await hashPassword(input.password);
    } catch (err) {
      throw validation(err instanceof Error ? err.message : 'Invalid password');
    }

    const user = await insertUser(this.client.db, {
      id: randomUUID(),
      email,
      name: input.name.trim(),
      passwordHash,
    });

    const tokens = await this.issueTokens(user, input.userAgent, input.ip);
    return { user, ...tokens };
  }

  async login(input: {
    email: string;
    password: string;
    userAgent: string | null;
    ip: string | null;
  }): Promise<{ user: User; accessToken: string; refreshToken: string; expiresIn: number }> {
    const email = normalizeEmail(input.email);
    const user = await findUserByEmail(this.client.db, email);
    if (!user || !user.passwordHash) {
      throw unauthorized('Invalid email or password');
    }
    const ok = await verifyPassword(user.passwordHash, input.password);
    if (!ok) {
      throw unauthorized('Invalid email or password');
    }
    const tokens = await this.issueTokens(user, input.userAgent, input.ip);
    return { user, ...tokens };
  }

  async refresh(input: {
    refreshToken: string;
    userAgent: string | null;
    ip: string | null;
  }): Promise<{ user: User; accessToken: string; refreshToken: string; expiresIn: number }> {
    const tokenHash = hashRefreshToken(input.refreshToken);
    const stored = await findValidRefreshToken(this.client.db, tokenHash);
    if (!stored) {
      throw unauthorized('Invalid refresh token');
    }
    await revokeRefreshToken(this.client.db, stored.id);
    const user = await findUserById(this.client.db, stored.userId);
    if (!user) {
      throw unauthorized('Invalid refresh token');
    }
    const tokens = await this.issueTokens(user, input.userAgent, input.ip);
    return { user, ...tokens };
  }

  async getMe(user: User): Promise<{
    user: ReturnType<typeof toPublicUser>;
    memberships: Array<{
      orgId: string;
      role: string;
      org: { id: string; slug: string; name: string };
    }>;
  }> {
    const memberships = await listMembershipsForUser(this.client.db, user.id);
    return {
      user: toPublicUser(user),
      memberships: memberships.map((m) => ({
        orgId: m.orgId,
        role: m.role,
        org: { id: m.org.id, slug: m.org.slug, name: m.org.name },
      })),
    };
  }

  private async issueTokens(
    user: User,
    userAgent: string | null,
    ip: string | null,
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const expiresIn = this.env.accessTokenTtlSeconds;
    const accessToken = await signAccessToken({
      userId: user.id,
      jwtSecret: this.jwtSecret,
      ttlSeconds: expiresIn,
    });
    const refresh = createRefreshTokenSecret();
    const expiresAt = new Date(Date.now() + this.env.refreshTokenTtlSeconds * 1000);
    await insertRefreshToken(this.client.db, {
      id: randomUUID(),
      userId: user.id,
      tokenHash: refresh.hash,
      expiresAt,
      userAgent,
      ip,
    });
    return {
      accessToken,
      refreshToken: refresh.secret,
      expiresIn,
    };
  }
}
