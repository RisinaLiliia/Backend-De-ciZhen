import { ApiProperty } from '@nestjs/swagger';

export class ResponseDto {
  @ApiProperty({ example: '66f0c1a2b3c4d5e6f7a8b9ff' })
  id: string;

  @ApiProperty({ example: '65f0c1a2b3c4d5e6f7a8b9c1' })
  requestId: string;

  @ApiProperty({ example: '64f0c1a2b3c4d5e6f7a8b9c9' })
  providerUserId: string;

  @ApiProperty({ example: '64f0c1a2b3c4d5e6f7a8b9a1' })
  clientUserId: string;

  @ApiProperty({ enum: ['pending', 'accepted', 'rejected'], example: 'pending' })
  status: 'pending' | 'accepted' | 'rejected';

  @ApiProperty({ example: '2026-01-28T10:20:30.123Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-01-28T10:20:30.123Z' })
  updatedAt: Date;
}
