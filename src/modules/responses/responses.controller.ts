import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AppRole } from '../users/schemas/user.schema';
import { ApiErrors } from '../../common/swagger/api-errors.decorator';
import { ResponsesService } from './responses.service';
import { CreateResponseDto } from './dto/create-response.dto';
import { ResponseDto } from './dto/response.dto';
import { AcceptResponseResultDto } from './dto/accept-response.dto';
import { ForbiddenException } from '@nestjs/common';

type CurrentUserPayload = { userId: string; role: AppRole; sessionId?: string };

@ApiTags('responses')
@Controller('responses')
export class ResponsesController {
  constructor(private readonly responses: ResponsesService) {}

  private toDto(r: any): ResponseDto {
    return {
      id: r._id.toString(),
      requestId: r.requestId,
      providerUserId: r.providerUserId,
      clientUserId: r.clientUserId,
      status: r.status,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Provider: respond to a request' })
  @ApiCreatedResponse({ type: ResponseDto })
  @ApiErrors({ notFound: true, conflict: true })
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateResponseDto,
  ): Promise<ResponseDto> {
    if (user.role !== 'provider' && user.role !== 'admin') {
      throw new ForbiddenException('Access denied');
    }

    const created = await this.responses.createForProvider(user.userId, dto.requestId);
    return this.toDto(created);
  }

  @UseGuards(JwtAuthGuard)
  @Get('my')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Provider: list my responses' })
  @ApiOkResponse({ type: ResponseDto, isArray: true })
  @ApiErrors({ conflict: false, notFound: false })
  async my(@CurrentUser() user: CurrentUserPayload): Promise<ResponseDto[]> {
    if (user.role !== 'provider' && user.role !== 'admin') {
      throw new ForbiddenException('Access denied');
    }

    const items = await this.responses.listMy(user.userId);
    return items.map((x) => this.toDto(x));
  }

  @UseGuards(JwtAuthGuard)
  @Get('request/:requestId')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Client: list responses for my request' })
  @ApiOkResponse({ type: ResponseDto, isArray: true })
  @ApiErrors({ conflict: false })
  async listForRequest(
    @CurrentUser() user: CurrentUserPayload,
    @Param('requestId') requestId: string,
  ): Promise<ResponseDto[]> {
    if (user.role !== 'client' && user.role !== 'admin') {
      throw new ForbiddenException('Access denied');
    }

    const items = await this.responses.listByRequestForClient(user.userId, requestId);
    return items.map((x) => this.toDto(x));
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/accept')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Client: accept provider response (match)' })
  @ApiOkResponse({ type: AcceptResponseResultDto })
  @ApiErrors({ conflict: false })
  async accept(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') responseId: string,
  ): Promise<AcceptResponseResultDto> {
    if (user.role !== 'client' && user.role !== 'admin') {
      throw new ForbiddenException('Access denied');
    }

    await this.responses.acceptForClient(user.userId, responseId);
    return { ok: true, acceptedResponseId: responseId };
  }
}
