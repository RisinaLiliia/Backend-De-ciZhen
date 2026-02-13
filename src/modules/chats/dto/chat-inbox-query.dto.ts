import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export class ChatInboxQueryDto {
  @ApiPropertyOptional({ enum: ['client', 'provider', 'all'], default: 'all' })
  @IsOptional()
  @IsIn(['client', 'provider', 'all'])
  role?: 'client' | 'provider' | 'all';
}
