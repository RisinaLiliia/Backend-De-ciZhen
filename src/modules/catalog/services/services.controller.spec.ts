// src/modules/catalog/services/services.controller.spec.ts
import { Test } from '@nestjs/testing';
import { CatalogServicesController } from './services.controller';
import { CatalogServicesService } from './services.service';

describe('CatalogServicesController (unit)', () => {
  let controller: CatalogServicesController;

  const mock = {
    listCategories: jest.fn(),
    listServices: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      controllers: [CatalogServicesController],
      providers: [{ provide: CatalogServicesService, useValue: mock }],
    }).compile();

    controller = moduleRef.get(CatalogServicesController);
  });

  it('categories maps response', async () => {
    mock.listCategories.mockResolvedValue([{ key: 'beauty', name: 'Beauty', sortOrder: 1, isActive: true }]);
    const res = await controller.categories();
    expect(res[0]).toEqual(expect.objectContaining({ key: 'beauty', name: 'Beauty' }));
  });

  it('services maps response and passes category query', async () => {
    mock.listServices.mockResolvedValue([{ key: 'haircut_men', name: 'Men haircut', categoryKey: 'beauty', sortOrder: 1, isActive: true }]);
    const res = await controller.services('beauty');
    expect(mock.listServices).toHaveBeenCalledWith('beauty');
    expect(res[0]).toEqual(expect.objectContaining({ key: 'haircut_men', categoryKey: 'beauty' }));
  });
});
