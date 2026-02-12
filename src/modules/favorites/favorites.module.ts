import { Module } from '@nestjs/common';
import { FavoritesController } from './favorites.controller';
import { ProvidersModule } from '../providers/providers.module';
import { RequestsModule } from '../requests/requests.module';
import { UsersModule } from '../users/users.module';
import { PresenceModule } from '../presence/presence.module';

@Module({
  imports: [ProvidersModule, RequestsModule, UsersModule, PresenceModule],
  controllers: [FavoritesController],
})
export class FavoritesModule {}
