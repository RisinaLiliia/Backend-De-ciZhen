import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChatRelatedEntityDto {
  @ApiProperty({ enum: ['request', 'offer', 'order'], example: 'offer' })
  type: 'request' | 'offer' | 'order';

  @ApiProperty({ example: '66f0c1a2b3c4d5e6f7a8b9aa' })
  id: string;

  @ApiPropertyOptional({ example: '65f0c1a2b3c4d5e6f7a8b9c1', nullable: true })
  requestId?: string | null;

  @ApiPropertyOptional({ example: '66f0c1a2b3c4d5e6f7a8b9aa', nullable: true })
  offerId?: string | null;

  @ApiPropertyOptional({ example: '66f0c1a2b3c4d5e6f7a8b9ab', nullable: true })
  orderId?: string | null;

  @ApiPropertyOptional({ example: 'Window cleaning in Frankfurt', nullable: true })
  title?: string | null;

  @ApiPropertyOptional({ example: 'Frankfurt am Main', nullable: true })
  subtitle?: string | null;

  @ApiPropertyOptional({ example: 'accepted', nullable: true })
  status?: string | null;

  @ApiPropertyOptional({ example: 180, nullable: true })
  amount?: number | null;

  @ApiPropertyOptional({ example: 'EUR 180', nullable: true })
  amountLabel?: string | null;
}
