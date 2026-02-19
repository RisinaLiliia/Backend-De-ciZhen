// src/modules/legal/legal.controller.ts
import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiPublicErrors } from '../../common/swagger/api-errors.decorator';
import { readFileSync } from 'fs';
import { resolve } from 'path';

@ApiTags('legal')
@Controller('legal')
export class LegalController {
  private getLegalDocsDir(): string {
    return process.env.LEGAL_DOCS_DIR?.trim() || resolve(process.cwd(), 'legal');
  }

  private readDoc(filename: string): string {
    const p = resolve(this.getLegalDocsDir(), filename);
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
