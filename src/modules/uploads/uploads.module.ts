// src/modules/uploads/uploads.module.ts
import { Module } from '@nestjs/common';
import { UploadsService } from './uploads.service';

@Module({
  providers: [UploadsService],
  exports: [UploadsService],
})
export class UploadsModule {}
