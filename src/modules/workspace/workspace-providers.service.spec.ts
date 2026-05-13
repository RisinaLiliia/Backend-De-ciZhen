import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';

import { CatalogServicesService } from '../catalog/services/services.service';
import { CitiesService } from '../catalog/cities/cities.service';
import { ProviderProfile } from '../providers/schemas/provider-profile.schema';
import { ProviderAvailability } from '../availability/schemas/provider-availability.schema';
import { WorkspaceProvidersService } from './workspace-providers.service';

describe('WorkspaceProvidersService (unit)', () => {
  let service: WorkspaceProvidersService;
  let nowSpy: jest.SpyInstance<number, []>;

  const providerExecMock = jest.fn();
  const providerSortMock = jest.fn(() => ({ exec: providerExecMock }));
  const providerFindMock = jest.fn(() => ({ sort: providerSortMock }));
  const providerModelMock = {
    find: providerFindMock,
  };

  const availabilityExecMock = jest.fn();
  const availabilitySelectMock = jest.fn(() => ({ exec: availabilityExecMock }));
  const availabilityFindMock = jest.fn(() => ({ select: availabilitySelectMock }));
  const availabilityModelMock = {
    find: availabilityFindMock,
  };

  const catalogServicesMock = {
    listServices: jest.fn(),
  };

  const citiesMock = {
    listByIds: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    nowSpy = jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-05-12T12:00:00.000Z').getTime());

    const moduleRef = await Test.createTestingModule({
      providers: [
        WorkspaceProvidersService,
        { provide: getModelToken(ProviderProfile.name), useValue: providerModelMock },
        { provide: getModelToken(ProviderAvailability.name), useValue: availabilityModelMock },
        { provide: CatalogServicesService, useValue: catalogServicesMock },
        { provide: CitiesService, useValue: citiesMock },
      ],
    }).compile();

    service = moduleRef.get(WorkspaceProvidersService);
  });

  afterEach(() => {
    nowSpy.mockRestore();
  });

  it('returns a contract-driven providers rail payload', async () => {
    const providerA = {
      id: 'provider-1',
      userId: 'user-1',
      displayName: 'Anna K.',
      cityId: 'city-1',
      serviceKeys: ['window_cleaning'],
      ratingAvg: 4.9,
      ratingCount: 18,
      completedJobs: 22,
      updatedAt: new Date('2026-05-10T08:00:00.000Z'),
    };
    const providerB = {
      id: 'provider-2',
      userId: 'user-2',
      displayName: 'Mark T.',
      cityId: 'city-1',
      serviceKeys: ['window_cleaning'],
      ratingAvg: 4.7,
      ratingCount: 9,
      completedJobs: 14,
      updatedAt: new Date('2026-05-09T08:00:00.000Z'),
    };

    providerExecMock.mockResolvedValue([providerA, providerB]);
    availabilityExecMock.mockResolvedValue([{ providerUserId: 'user-1' }]);
    catalogServicesMock.listServices.mockResolvedValue([
      { key: 'window_cleaning', name: 'Window cleaning', i18n: { de: 'Fensterreinigung', en: 'Window cleaning' } },
    ]);
    citiesMock.listByIds.mockResolvedValue([
      { _id: 'city-1', name: 'Berlin', i18n: { de: 'Berlin', en: 'Berlin' } },
    ]);

    const result = await service.getProvidersOverview(
      {
        cityId: 'city-1',
        subcategoryKey: 'window_cleaning',
        period: '30d',
      },
      'de-DE',
    );

    expect(result.section).toBe('providers');
    expect(result.summary.items).toEqual([
      {
        key: 'all',
        label: 'Alle',
        value: 2,
        helper: 'Gesamter Anbieterpool',
        tone: 'all',
      },
      {
        key: 'available',
        label: 'Verfügbar',
        value: 1,
        helper: 'Aktive Verfügbarkeit',
        tone: 'attention',
      },
      {
        key: 'top_rated',
        label: 'Top bewertet',
        value: 1,
        helper: 'Starke Bewertungen',
        tone: 'execution',
      },
      {
        key: 'trusted',
        label: 'Mit Referenzen',
        value: 2,
        helper: 'Jobs und Reviews sichtbar',
        tone: 'completed',
      },
    ]);
    expect(result.decisionPanel.primaryAction).toEqual({
      label: 'Anbieter prüfen',
      href: '/workspace?section=providers&cityId=city-1&subcategoryKey=window_cleaning&period=30d',
      targetFilter: 'recommended',
    });
    expect(result.decisionPanel.queue).toEqual([
      expect.objectContaining({
        providerId: 'provider-1',
        actionType: 'contact_provider',
        actionPriorityLevel: 'high',
        categoryLabel: 'Fensterreinigung',
        cityLabel: 'Berlin',
      }),
      expect.objectContaining({
        providerId: 'provider-2',
        actionType: 'review_trust',
        actionPriorityLevel: 'medium',
        categoryLabel: 'Fensterreinigung',
        cityLabel: 'Berlin',
      }),
    ]);
  });
});
