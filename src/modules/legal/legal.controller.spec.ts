// src/modules/legal/legal.controller.spec.ts
import { Test } from '@nestjs/testing';
import { LegalController } from './legal.controller';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

describe('LegalController (unit)', () => {
  let controller: LegalController;

  beforeAll(() => {
    const dir = resolve(process.cwd(), 'legal');
    mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(dir, 'privacy-policy.md'), 'privacy');
    writeFileSync(resolve(dir, 'cookie-notice.md'), 'cookies');
  });

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [LegalController],
    }).compile();

    controller = moduleRef.get(LegalController);
  });

  it('returns privacy policy', () => {
    expect(controller.getPrivacyPolicy()).toBe('privacy');
  });

  it('returns cookie notice', () => {
    expect(controller.getCookieNotice()).toBe('cookies');
  });
});
