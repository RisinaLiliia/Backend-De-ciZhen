import {
  GEO_NAMES_DE_STATE_LABELS,
  cityIdentityKey,
  isRetryableMongoError,
  mergeCities,
  parseGeoNamesLine,
  resolveUniqueImportKey,
  shouldInclude,
  toImportedCity,
  withMongoRetry,
} from './import-geonames-cities';

describe('import-geonames-cities', () => {
  it('deduplicates same-name GeoNames rows before persistence', () => {
    const primaryLine =
      '2803489\tZwochau\tZwochau\tCvokhau,Grebehna,Zwochau,Zwochau vald,ci wo hao,Цвохау,茨沃豪\t51.46467\t12.26844\tP\tPPL\tDE\t\t13\t00\t14730\t14730340\t1167\t\t112\tEurope/Berlin\t2025-03-11';
    const duplicateLine =
      '2803490\tZwochau\tZwochau\tGut Zwochau,Zwochau\t51.44009\t12.80792\tP\tPPL\tDE\t\t13\t00\t14729\t14729380\t0\t\t149\tEurope/Berlin\t2025-03-11';

    const primaryRow = parseGeoNamesLine(primaryLine);
    const duplicateRow = parseGeoNamesLine(duplicateLine);

    expect(primaryRow && shouldInclude(primaryRow)).toBe(true);
    expect(duplicateRow && shouldInclude(duplicateRow)).toBe(true);

    const primaryCity = toImportedCity(primaryRow!);
    const duplicateCity = toImportedCity(duplicateRow!);

    expect(primaryCity).not.toBeNull();
    expect(duplicateCity).not.toBeNull();
    expect(cityIdentityKey(primaryCity!)).toBe(cityIdentityKey(duplicateCity!));

    const merged = mergeCities(primaryCity!, duplicateCity!);

    expect(merged.name).toBe('Zwochau');
    expect(merged.sourceId).toBe('2803489');
    expect(merged.population).toBe(1167);
    expect(merged.aliases).toEqual(
      expect.arrayContaining(['Zwochau', 'Gut Zwochau', 'Cvokhau', 'Grebehna', 'Zwochau vald', 'ci wo hao']),
    );
  });

  it('maps GeoNames Germany admin1 codes to the correct state labels', () => {
    expect(GEO_NAMES_DE_STATE_LABELS['04']).toBe('Hamburg');
    expect(GEO_NAMES_DE_STATE_LABELS['05']).toBe('Hessen');
    expect(GEO_NAMES_DE_STATE_LABELS['07']).toBe('Nordrhein-Westfalen');
    expect(GEO_NAMES_DE_STATE_LABELS['10']).toBe('Schleswig-Holstein');
    expect(GEO_NAMES_DE_STATE_LABELS['11']).toBe('Brandenburg');
    expect(GEO_NAMES_DE_STATE_LABELS['16']).toBe('Berlin');
  });

  it('adds a suffix when normalized key collides with another city', async () => {
    const city = toImportedCity(
      parseGeoNamesLine(
        '2811844\tWeißenstein\tWeissenstein\t\t48.95027\t13.14351\tP\tPPL\tDE\t\t02\t092\t09276\t09276138\t0\t\t729\tEurope/Berlin\t2025-03-11',
      )!,
    );

    expect(city).not.toBeNull();

    const cityModel = {
      findOne: jest
        .fn()
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue({
                _id: 'c-existing',
                key: 'weissenstein',
                source: 'geonames',
                sourceId: '2811843',
                name: 'Weissenstein',
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(null),
            }),
          }),
        }),
    };

    const key = await resolveUniqueImportKey({
      cityModel: cityModel as any,
      existing: null,
      city: city!,
      reservedKeys: new Map(),
    });

    expect(key).toBe('weissenstein_2');
  });

  it('retries retryable mongo errors before succeeding', async () => {
    const operation = jest
      .fn<Promise<string>, []>()
      .mockRejectedValueOnce({ name: 'MongoServerSelectionError', message: 'server selection timed out' })
      .mockRejectedValueOnce({ name: 'MongoNetworkTimeoutError', message: 'connection timed out' })
      .mockResolvedValue('ok');

    await expect(
      withMongoRetry('test operation', operation, {
        attempts: 3,
        baseDelayMs: 1,
      }),
    ).resolves.toBe('ok');

    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('detects retryable mongo error shapes from nested causes and labels', () => {
    expect(
      isRetryableMongoError({
        name: 'MongoServerSelectionError',
      }),
    ).toBe(true);

    expect(
      isRetryableMongoError({
        cause: {
          errorLabelSet: new Set(['ResetPool']),
        },
      }),
    ).toBe(true);

    expect(isRetryableMongoError(new Error('validation failed'))).toBe(false);
  });
});
