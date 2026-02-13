// src/modules/offers/dto/reject-offer.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class RejectOfferResultDto {
  @ApiProperty({ example: true })
  ok: boolean;

  @ApiProperty({ example: '66f0c1a2b3c4d5e6f7a8b9ff' })
  rejectedOfferId: string;
}
