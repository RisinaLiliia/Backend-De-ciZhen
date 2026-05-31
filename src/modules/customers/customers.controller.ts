import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';

import { ApiPublicErrors } from '../../common/swagger/api-errors.decorator';
import { CustomerPublicDto } from './dto/customer-public.dto';
import { CustomersService } from './customers.service';

@ApiTags('customers')
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  private toPublicDto(item: Awaited<ReturnType<CustomersService['getPublicById']>>): CustomerPublicDto {
    return {
      id: item.id,
      userId: item.userId,
      displayName: item.displayName,
      bio: item.bio,
      avatarUrl: item.avatarUrl,
      cityId: item.cityId,
      cityName: item.cityName,
      ratingAvg: item.ratingAvg,
      ratingCount: item.ratingCount,
      isOnline: item.isOnline,
      lastSeenAt: item.lastSeenAt,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get public customer profile by user id' })
  @ApiSecurity({} as any)
  @ApiOkResponse({ type: CustomerPublicDto })
  @ApiPublicErrors()
  async getPublicById(@Param('id') id: string): Promise<CustomerPublicDto> {
    const item = await this.customers.getPublicById(id);
    return this.toPublicDto(item);
  }
}
