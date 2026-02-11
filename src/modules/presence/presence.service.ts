import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../infra/redis.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class PresenceService {
  private readonly logger = new Logger(PresenceService.name);
  private readonly ttlSeconds: number;

  constructor(
    private readonly redis: RedisService,
    private readonly users: UsersService,
    config: ConfigService,
  ) {
    const ttl = Number(config.get('app.presenceTtlSeconds') ?? 60);
    this.ttlSeconds = Number.isFinite(ttl) && ttl > 0 ? ttl : 60;
  }

  private key(userId: string) {
    return `presence:online:${userId}`;
  }

  async markOnline(userId: string): Promise<void> {
    if (!userId) return;
    try {
      await this.redis.set(this.key(userId), '1', this.ttlSeconds);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`markOnline failed: ${message}`);
    }
  }

  async markOffline(userId: string): Promise<void> {
    if (!userId) return;
    try {
      await this.redis.del(this.key(userId));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`markOffline failed: ${message}`);
    }
  }

  async isOnline(userId: string): Promise<boolean> {
    if (!userId) return false;
    const val = await this.redis.get(this.key(userId));
    return val != null;
  }

  async getOnlineMap(userIds: string[]): Promise<Map<string, boolean>> {
    const ids = Array.isArray(userIds) ? userIds.filter(Boolean) : [];
    if (ids.length === 0) return new Map();

    const results = await Promise.all(ids.map(async (id) => [id, await this.isOnline(id)] as const));
    return new Map(results);
  }

  async touchLastSeen(userId: string): Promise<void> {
    if (!userId) return;
    try {
      await this.users.touchLastSeen(userId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`touchLastSeen failed: ${message}`);
    }
  }
}
