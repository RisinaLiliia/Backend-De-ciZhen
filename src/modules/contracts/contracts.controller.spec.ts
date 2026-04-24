import { Test } from '@nestjs/testing';

import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';

describe('ContractsController (unit)', () => {
  let controller: ContractsController;

  const serviceMock = {
    listMy: jest.fn(),
    getByIdForUser: jest.fn(),
    confirmByClient: jest.fn(),
    cancel: jest.fn(),
    complete: jest.fn(),
    toContractDtos: jest.fn(),
    toContractDtoSingle: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      controllers: [ContractsController],
      providers: [{ provide: ContractsService, useValue: serviceMock }],
    }).compile();

    controller = moduleRef.get(ContractsController);
  });

  it('GET /contracts/my delegates dto enrichment to the service', async () => {
    const rawContracts = [{ _id: { toString: () => 'contract-1' } }];
    const enrichedContracts = [{ id: 'contract-1', requestId: 'req-1' }];

    serviceMock.listMy.mockResolvedValue(rawContracts);
    serviceMock.toContractDtos.mockResolvedValue(enrichedContracts);

    const result = await controller.my(
      { userId: 'client-1', role: 'client' } as any,
      { role: 'client', status: 'confirmed', limit: 10, offset: 5 } as any,
    );

    expect(serviceMock.listMy).toHaveBeenCalledWith('client-1', {
      role: 'client',
      status: 'confirmed',
      limit: 10,
      offset: 5,
    });
    expect(serviceMock.toContractDtos).toHaveBeenCalledWith(rawContracts);
    expect(result).toBe(enrichedContracts);
  });

  it('GET /contracts/:id delegates single dto enrichment to the service', async () => {
    const rawContract = { _id: { toString: () => 'contract-2' } };
    const enrichedContract = { id: 'contract-2', requestId: 'req-2' };

    serviceMock.getByIdForUser.mockResolvedValue(rawContract);
    serviceMock.toContractDtoSingle.mockResolvedValue(enrichedContract);

    const result = await controller.getById(
      { userId: 'client-1', role: 'client' } as any,
      'contract-2',
    );

    expect(serviceMock.getByIdForUser).toHaveBeenCalledWith('contract-2', 'client-1');
    expect(serviceMock.toContractDtoSingle).toHaveBeenCalledWith(rawContract);
    expect(result).toBe(enrichedContract);
  });
});
