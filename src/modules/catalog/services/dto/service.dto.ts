// src/modules/catalog/services/dto/service.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class ServiceDto {
  @ApiProperty({ example: 'haircut_men' })
  key: string;

  @ApiProperty({ example: 'Men haircut' })
  name: string;

  @ApiProperty({ example: { en: "Men's haircut", de: 'Herrenhaarschnitt' } })
  i18n: Record<string, string>;

  @ApiProperty({ example: 'beauty' })
  categoryKey: string;

  @ApiProperty({ example: 10 })
  sortOrder: number;

  @ApiProperty({ example: true })
  isActive: boolean;
}
