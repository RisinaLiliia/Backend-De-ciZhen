import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelContractDto {
  @ApiPropertyOptional({ example: 'Client changed plans', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
