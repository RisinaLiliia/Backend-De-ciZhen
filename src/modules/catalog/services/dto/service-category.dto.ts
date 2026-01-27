// src/modules/catalog/services/dto/service-category.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class ServiceCategoryDto {
  @ApiProperty({ example: 'beauty' })
  key: string;

  @ApiProperty({ example: 'Beauty' })
  name: string;

  @ApiProperty({ example: 10 })
  sortOrder: number;

  @ApiProperty({ example: true })
  isActive: boolean;
}
