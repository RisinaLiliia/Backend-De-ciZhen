import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatsController } from './chats.controller';
import { ChatsService } from './chats.service';
import { ChatThread, ChatThreadSchema } from './schemas/chat-thread.schema';
import { ChatMessage, ChatMessageSchema } from './schemas/chat-message.schema';
import { Request, RequestSchema } from '../requests/schemas/request.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ChatThread.name, schema: ChatThreadSchema },
      { name: ChatMessage.name, schema: ChatMessageSchema },
      { name: Request.name, schema: RequestSchema },
    ]),
  ],
  controllers: [ChatsController],
  providers: [ChatsService],
})
export class ChatsModule {}
