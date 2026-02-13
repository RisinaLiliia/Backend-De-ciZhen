// src/modules/favorites/favorites.controller.spec.ts
import { Test } from '@nestjs/testing';
import { FavoritesController } from './favorites.controller';
import { FavoritesService } from './favorites.service';

describe('FavoritesController (unit)', () => {
  let controller: FavoritesController;

  const favoritesMock = {
    add: jest.fn(),
    remove: jest.fn(),
    listByType: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      controllers: [FavoritesController],
      providers: [{ provide: FavoritesService, useValue: favoritesMock }],
    }).compile();

    controller = moduleRef.get(FavoritesController);
  });

  it('addFavorite calls service', async () => {
    favoritesMock.add.mockResolvedValue(undefined);
    const res = await controller.addFavorite({ userId: 'u1', role: 'client' } as any, {
      type: 'request',
      targetId: 'r1',
    } as any);
    expect(favoritesMock.add).toHaveBeenCalledWith('u1', 'request', 'r1');
    expect(res).toEqual({ ok: true });
  });

  it('removeFavorite calls service', async () => {
    favoritesMock.remove.mockResolvedValue(undefined);
    const res = await controller.removeFavorite({ userId: 'u1', role: 'provider' } as any, {
      type: 'provider',
      targetId: 'p1',
    } as any);
    expect(favoritesMock.remove).toHaveBeenCalledWith('u1', 'provider', 'p1');
    expect(res).toEqual({ ok: true });
  });

  it('listFavorites returns service result', async () => {
    favoritesMock.listByType.mockResolvedValue([{ id: 'r1' }]);
    const res = await controller.listFavorites({ userId: 'u1', role: 'client' } as any, {
      type: 'request',
    } as any);
    expect(favoritesMock.listByType).toHaveBeenCalledWith('u1', 'request');
    expect(res).toEqual([{ id: 'r1' }]);
  });
});
