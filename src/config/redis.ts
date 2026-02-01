// src/config/redis.ts
import { Module, Global } from "@nestjs/common";
import { createClient } from "redis";
import { ConfigService } from "@nestjs/config";
import { RedisService } from "../infra/redis.service";

type SimpleRedisClient = {
  setEx?(key: string, seconds: number, value: string): Promise<unknown>;
  set?(key: string, value: string): Promise<unknown>;
  get?(key: string): Promise<string | null | Buffer>;
  del?(key: string): Promise<unknown>;
  on(event: "error", listener: (err: unknown) => void): void;
  connect(): Promise<void>;
};

type RedisClient = SimpleRedisClient;

@Global()
@Module({
  providers: [
    {
      provide: "REDIS_CLIENT",
      inject: [ConfigService],
      useFactory: async (config: ConfigService): Promise<RedisClient> => {
        const redisDisabled = Boolean(config.get<boolean>("app.redisDisabled"));
        if (redisDisabled) {
          return {
            async connect() {},
            on() {},
            async setEx() {},
            async set() {},
            async get() {
              return null;
            },
            async del() {},
          };
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

        client.on("error", (err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          console.error("[Redis] Error:", message);
        });

        await client.connect();
        return client;
      },
    },
    RedisService,
  ],
  exports: [RedisService],
})
export class RedisModule {}
