// src/modules/responses/dto/response-query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export class ResponsesQueryDto {
  @ApiPropertyOptional({
    enum: ['pending', 'accepted', 'rejected'],
    example: 'pending',
    description: 'Optional status filter',
  })
  @IsOptional()
  @IsIn(['pending', 'accepted', 'rejected'])
  status?: 'pending' | 'accepted' | 'rejected';
}
