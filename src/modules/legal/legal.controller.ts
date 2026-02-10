// src/modules/legal/legal.controller.ts
import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiPublicErrors } from '../../common/swagger/api-errors.decorator';
import { readFileSync } from 'fs';
import { resolve } from 'path';

@ApiTags('legal')
@Controller('legal')
export class LegalController {
  private readDoc(filename: string): string {
    const p = resolve(process.cwd(), 'legal', filename);
    return readFileSync(p, 'utf8');
  }

  @Get('privacy')
  @ApiOperation({ summary: 'Privacy Policy (GDPR/DE)' })
  @ApiSecurity({} as any)
  @ApiOkResponse({ schema: { type: 'string' } })
  @ApiPublicErrors()
  getPrivacyPolicy(): string {
    return this.readDoc('privacy-policy.md');
  }

  @Get('cookies')
  @ApiOperation({ summary: 'Cookie Notice (strictly necessary cookies)' })
  @ApiSecurity({} as any)
  @ApiOkResponse({ schema: { type: 'string' } })
  @ApiPublicErrors()
  getCookieNotice(): string {
    return this.readDoc('cookie-notice.md');
  }
}
