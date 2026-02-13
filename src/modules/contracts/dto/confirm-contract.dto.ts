import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ConfirmContractDto {
  @ApiProperty({
    example: '2026-02-10T10:00:00.000Z',
    description: 'Start datetime in UTC (must match a returned availability slot)',
  })
  @IsISO8601()
  startAt: string;

  @ApiPropertyOptional({
    example: 60,
    description: 'Optional. Defaults to 60. Must match slot duration.',
  })
  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(24 * 60)
  durationMin?: number;

  @ApiPropertyOptional({ example: 'Please be on time', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}
