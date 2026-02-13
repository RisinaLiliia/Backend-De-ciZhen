// src/modules/bookings/bookings.controller.ts
import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AppRole } from '../users/schemas/user.schema';
import { ApiErrors } from '../../common/swagger/api-errors.decorator';
import { BookingsService } from './bookings.service';
import { BookingDto } from './dto/booking.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { BookingsQueryDto } from './dto/bookings-query.dto';
import { RescheduleBookingDto } from './dto/reschedule-booking.dto';
import { BookingHistoryDto } from './dto/booking-history.dto';
import { CreateBookingDto } from './dto/create-booking.dto';


type CurrentUserPayload = { userId: string; role: AppRole; sessionId?: string };

@ApiTags('bookings')
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  private toDto(b: any, viewer?: CurrentUserPayload): BookingDto {
    const role = viewer?.role;
    const isAdmin = role === 'admin';
    const providerUserId = isAdmin || role === 'provider' ? b.providerUserId ?? null : null;
    const clientId = isAdmin || role === 'client' ? b.clientId ?? null : null;

    return {
      id: b._id.toString(),
      requestId: b.requestId,
      offerId: b.offerId,
      providerUserId,
      clientId,
      startAt: new Date(b.startAt).toISOString(),
      durationMin: Number(b.durationMin ?? 60),
      endAt: new Date(b.endAt).toISOString(),
      status: b.status,
      cancelledAt: b.cancelledAt ? new Date(b.cancelledAt).toISOString() : null,
      cancelledBy: b.cancelledBy ?? null,
      cancelReason: b.cancelReason ?? null,
      rescheduledFromId: b.rescheduledFromId ?? null,
      rescheduledToId: b.rescheduledToId ?? null,
      rescheduledAt: b.rescheduledAt ? new Date(b.rescheduledAt).toISOString() : null,
      rescheduleReason: b.rescheduleReason ?? null,

    };
  }


  @UseGuards(JwtAuthGuard)
  @Get('my')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Client/Provider: list my bookings (UI-ready)' })
  @ApiOkResponse({ type: BookingDto, isArray: true })
  @ApiErrors({ conflict: false })
  async my(
    @CurrentUser() user: CurrentUserPayload,
    @Query() q: BookingsQueryDto,
  ): Promise<BookingDto[]> {
    if (user.role !== 'client' && user.role !== 'provider' && user.role !== 'admin') {
      throw new ForbiddenException('Access denied');
    }

    if (user.role === 'admin') {
      throw new ForbiddenException('Admin cannot use /bookings/my without explicit mode');
    }

    const filters = this.bookings.normalizeFilters(q);

    const items =
      user.role === 'client'
        ? await this.bookings.listMyClient(user.userId, filters)
        : await this.bookings.listMyProvider(user.userId, filters);

    return items.map((x) => this.toDto(x, user));
  }
  
  
  @UseGuards(JwtAuthGuard)
  @Get(':id/history')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Client/Provider/Admin: booking history (reschedule chain)' })
  @ApiOkResponse({ type: BookingHistoryDto })
  @ApiErrors({ conflict: false })
  async history(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') bookingId: string,
  ): Promise<BookingHistoryDto> {
    if (user.role !== 'client' && user.role !== 'provider' && user.role !== 'admin') {
      throw new ForbiddenException('Access denied');
    }

    const res = await this.bookings.getHistory({ userId: user.userId, role: user.role as any }, bookingId);

    return {
      rootId: res.rootId,
      requestedId: res.requestedId,
      latestId: res.latestId,
      currentIndex: res.currentIndex,
      items: res.items.map((x) => this.toDto(x, user)),
    };
  }



  @UseGuards(JwtAuthGuard)
  @Patch(':id/cancel')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Cancel booking (client/provider/admin)' })
  @ApiOkResponse({ schema: { example: { ok: true, bookingId: '507f1f77bcf86cd799439011', status: 'cancelled' } } })
  @ApiErrors({ conflict: false })
  async cancel(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') bookingId: string,
    @Body() dto: CancelBookingDto,
  ) {
    if (user.role !== 'client' && user.role !== 'provider' && user.role !== 'admin') {
      throw new ForbiddenException('Access denied');
    }

    if (user.role === 'admin') {
      await this.bookings.cancelByAdmin(user.userId, bookingId, dto.reason);
      return { ok: true, bookingId, status: 'cancelled' };
    }

    if (user.role === 'provider') {
      await this.bookings.cancelByProvider(user.userId, bookingId, dto.reason);
      return { ok: true, bookingId, status: 'cancelled' };
    }

    await this.bookings.cancelByClient(user.userId, bookingId, dto.reason);
    return { ok: true, bookingId, status: 'cancelled' };
  }





    @UseGuards(JwtAuthGuard)
  @Patch(':id/reschedule')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Client/Provider: reschedule booking (creates new booking, cancels old)' })
  @ApiOkResponse({ type: BookingDto })
  @ApiErrors({ conflict: true })
  async reschedule(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') bookingId: string,
    @Body() dto: RescheduleBookingDto,
  ): Promise<BookingDto> {
    if (user.role !== 'client' && user.role !== 'provider' && user.role !== 'admin') {
      throw new ForbiddenException('Access denied');
    }

    const created = await this.bookings.reschedule(
      { userId: user.userId, role: user.role as any },
      bookingId,
      { startAt: dto.startAt, durationMin: dto.durationMin, reason: dto.reason },
    );

    return this.toDto(created, user);
  }

    @UseGuards(JwtAuthGuard)
  @Patch(':id/complete')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Provider/Admin: mark booking completed' })
  @ApiOkResponse({ schema: { example: { ok: true, bookingId: '507f1f77bcf86cd799439011', status: 'completed' } } })
  @ApiErrors({ conflict: false })
  async complete(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') bookingId: string,
  ) {
    if (user.role !== 'provider' && user.role !== 'admin') {
      throw new ForbiddenException('Access denied');
    }
    await this.bookings.complete({ userId: user.userId, role: user.role as any }, bookingId);
    return { ok: true, bookingId, status: 'completed' };
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Client: create booking (must match availability slot)' })
  @ApiCreatedResponse({ type: BookingDto })
  @ApiErrors({ conflict: true })
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateBookingDto,
  ): Promise<BookingDto> {
    if (user.role !== 'client' && user.role !== 'admin') {
      throw new ForbiddenException('Access denied');
    }

    if (user.role === 'admin') {
      throw new ForbiddenException('Admin create booking is not implemented');
    }

    const created = await this.bookings.createByClient(user.userId, {
      requestId: dto.requestId,
      offerId: dto.offerId,
      providerUserId: dto.providerUserId,
      startAt: dto.startAt,
      durationMin: dto.durationMin,
      note: dto.note,
    });

    return this.toDto(created, user);
  }
}
