import { Inject, Injectable, Logger, OnApplicationShutdown } from "@nestjs/common";

type SimpleRedisClient = {
  __mode?: "memory" | "redis";
  setEx(key: string, seconds: number, value: string): Promise<unknown>;
  set(key: string, value: string): Promise<unknown>;
  get(key: string): Promise<string | null | Buffer>;
  del(...keys: string[]): Promise<unknown>;
  ping?(): Promise<unknown>;
  quit?(): Promise<unknown>;
  disconnect?(): void;
  isOpen?: boolean;
  keys?(pattern: string): Promise<string[]>;
  scan?(
    cursor: string,
    options: { MATCH?: string; COUNT?: number },
  ): Promise<{ cursor: string; keys: string[] } | [string, string[]]>;
};

type RedisClient = SimpleRedisClient;

export type RedisHealthStatus = {
  mode: "memory" | "redis";
  connected: boolean;
  degraded: boolean;
};

@Injectable()
export class RedisService implements OnApplicationShutdown {
  private readonly logger = new Logger(RedisService.name);

  constructor(
    @Inject("REDIS_CLIENT")
    private readonly redisClient: RedisClient,
  ) {}

  async set(key: string, value: string, expireSeconds?: number): Promise<void> {
    try {
      if (expireSeconds !== undefined) {
        await this.redisClient.setEx(key, expireSeconds, value);
      } else {
        await this.redisClient.set(key, value);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to set key "${key}": ${message}`);
    }
  }

  async setIfAbsent(key: string, value: string, expireSeconds: number): Promise<boolean> {
    try {
      const setWithOptions = (this.redisClient as unknown as {
        set?: (
          key: string,
          value: string,
          options?: { NX?: boolean; EX?: number },
        ) => Promise<unknown>;
      }).set;

      if (this.redisClient.__mode !== "memory" && typeof setWithOptions === "function") {
        const result = await setWithOptions.call(this.redisClient, key, value, {
          NX: true,
          EX: Math.max(1, Math.floor(expireSeconds)),
        });

        if (result === "OK" || result === true) return true;
        if (result === null || result === false) return false;
      }

      const existing = await this.get(key);
      if (existing !== null) return false;

      await this.set(key, value, expireSeconds);
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to set-if-absent for key "${key}": ${message}`);
      return true;
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      const value = await this.redisClient.get(key);

      if (Buffer.isBuffer(value)) {
        return value.toString("utf8");
      }

      return value;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get key "${key}": ${message}`);
      return null;
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redisClient.del(key);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to delete key "${key}": ${message}`);
    }
  }

  async deleteByPattern(pattern: string): Promise<number> {
    try {
      const scanFn = this.redisClient.scan;
      if (!scanFn) {
        const keysFn = this.redisClient.keys;
        if (!keysFn) return 0;
        const keys = await keysFn(pattern);
        if (!keys.length) return 0;
        await this.redisClient.del(...keys);
        return keys.length;
      }

      let cursor = "0";
      let deleted = 0;
      do {
        const result = await scanFn(cursor, { MATCH: pattern, COUNT: 200 });
        const nextCursor = Array.isArray(result) ? result[0] : result.cursor;
        const keys = Array.isArray(result) ? result[1] : result.keys;
        cursor = nextCursor;
        if (keys.length) {
          await this.redisClient.del(...keys);
          deleted += keys.length;
        }
      } while (cursor !== "0");

      return deleted;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to delete keys by pattern "${pattern}": ${message}`);
      return 0;
    }
  }

  async getHealthStatus(): Promise<RedisHealthStatus> {
    const mode = this.redisClient.__mode ?? "redis";
    if (mode === "memory") {
      return { mode, connected: false, degraded: true };
    }

    if (this.redisClient.isOpen === false) {
      return { mode: "redis", connected: false, degraded: true };
    }

    if (!this.redisClient.ping) {
      return { mode: "redis", connected: true, degraded: false };
    }

    try {
      await this.redisClient.ping();
      return { mode: "redis", connected: true, degraded: false };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Redis ping failed during health check: ${message}`);
      return { mode: "redis", connected: false, degraded: true };
    }
  }

  async onApplicationShutdown(): Promise<void> {
    try {
      if (this.redisClient.__mode === "memory") return;

      if (this.redisClient.quit) {
        await this.redisClient.quit();
        return;
      }

      this.redisClient.disconnect?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Redis shutdown cleanup failed: ${message}`);
    }
  }
}
