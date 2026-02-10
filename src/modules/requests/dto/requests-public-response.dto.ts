// src/modules/requests/dto/requests-public-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { RequestPublicDto } from './request-public.dto';

export class RequestsPublicResponseDto {
  @ApiProperty({ type: RequestPublicDto, isArray: true })
  items: RequestPublicDto[];

  @ApiProperty({ example: 128 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;
}
