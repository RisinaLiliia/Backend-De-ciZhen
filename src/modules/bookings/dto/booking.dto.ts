// src/modules/bookings/dto/booking.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BookingDto {
  @ApiProperty({ example: '66f0c1a2b3c4d5e6f7a8b9ff' })
  id: string;

  @ApiProperty()
  requestId: string;

  @ApiProperty()
  offerId: string;

  @ApiPropertyOptional({ nullable: true })
  providerUserId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  clientId?: string | null;

  @ApiProperty({ example: '2026-01-29T10:00:00.000Z' })
  startAt: string;

  @ApiProperty({ example: 60 })
  durationMin: number;

  @ApiProperty({ example: '2026-01-29T11:00:00.000Z' })
  endAt: string;

  @ApiProperty({ enum: ['confirmed', 'cancelled', 'completed'], example: 'confirmed' })
  status: 'confirmed' | 'cancelled' | 'completed';

  @ApiPropertyOptional({ nullable: true })
  cancelledAt: string | null;

  @ApiPropertyOptional({ enum: ['client', 'provider', 'admin'], nullable: true })
  cancelledBy: 'client' | 'provider' | 'admin' | null;

  @ApiPropertyOptional({ nullable: true })
  cancelReason: string | null;

  @ApiPropertyOptional({ nullable: true })
  rescheduledFromId: string | null;

  @ApiPropertyOptional({ nullable: true })
  rescheduledToId: string | null;

  @ApiPropertyOptional({ nullable: true })
  rescheduledAt: string | null;

  @ApiPropertyOptional({ nullable: true })
  rescheduleReason: string | null;
}
