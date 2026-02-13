import { ApiProperty } from '@nestjs/swagger';

export class AcceptOfferResultDto {
  @ApiProperty({ example: true })
  ok: boolean;

  @ApiProperty({ example: '66f0c1a2b3c4d5e6f7a8b9ff' })
  acceptedOfferId: string;
}
