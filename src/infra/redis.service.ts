import { Inject, Injectable, Logger } from "@nestjs/common";

type SimpleRedisClient = {
  setEx(key: string, seconds: number, value: string): Promise<unknown>;
  set(key: string, value: string): Promise<unknown>;
  get(key: string): Promise<string | null | Buffer>;
  del(key: string): Promise<unknown>;
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
}
