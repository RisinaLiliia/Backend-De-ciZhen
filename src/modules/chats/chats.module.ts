import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ChatsController } from './chats.controller';
import { ChatsService } from './chats.service';
import { ChatsGateway } from './chats.gateway';
import { ChatThread, ChatThreadSchema } from './schemas/chat-thread.schema';
import { ChatMessage, ChatMessageSchema } from './schemas/chat-message.schema';
import { Request, RequestSchema } from '../requests/schemas/request.schema';
import { Offer, OfferSchema } from '../offers/schemas/offer.schema';
import { Contract, ContractSchema } from '../contracts/schemas/contract.schema';
import { User, UserSchema } from '../users/schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ChatThread.name, schema: ChatThreadSchema },
      { name: ChatMessage.name, schema: ChatMessageSchema },
      { name: Request.name, schema: RequestSchema },
      { name: Offer.name, schema: OfferSchema },
      { name: Contract.name, schema: ContractSchema },
      { name: User.name, schema: UserSchema },
    ]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('app.jwtSecret'),
        signOptions: { expiresIn: '15m' },
      }),
    }),
  ],
  controllers: [ChatsController],
  providers: [ChatsService, ChatsGateway],
  exports: [ChatsService],
})
export class ChatsModule {}
