import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class FavoriteListQueryDto {
  @ApiProperty({ enum: ['provider', 'request'], example: 'request' })
  @IsIn(['provider', 'request'])
  type: 'provider' | 'request';
}
