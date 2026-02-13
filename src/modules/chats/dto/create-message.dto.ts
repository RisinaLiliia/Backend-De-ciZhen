import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class CreateMessageDto {
  @ApiProperty({ example: 'Hi! I can start tomorrow.' })
  @IsString()
  @MaxLength(2000)
  text: string;
}
