// src/modules/auth/dto/auth-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { SafeUserDto } from './safe-user.dto';

export class AuthResponseDto {
  @ApiProperty({ type: SafeUserDto })
  user: SafeUserDto;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken: string;

  @ApiProperty({ example: 900, description: 'Access token TTL in seconds' })
  expiresIn: number;
}
