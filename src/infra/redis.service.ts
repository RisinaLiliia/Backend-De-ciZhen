import { Inject, Injectable, Logger } from "@nestjs/common";

type SimpleRedisClient = {
  setEx(key: string, seconds: number, value: string): Promise<unknown>;
  set(key: string, value: string): Promise<unknown>;
  get(key: string): Promise<string | null | Buffer>;
  del(...keys: string[]): Promise<unknown>;
  keys?(pattern: string): Promise<string[]>;
  scan?(
    cursor: string,
    options: { MATCH?: string; COUNT?: number },
  ): Promise<{ cursor: string; keys: string[] } | [string, string[]]>;
};

type RedisClient = SimpleRedisClient;

@Injectable()
export class RedisService {
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
}
