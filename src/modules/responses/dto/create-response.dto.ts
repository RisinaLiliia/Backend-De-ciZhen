import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateResponseDto {
  @ApiProperty({ example: '65f0c1a2b3c4d5e6f7a8b9c1' })
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  requestId: string;
}
