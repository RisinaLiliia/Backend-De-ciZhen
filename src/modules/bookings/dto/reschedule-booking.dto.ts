// src/modules/bookings/dto/reschedule-booking.dto.ts
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsISO8601, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class RescheduleBookingDto {
  @ApiProperty({
    example: '2026-02-10T10:00:00.000Z',
    description: 'New booking startAt (UTC ISO)',
  })
  @IsISO8601()
  startAt: string;

  @ApiPropertyOptional({
    example: 60,
    description: 'Optional. If omitted, keep previous durationMin',
  })
  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(24 * 60)
  durationMin?: number;

  @ApiPropertyOptional({ example: 'Need another time', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
