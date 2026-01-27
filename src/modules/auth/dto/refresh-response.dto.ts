// src/modules/auth/dto/refresh-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class RefreshResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken: string;

  @ApiProperty({ example: 900, description: 'Access token TTL in seconds' })
  expiresIn: number;
}

