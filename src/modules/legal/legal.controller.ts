// src/modules/legal/legal.controller.ts
import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
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
  @ApiOkResponse({ schema: { type: 'string' } })
  getPrivacyPolicy(): string {
    return this.readDoc('privacy-policy.md');
  }

  @Get('cookies')
  @ApiOperation({ summary: 'Cookie Notice (strictly necessary cookies)' })
  @ApiOkResponse({ schema: { type: 'string' } })
  getCookieNotice(): string {
    return this.readDoc('cookie-notice.md');
  }
}
