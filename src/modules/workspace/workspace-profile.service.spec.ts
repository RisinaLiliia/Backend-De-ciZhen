import { Test } from '@nestjs/testing';

import { AuthService } from '../auth/auth.service';
import { CatalogServicesService } from '../catalog/services/services.service';
import { CitiesService } from '../catalog/cities/cities.service';
import { ProvidersService } from '../providers/providers.service';
import { UploadsService } from '../uploads/uploads.service';
import { UsersService } from '../users/users.service';
import { WorkspaceProfileService } from './workspace-profile.service';

describe('WorkspaceProfileService', () => {
  const authMock = { register: jest.fn() };
  const usersMock = { findById: jest.fn(), updateMe: jest.fn() };
  const providersMock = {
    getByUserId: jest.fn(),
    getOrCreateMyProfile: jest.fn(),
    updateMyProfile: jest.fn(),
  };
  const uploadsMock = { uploadImage: jest.fn() };
  const citiesMock = { getById: jest.fn(), findActiveByLabel: jest.fn() };
  const catalogMock = {
    getServiceByKey: jest.fn(),
    getCategoryByKey: jest.fn(),
    listServices: jest.fn(),
  };

  let service: WorkspaceProfileService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        WorkspaceProfileService,
        { provide: AuthService, useValue: authMock },
        { provide: UsersService, useValue: usersMock },
        { provide: ProvidersService, useValue: providersMock },
        { provide: UploadsService, useValue: uploadsMock },
        { provide: CitiesService, useValue: citiesMock },
        { provide: CatalogServicesService, useValue: catalogMock },
      ],
    }).compile();

    service = moduleRef.get(WorkspaceProfileService);
  });

  it('builds a unified profile response', async () => {
    usersMock.findById.mockResolvedValue({
      name: 'Liliia',
      email: 'liliia@example.com',
      city: 'Berlin',
      phone: '+49123',
      bio: 'Customer bio',
      avatar: { url: 'https://cdn/u.png' },
    });
    providersMock.getByUserId.mockResolvedValue({
      displayName: 'Anna Cleaner',
      bio: 'Provider bio',
      cityId: 'city-1',
      serviceKeys: ['home_cleaning'],
      basePrice: 40,
      status: 'active',
      isBlocked: false,
    });
    catalogMock.listServices.mockResolvedValue([{ key: 'home_cleaning', categoryKey: 'cleaning' }]);

    const result = await service.getProfile('user-1');

    expect(result).toMatchObject({
      common: { name: 'Liliia', email: 'liliia@example.com', city: 'Berlin', phone: '+49123' },
      customer: { bio: 'Customer bio' },
      provider: {
        displayName: 'Anna Cleaner',
        selectedCategoryKey: 'cleaning',
        selectedServiceKey: 'home_cleaning',
        serviceKeys: ['home_cleaning'],
        basePrice: 40,
      },
    });
  });

  it('saves auth profile through one server-owned flow', async () => {
    usersMock.updateMe.mockResolvedValue({});
    providersMock.getOrCreateMyProfile.mockResolvedValue({});
    providersMock.updateMyProfile.mockResolvedValue({});
    citiesMock.findActiveByLabel.mockResolvedValue({ _id: { toString: () => 'city-1' } });
    catalogMock.getServiceByKey.mockResolvedValue({ key: 'home_cleaning', categoryKey: 'cleaning' });
    usersMock.findById.mockResolvedValue({
      name: 'Liliia',
      email: 'liliia@example.com',
      city: 'Berlin',
      phone: '+49123',
      bio: 'Customer bio',
      avatar: { url: 'https://cdn/u.png' },
    });
    providersMock.getByUserId.mockResolvedValue({
      displayName: 'Anna Cleaner',
      bio: 'Provider bio',
      cityId: 'city-1',
      serviceKeys: ['home_cleaning'],
      basePrice: 55,
      status: 'active',
      isBlocked: false,
    });
    catalogMock.listServices.mockResolvedValue([{ key: 'home_cleaning', categoryKey: 'cleaning' }]);

    await service.saveProfile('user-1', {
      name: 'Liliia Updated',
      city: 'Berlin',
      phone: '+49111',
      providerDisplayName: 'Anna Cleaner',
      providerBio: 'Provider bio',
      providerServiceKey: 'home_cleaning',
      providerBasePrice: '55',
    });

    expect(usersMock.updateMe).toHaveBeenCalledWith('user-1', expect.objectContaining({
      name: 'Liliia Updated',
      city: 'Berlin',
      phone: '+49111',
    }));
    expect(providersMock.updateMyProfile).toHaveBeenCalledWith('user-1', expect.objectContaining({
      displayName: 'Anna Cleaner',
      bio: 'Provider bio',
      cityId: 'city-1',
      serviceKeys: ['home_cleaning'],
      basePrice: 55,
    }));
  });

  it('registers guest profile and resolves provider service keys on the server', async () => {
    authMock.register.mockResolvedValue({
      user: { id: 'user-1', name: 'Liliia', email: 'liliia@example.com', role: 'provider' },
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresIn: 900,
    });
    citiesMock.getById.mockResolvedValue({ _id: { toString: () => 'city-1' }, name: 'Berlin', key: 'berlin' });
    catalogMock.getCategoryByKey.mockResolvedValue({ key: 'cleaning' });
    catalogMock.listServices.mockResolvedValue([
      { key: 'home_cleaning', categoryKey: 'cleaning' },
      { key: 'office_cleaning', categoryKey: 'cleaning' },
    ]);
    usersMock.updateMe.mockResolvedValue({});
    providersMock.getOrCreateMyProfile.mockResolvedValue({});
    providersMock.updateMyProfile.mockResolvedValue({});

    const result = await service.registerProfile({
      viewerMode: 'provider',
      name: 'Liliia',
      email: 'liliia@example.com',
      password: 'Password1!',
      cityId: 'city-1',
      acceptPrivacyPolicy: true,
      providerCategoryKey: 'cleaning',
      providerBasePrice: '40',
    });

    expect(result.accessToken).toBe('access');
    expect(providersMock.updateMyProfile).toHaveBeenCalledWith('user-1', expect.objectContaining({
      cityId: 'city-1',
      serviceKeys: ['home_cleaning', 'office_cleaning'],
      basePrice: 40,
    }));
  });
});
