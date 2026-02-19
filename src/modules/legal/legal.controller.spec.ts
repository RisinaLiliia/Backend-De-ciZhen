// src/modules/legal/legal.controller.spec.ts
import { Test } from '@nestjs/testing';
import { LegalController } from './legal.controller';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { resolve } from 'path';
import { tmpdir } from 'os';

describe('LegalController (unit)', () => {
  let controller: LegalController;
  const prevLegalDir = process.env.LEGAL_DOCS_DIR;
  const testLegalDir = resolve(tmpdir(), 'decizhen-legal-test');

  beforeAll(() => {
    process.env.LEGAL_DOCS_DIR = testLegalDir;
    mkdirSync(testLegalDir, { recursive: true });
    writeFileSync(resolve(testLegalDir, 'privacy-policy.md'), 'privacy');
    writeFileSync(resolve(testLegalDir, 'cookie-notice.md'), 'cookies');
  });

  afterAll(() => {
    process.env.LEGAL_DOCS_DIR = prevLegalDir;
    rmSync(testLegalDir, { recursive: true, force: true });
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
