import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CreateChatDto {
  @ApiProperty({ example: '65f0c1a2b3c4d5e6f7a8b9c1', description: 'Request id' })
  @IsString()
  requestId: string;

  @ApiProperty({ example: '64f0c1a2b3c4d5e6f7a8b9c0', description: 'Client user id' })
  @IsString()
  clientId: string;

  @ApiProperty({ example: '64f0c1a2b3c4d5e6f7a8b9c9', description: 'Provider user id' })
  @IsString()
  providerUserId: string;
}
