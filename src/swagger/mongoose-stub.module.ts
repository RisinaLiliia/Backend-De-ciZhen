// src/swagger/mongoose-stub.module.ts
import { Global, Module } from "@nestjs/common";
import { getConnectionToken } from "@nestjs/mongoose";

@Global()
@Module({
  providers: [
    {
      provide: getConnectionToken(),
      useFactory: () => {
        const models: Record<string, unknown> = {};
        return {
          models,
          model: (name: string) => {
            if (!models[name]) models[name] = {};
            return models[name];
          },
        };
      },
    },
  ],
  exports: [getConnectionToken()],
})
export class MongooseStubModule {}
