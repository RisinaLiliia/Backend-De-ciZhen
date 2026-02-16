import { ApiProperty } from '@nestjs/swagger';

export class DeleteMyRequestResponseDto {
  @ApiProperty({ example: true })
  ok: true;

  @ApiProperty({ example: '65f0c1a2b3c4d5e6f7a8b9c1' })
  deletedRequestId: string;
}
