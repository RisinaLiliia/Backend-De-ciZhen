import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AppRole } from '../users/schemas/user.schema';
import { PresenceService } from './presence.service';
import { UsersService } from '../users/users.service';
import { PresencePingResponseDto } from './dto/presence-ping-response.dto';
import { ApiErrors } from '../../common/swagger/api-errors.decorator';

type CurrentUserPayload = { userId: string; role: AppRole; sessionId?: string };

@ApiTags('presence')
@Controller('presence')
export class PresenceController {
  constructor(
    private readonly presence: PresenceService,
    private readonly users: UsersService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post('ping')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update presence (ping)' })
  @ApiOkResponse({ type: PresencePingResponseDto })
  @ApiErrors({ conflict: false, notFound: false })
  async ping(@CurrentUser() user: CurrentUserPayload): Promise<PresencePingResponseDto> {
    await this.presence.markOnline(user.userId);
    await this.presence.touchLastSeen(user.userId);
    const u = await this.users.findById(user.userId);
    return { ok: true, lastSeenAt: u.lastSeenAt ?? new Date() };
  }
}
