// src/modules/requests/dto/requests-public-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { RequestResponseDto } from './request-response.dto';

export class RequestsPublicResponseDto {
  @ApiProperty({ type: RequestResponseDto, isArray: true })
  items: RequestResponseDto[];

  @ApiProperty({ example: 128 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;
}
