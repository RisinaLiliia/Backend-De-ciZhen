// src/modules/requests/dto/request-photos-upload-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class RequestPhotosUploadResponseDto {
  @ApiProperty({ example: ['https://cdn.example.com/req/1.jpg'] })
  urls: string[];
}
