import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MaxLength } from 'class-validator';

export class FavoriteActionDto {
  @ApiProperty({ enum: ['provider', 'request'], example: 'request' })
  @IsIn(['provider', 'request'])
  type: 'provider' | 'request';

  @ApiProperty({ example: '65f0c1a2b3c4d5e6f7a8b9c1' })
  @IsString()
  @MaxLength(64)
  targetId: string;
}
