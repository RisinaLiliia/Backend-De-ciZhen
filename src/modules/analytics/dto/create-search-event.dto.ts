import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export const SEARCH_EVENT_TARGETS = ['request', 'provider'] as const;
export type SearchEventTarget = (typeof SEARCH_EVENT_TARGETS)[number];

export const SEARCH_EVENT_SOURCES = [
  'workspace_requests',
  'workspace_providers',
  'workspace_filters',
  'home_quick_search',
  'other',
] as const;
export type SearchEventSource = (typeof SEARCH_EVENT_SOURCES)[number];

export class CreateSearchEventDto {
  @ApiProperty({
    enum: SEARCH_EVENT_TARGETS,
    example: 'request',
    description: 'What user is searching for: jobs (request) or providers (provider).',
  })
  @IsIn(SEARCH_EVENT_TARGETS)
  target: SearchEventTarget;

  @ApiPropertyOptional({
    enum: SEARCH_EVENT_SOURCES,
    example: 'workspace_filters',
    description: 'UI source where search interaction happened.',
  })
  @IsOptional()
  @IsIn(SEARCH_EVENT_SOURCES)
  source?: SearchEventSource;

  @ApiPropertyOptional({ example: 'berlin-city' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  cityId?: string;

  @ApiPropertyOptional({ example: 'Berlin' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  cityName?: string;

  @ApiPropertyOptional({ example: 'cleaning' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  categoryKey?: string;

  @ApiPropertyOptional({ example: 'home_cleaning' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  subcategoryKey?: string;

  @ApiPropertyOptional({
    example: 'Fensterreinigung',
    description: 'Optional free-text query (search input).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  query?: string;

  @ApiPropertyOptional({
    example: 'session-xyz',
    description: 'Client-side session id/fingerprint if available.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  sessionId?: string;
}

export class SearchEventResponseDto {
  @ApiProperty({ example: true })
  accepted: boolean;

  @ApiProperty({
    example: false,
    description: 'True when event was ignored due to dedupe window.',
  })
  deduped: boolean;

  @ApiProperty({ example: '2026-03-10T14:30:00.000Z' })
  bucketStart: string;

  @ApiProperty({ example: '2026-03-10T14:30:02.000Z' })
  recordedAt: string;
}
