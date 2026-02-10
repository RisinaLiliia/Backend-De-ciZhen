// src/modules/geo/geo.controller.spec.ts
import { Test } from '@nestjs/testing';
import { GeoController } from './geo.controller';
import { GeoService } from './geo.service';

describe('GeoController (unit)', () => {
  let controller: GeoController;

  const svcMock = {
    autocomplete: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      controllers: [GeoController],
      providers: [{ provide: GeoService, useValue: svcMock }],
    }).compile();

    controller = moduleRef.get(GeoController);
  });

  it('autocomplete maps response', async () => {
    svcMock.autocomplete.mockResolvedValue([
      {
        label: 'Hauptbahnhof, 60329 Frankfurt am Main, Germany',
        lat: 50.1109,
        lng: 8.6821,
        city: 'Frankfurt am Main',
        postalCode: '60329',
        countryCode: 'DE',
      },
    ]);

    const res = await controller.autocomplete({ query: '60329', countryCode: 'DE', limit: 5 } as any);

    expect(svcMock.autocomplete).toHaveBeenCalledWith({ query: '60329', countryCode: 'DE', limit: 5 });
    expect(res.items.length).toBe(1);
    expect(res.items[0]).toMatchObject({ city: 'Frankfurt am Main', countryCode: 'DE' });
  });
});
