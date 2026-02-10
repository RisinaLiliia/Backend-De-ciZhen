// src/swagger/redis-stub.module.ts
import { Global, Module } from "@nestjs/common";
import { RedisService } from "../infra/redis.service";

@Global()
@Module({
  providers: [
    {
      provide: "REDIS_CLIENT",
      useValue: {
        setEx: async () => undefined,
        set: async () => undefined,
        get: async () => null,
        del: async () => undefined,
      },
    },
    RedisService,
  ],
  exports: [RedisService],
})
export class RedisStubModule {}
