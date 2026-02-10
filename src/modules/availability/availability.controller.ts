// src/modules/availability/availability.controller.ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AppRole } from '../users/schemas/user.schema';
import { ApiErrors, ApiPublicErrors } from '../../common/swagger/api-errors.decorator';
import { AvailabilityService } from './availability.service';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';
import { SlotDto } from './dto/slot.dto';
import { SlotsQueryDto } from './dto/slots-query.dto';
import { ForbiddenException } from '@nestjs/common';
import { CreateBlackoutDto } from './dto/create-blackout.dto';
import { BlackoutDto } from './dto/blackout.dto';

type CurrentUserPayload = { userId: string; role: AppRole; sessionId?: string };

@ApiTags('availability')
@Controller('availability')
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Provider: update my availability settings + weekly schedule' })
  @ApiOkResponse({ description: 'Updated' })
  @ApiErrors({ conflict: false })
  async updateMy(@CurrentUser() user: CurrentUserPayload, @Body() dto: UpdateAvailabilityDto) {
    if (user.role !== 'provider' && user.role !== 'admin') {
      throw new ForbiddenException('Access denied');
    }
    await this.availability.updateMy(user.userId, dto as any);
    return { ok: true };
  }

  @Get('providers/:providerUserId/slots')
  @ApiOperation({
    summary: 'Public: list provider slots for UI (DST-safe)',
    description:
      'Generates slots in provider TZ with DST support. Considers blackouts and matched/closed requests. Max range 14 days.',
  })
  @ApiSecurity({} as any)
  @ApiOkResponse({ type: SlotDto, isArray: true })
  @ApiPublicErrors()
  async listSlots(
    @Param('providerUserId') providerUserId: string,
    @Query() q: SlotsQueryDto,
  ): Promise<SlotDto[]> {
    return this.availability.getSlots(providerUserId, q.from, q.to, q.tz);
  }


  private blackoutToDto(b: any): BlackoutDto {
    return {
      id: b._id.toString(),
      startAt: new Date(b.startAt).toISOString(),
      endAt: new Date(b.endAt).toISOString(),
      reason: b.reason ?? null,
      isActive: !!b.isActive,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/blackouts')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Provider: list my blackouts' })
  @ApiOkResponse({ type: BlackoutDto, isArray: true })
  @ApiErrors({ conflict: false })
  async myBlackouts(@CurrentUser() user: CurrentUserPayload): Promise<BlackoutDto[]> {
    if (user.role !== 'provider' && user.role !== 'admin') throw new ForbiddenException('Access denied');
    const items = await this.availability.listMyBlackouts(user.userId);
    return items.map((x) => this.blackoutToDto(x));
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/blackouts')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Provider: create blackout (UTC)' })
  @ApiCreatedResponse({ type: BlackoutDto })
  @ApiErrors({ conflict: false })
  async addBlackout(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateBlackoutDto,
  ): Promise<BlackoutDto> {
    if (user.role !== 'provider' && user.role !== 'admin') throw new ForbiddenException('Access denied');

    const created = await this.availability.addMyBlackout(user.userId, {
      startAt: new Date(dto.startAt),
      endAt: new Date(dto.endAt),
      reason: dto.reason,
      isActive: dto.isActive,
    });

    return this.blackoutToDto(created);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('me/blackouts/:id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Provider: remove blackout' })
  @ApiOkResponse({ schema: { example: { ok: true } } })
  @ApiErrors({ conflict: false })
  async removeBlackout(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    if (user.role !== 'provider' && user.role !== 'admin') throw new ForbiddenException('Access denied');
    await this.availability.removeMyBlackout(user.userId, id);
    return { ok: true };
  }
}
