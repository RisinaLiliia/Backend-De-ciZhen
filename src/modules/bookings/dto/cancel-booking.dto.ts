// src/modules/bookings/dto/cancel-booking.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelBookingDto {
  @ApiPropertyOptional({ example: 'Client changed plans', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
