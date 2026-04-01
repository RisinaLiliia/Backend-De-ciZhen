import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ChatAttachmentInputDto {
  @ApiPropertyOptional({ example: 'https://cdn.example.com/files/quote.pdf' })
  @IsString()
  @MaxLength(1000)
  url: string;

  @ApiPropertyOptional({ example: 'quote.pdf' })
  @IsString()
  @MaxLength(160)
  name: string;

  @ApiPropertyOptional({ example: 20480 })
  @IsInt()
  @Min(0)
  @Max(25_000_000)
  size: number;

  @ApiPropertyOptional({ example: 'application/pdf' })
  @IsString()
  @MaxLength(160)
  mimeType: string;
}

export class CreateMessageDto {
  @ApiPropertyOptional({
    example: '66f0c1a2b3c4d5e6f7a8b9aa',
    description: 'Required for POST /chat/messages. Legacy thread routes can use the path param instead.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  conversationId?: string;

  @ApiPropertyOptional({ example: 'Hi! I can start tomorrow.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  text?: string;

  @ApiPropertyOptional({ type: [ChatAttachmentInputDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => ChatAttachmentInputDto)
  attachments?: ChatAttachmentInputDto[];
}
