// src/modules/auth/dto/logout-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class LogoutResponseDto {
  @ApiProperty({ example: true })
  ok: boolean;
}
