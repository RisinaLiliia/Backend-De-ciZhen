// src/modules/offers/dto/offer-query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export class OffersQueryDto {
  @ApiPropertyOptional({
    enum: ['sent', 'accepted', 'declined', 'withdrawn'],
    example: 'sent',
    description: 'Optional status filter',
  })
  @IsOptional()
  @IsIn(['sent', 'accepted', 'declined', 'withdrawn'])
  status?: 'sent' | 'accepted' | 'declined' | 'withdrawn';
}
