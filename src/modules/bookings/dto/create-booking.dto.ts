import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateBookingDto {
  @ApiProperty({ example: 'r1' })
  @IsString()
  @MaxLength(64)
  requestId: string;

  @ApiProperty({ example: 'resp1' })
  @IsString()
  @MaxLength(64)
  responseId: string;

  @ApiProperty({ example: 'p1', description: 'Provider userId' })
  @IsString()
  @MaxLength(64)
  providerUserId: string;

  @ApiProperty({ example: '2026-03-05T10:00:00.000Z', description: 'UTC ISO' })
  @IsISO8601()
  startAt: string;

  @ApiPropertyOptional({ example: 60, description: 'Optional, minutes' })
  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(24 * 60)
  durationMin?: number;

  @ApiPropertyOptional({ example: 'Client note', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}
