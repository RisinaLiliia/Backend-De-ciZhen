import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsString, MaxLength } from 'class-validator';

import { RequestPublicDto } from '../../requests/dto/request-public.dto';

export class WorkspacePublicRequestsBatchDto {
  @ApiProperty({
    type: [String],
    example: ['65f0c1a2b3c4d5e6f7a8b9c1', '65f0c1a2b3c4d5e6f7a8b9c2'],
    description: 'Request ids to resolve in one API call. Max 100 ids.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  ids: string[];
}

export class WorkspacePublicRequestsBatchResponseDto {
  @ApiProperty({ type: RequestPublicDto, isArray: true })
  items: RequestPublicDto[];

  @ApiPropertyOptional({
    type: [String],
    example: ['65f0c1a2b3c4d5e6f7a8b9ff'],
    description: 'Ids that were not found among published requests.',
  })
  missingIds: string[];
}
