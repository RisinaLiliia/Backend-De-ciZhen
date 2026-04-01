import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class CreateConversationRelatedEntityDto {
  @ApiProperty({ enum: ['request', 'offer', 'order'], example: 'offer' })
  @IsString()
  @IsIn(['request', 'offer', 'order'])
  type: 'request' | 'offer' | 'order';

  @ApiProperty({ example: '66f0c1a2b3c4d5e6f7a8b9aa' })
  @IsString()
  @MaxLength(64)
  id: string;
}

export class CreateConversationDto {
  @ApiProperty({ type: CreateConversationRelatedEntityDto })
  @ValidateNested()
  @Type(() => CreateConversationRelatedEntityDto)
  relatedEntity: CreateConversationRelatedEntityDto;

  @ApiProperty({ example: '64f0c1a2b3c4d5e6f7a8b9c9' })
  @IsString()
  @MaxLength(64)
  participantUserId: string;

  @ApiPropertyOptional({ enum: ['customer', 'provider'], example: 'provider' })
  @IsOptional()
  @IsString()
  @IsIn(['customer', 'provider'])
  participantRole?: 'customer' | 'provider';

  @ApiPropertyOptional({ example: '65f0c1a2b3c4d5e6f7a8b9c1' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  requestId?: string;

  @ApiPropertyOptional({ example: '64f0c1a2b3c4d5e6f7a8b9c9' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  providerUserId?: string;

  @ApiPropertyOptional({ example: '66f0c1a2b3c4d5e6f7a8b9aa' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  offerId?: string;

  @ApiPropertyOptional({ example: '66f0c1a2b3c4d5e6f7a8b9ab' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  orderId?: string;

  @ApiPropertyOptional({ example: '66f0c1a2b3c4d5e6f7a8b9ab' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  contractId?: string;
}
