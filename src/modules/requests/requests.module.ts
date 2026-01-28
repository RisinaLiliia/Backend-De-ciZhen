// src/modules/requests/requests.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';
import { Request, RequestSchema } from './schemas/request.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: Request.name, schema: RequestSchema }])],
  controllers: [RequestsController],
  providers: [RequestsService],
  exports: [RequestsService],
})
export class RequestsModule {}
