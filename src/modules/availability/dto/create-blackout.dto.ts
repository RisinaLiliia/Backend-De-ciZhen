// src/modules/availability/dto/create-blackout.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateBlackoutDto {
  @ApiProperty({ example: '2026-03-28T10:00:00.000Z', description: 'UTC ISO string' })
  @IsISO8601()
  startAt: string;

  @ApiProperty({ example: '2026-03-28T16:00:00.000Z', description: 'UTC ISO string' })
  @IsISO8601()
  endAt: string;

  @ApiPropertyOptional({ example: 'Vacation', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
