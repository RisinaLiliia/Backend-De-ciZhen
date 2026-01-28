// src/modules/requests/requests.controller.ts
import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiPublicErrors } from '../../common/swagger/api-errors.decorator';
import { RequestsService } from './requests.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { RequestResponseDto } from './dto/request-response.dto';
import { RequestsPublicQueryDto } from './dto/requests-public-query.dto';

@ApiTags('requests')
@Controller('requests')
export class RequestsController {
  constructor(private readonly requests: RequestsService) {}

  private toDto(doc: any): RequestResponseDto {
    return {
      id: doc._id.toString(),
      serviceKey: doc.serviceKey,
      cityId: doc.cityId,
      propertyType: doc.propertyType,
      area: doc.area,
      preferredDate: doc.preferredDate,
      isRecurring: doc.isRecurring,
      comment: doc.comment ?? null,
      status: doc.status,
      createdAt: doc.createdAt,
    };
  }

  @Post()
  @ApiOperation({
    summary: 'Create public request (no auth)',
    description: 'Creates a request and publishes it immediately (MVP).',
  })
  @ApiCreatedResponse({ type: RequestResponseDto })
  @ApiPublicErrors()
  async create(@Body() dto: CreateRequestDto): Promise<RequestResponseDto> {
    const created = await this.requests.createPublic(dto);
    return this.toDto(created);
  }

  @Get('public')
  @ApiOperation({
    summary: 'List published requests (for providers)',
    description: 'Returns published requests. Optional filters: cityId, serviceKey.',
  })
  @ApiOkResponse({ type: RequestResponseDto, isArray: true })
  @ApiPublicErrors()
  async listPublic(@Query() q: RequestsPublicQueryDto): Promise<RequestResponseDto[]> {
    const items = await this.requests.listPublic({ cityId: q.cityId, serviceKey: q.serviceKey });
    return items.map((x) => this.toDto(x));
  }
}
