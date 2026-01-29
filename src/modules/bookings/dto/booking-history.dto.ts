import { ApiProperty } from '@nestjs/swagger';
import { BookingDto } from './booking.dto';

export class BookingHistoryDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011', description: 'Root booking id (first in chain)' })
  rootId: string;

  @ApiProperty({ example: '507f1f77bcf86cd799439012', description: 'Requested booking id (the one you asked history for)' })
  requestedId: string;

  @ApiProperty({ example: '507f1f77bcf86cd799439013', description: 'Latest booking id (last in chain)' })
  latestId: string;

  @ApiProperty({ example: 1, description: 'Index of requestedId in items (0..n-1). -1 if not found' })
  currentIndex: number;

  @ApiProperty({ type: BookingDto, isArray: true, description: 'Ordered from oldest -> newest' })
  items: BookingDto[];
}

