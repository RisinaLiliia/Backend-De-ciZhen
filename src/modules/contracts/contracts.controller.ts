import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AppRole } from '../users/schemas/user.schema';
import { ApiErrors } from '../../common/swagger/api-errors.decorator';

import { ContractsService } from './contracts.service';
import { ContractDto } from './dto/contract.dto';
import { ContractsQueryDto } from './dto/contracts-query.dto';
import { ConfirmContractDto } from './dto/confirm-contract.dto';
import { CancelContractDto } from './dto/cancel-contract.dto';

type CurrentUserPayload = { userId: string; role: AppRole; sessionId?: string };

@ApiTags('contracts')
@Controller('contracts')
export class ContractsController {
  constructor(private readonly contracts: ContractsService) {}

  private toDto(c: any): ContractDto {
    return {
      id: c._id.toString(),
      requestId: c.requestId,
      offerId: c.offerId,
      clientId: c.clientId,
      providerUserId: c.providerUserId,
      status: c.status,
      priceAmount: c.priceAmount ?? null,
      priceType: c.priceType ?? null,
      priceDetails: c.priceDetails ?? null,
      confirmedAt: c.confirmedAt ?? null,
      completedAt: c.completedAt ?? null,
      cancelledAt: c.cancelledAt ?? null,
      cancelReason: c.cancelReason ?? null,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('my')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List my contracts (client/provider)' })
  @ApiOkResponse({ type: ContractDto, isArray: true })
  @ApiErrors({ conflict: false, notFound: false })
  async my(@CurrentUser() user: CurrentUserPayload, @Query() q: ContractsQueryDto): Promise<ContractDto[]> {
    const items = await this.contracts.listMy(user.userId, {
      role: q.role ?? 'all',
      status: q.status,
      limit: q.limit,
      offset: q.offset,
    });
    return items.map((c) => this.toDto(c));
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get contract by id' })
  @ApiParam({ name: 'id', required: true })
  @ApiOkResponse({ type: ContractDto })
  @ApiErrors({ conflict: false })
  async getById(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string): Promise<ContractDto> {
    const contract = await this.contracts.getByIdForUser(id, user.userId);
    return this.toDto(contract);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/confirm')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Client: confirm contract and create booking' })
  @ApiParam({ name: 'id', required: true })
  @ApiOkResponse({ type: ContractDto })
  @ApiErrors({ conflict: true })
  async confirm(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: ConfirmContractDto,
  ): Promise<ContractDto> {
    const updated = await this.contracts.confirmByClient(id, user.userId, dto);
    return this.toDto(updated);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/cancel')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Cancel contract (client/provider)' })
  @ApiParam({ name: 'id', required: true })
  @ApiOkResponse({ type: ContractDto })
  @ApiErrors({ conflict: false })
  async cancel(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: CancelContractDto,
  ): Promise<ContractDto> {
    const updated = await this.contracts.cancel(id, user.userId, dto);
    return this.toDto(updated);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/complete')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Complete contract (client/provider)' })
  @ApiParam({ name: 'id', required: true })
  @ApiOkResponse({ type: ContractDto })
  @ApiErrors({ conflict: false })
  async complete(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string): Promise<ContractDto> {
    const updated = await this.contracts.complete(id, user.userId);
    return this.toDto(updated);
  }
}
