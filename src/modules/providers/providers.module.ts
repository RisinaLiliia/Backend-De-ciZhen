// src/modules/providers/providers.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProviderProfile, ProviderProfileSchema } from './schemas/provider-profile.schema';
import { ProvidersService } from './providers.service';
import { ProvidersController } from './providers.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: ProviderProfile.name, schema: ProviderProfileSchema }]),
  ],
  providers: [ProvidersService],
  controllers: [ProvidersController],
  exports: [ProvidersService],
})
export class ProvidersModule {}
