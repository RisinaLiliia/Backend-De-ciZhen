// src/config/redis.ts
import { Module, Global, Logger } from "@nestjs/common";
import { createClient } from "redis";
import { ConfigService } from "@nestjs/config";
import { RedisService } from "../infra/redis.service";

type SimpleRedisClient = {
  __mode?: "memory" | "redis";
  setEx?(key: string, seconds: number, value: string): Promise<unknown>;
  set?(key: string, value: string): Promise<unknown>;
  get?(key: string): Promise<string | null | Buffer>;
  del?(...keys: string[]): Promise<unknown>;
  ping?(): Promise<unknown>;
  quit?(): Promise<unknown>;
  disconnect?(): void;
  isOpen?: boolean;
  keys?(pattern: string): Promise<string[]>;
  scan?(
    cursor: string,
    options: { MATCH?: string; COUNT?: number },
  ): Promise<{ cursor: string; keys: string[] } | [string, string[]]>;
  on(event: "error", listener: (err: unknown) => void): void;
  connect(): Promise<void>;
};

type RedisClient = SimpleRedisClient;

type MemoryEntry = {
  value: string;
  expiresAt: number | null;
};

function globToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  const source = `^${escaped.replace(/\*/g, ".*")}$`;
  return new RegExp(source);
}

function createInMemoryRedisClient(): RedisClient {
  const storage = new Map<string, MemoryEntry>();

  const purgeExpired = (key?: string) => {
    const now = Date.now();
    if (typeof key === "string") {
      const item = storage.get(key);
      if (item && item.expiresAt !== null && item.expiresAt <= now) {
        storage.delete(key);
      }
      return;
    }

    for (const [entryKey, item] of storage.entries()) {
      if (item.expiresAt !== null && item.expiresAt <= now) {
        storage.delete(entryKey);
      }
    }
  };

  return {
    __mode: "memory",
    isOpen: true,
    on() {},
    async connect() {},
    async ping() {
      return "PONG";
    },
    async quit() {},
    disconnect() {},
    async setEx(key: string, seconds: number, value: string) {
      const ttlMs = Math.max(0, Math.floor(seconds)) * 1000;
      storage.set(key, {
        value,
        expiresAt: Date.now() + ttlMs,
      });
    },
    async set(key: string, value: string) {
      storage.set(key, {
        value,
        expiresAt: null,
      });
    },
    async get(key: string) {
      purgeExpired(key);
      return storage.get(key)?.value ?? null;
    },
    async del(...keys: string[]) {
      for (const key of keys) {
        storage.delete(key);
      }
    },
    async keys(pattern: string) {
      purgeExpired();
      const regex = globToRegExp(pattern);
      return Array.from(storage.keys()).filter((key) => regex.test(key));
    },
    async scan(_cursor: string, options: { MATCH?: string; COUNT?: number }) {
      purgeExpired();
      const pattern = options.MATCH ?? "*";
      const regex = globToRegExp(pattern);
      const keys = Array.from(storage.keys()).filter((key) => regex.test(key));
      return { cursor: "0", keys };
    },
  };
}

@Global()
@Module({
  providers: [
    {
      provide: "REDIS_CLIENT",
      inject: [ConfigService],
      useFactory: async (config: ConfigService): Promise<RedisClient> => {
        const logger = new Logger("RedisModule");
        const redisDisabled = Boolean(config.get<boolean>("app.redisDisabled"));
        if (redisDisabled) {
          logger.warn("REDIS_DISABLED=true. Using in-memory fallback client.");
          return createInMemoryRedisClient();
        }

        const redisUrl = config.get<string>("app.redisUrl");
        const host = String(config.get("app.redisHost") ?? "127.0.0.1");
        const port = Number(config.get("app.redisPort") ?? 6379);
        const password = String(config.get("app.redisPassword") ?? "");

        const client = (redisUrl
          ? createClient({ url: redisUrl })
          : createClient({
              socket: { host, port },
              ...(password ? { password } : {}),
            })) as unknown as RedisClient;
        client.__mode = "redis";

        client.on("error", (err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          logger.error(`Redis error: ${message}`);
        });

        try {
          await client.connect();
          return client;
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          logger.warn(`Redis unavailable at startup, using in-memory fallback: ${message}`);
          try {
            client.disconnect?.();
          } catch {
            // ignore cleanup errors in fallback path
          }
          return createInMemoryRedisClient();
        }
      },
    },
    RedisService,
  ],
  exports: [RedisService],
})
export class RedisModule {}
