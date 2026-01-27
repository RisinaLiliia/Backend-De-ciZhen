// src/modules/catalog/services/services.service.spec.ts
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { CatalogServicesService } from './services.service';
import { Service } from './schemas/service.schema';
import { ServiceCategory } from './schemas/service-category.schema';

describe('CatalogServicesService', () => {
  let svc: CatalogServicesService;

  const serviceModelMock = { find: jest.fn() };
  const categoryModelMock = { find: jest.fn() };

  const execWrap = (value: any) => ({
    sort: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(value) }),
    exec: jest.fn().mockResolvedValue(value),
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        CatalogServicesService,
        { provide: getModelToken(Service.name), useValue: serviceModelMock },
        { provide: getModelToken(ServiceCategory.name), useValue: categoryModelMock },
      ],
    }).compile();

    svc = moduleRef.get(CatalogServicesService);
  });

  it('listCategories returns active categories sorted', async () => {
    categoryModelMock.find.mockReturnValue(execWrap([{ key: 'beauty' }]));
    const res = await svc.listCategories();
    expect(categoryModelMock.find).toHaveBeenCalledWith({ isActive: true });
    expect(res).toHaveLength(1);
  });

  it('listServices without category returns all active', async () => {
    serviceModelMock.find.mockReturnValue(execWrap([{ key: 'haircut_men' }]));
    const res = await svc.listServices();
    expect(serviceModelMock.find).toHaveBeenCalledWith({ isActive: true });
    expect(res).toHaveLength(1);
  });

  it('listServices with category filters by categoryKey', async () => {
    serviceModelMock.find.mockReturnValue(execWrap([{ key: 'haircut_men' }]));
    await svc.listServices('Beauty');
    expect(serviceModelMock.find).toHaveBeenCalledWith({ isActive: true, categoryKey: 'beauty' });
  });
});
