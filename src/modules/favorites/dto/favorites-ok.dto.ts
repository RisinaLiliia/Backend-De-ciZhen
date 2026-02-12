import { ApiProperty } from '@nestjs/swagger';

export class FavoritesOkDto {
  @ApiProperty({ example: true })
  ok: boolean;
}
