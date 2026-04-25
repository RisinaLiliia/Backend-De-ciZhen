import { WorkspacePrivateOverviewSupport } from './workspace-private-overview.support';

describe('WorkspacePrivateOverviewSupport (unit)', () => {
  const support = new WorkspacePrivateOverviewSupport();

  it('builds status counts and computes completeness/delta helpers', () => {
    expect(
      support.toStatusCounts(
        [
          { _id: 'published', count: 2 },
          { _id: 'draft', count: 1 },
          { _id: 'unknown', count: 5 },
        ],
        ['draft', 'published', 'paused'] as const,
      ),
    ).toEqual({ draft: 1, published: 2, paused: 0, total: 3 });

    expect(support.buildDelta(4, 2)).toEqual({ kind: 'percent', percent: 100 });
    expect(support.buildDelta(2, 0)).toEqual({ kind: 'new', percent: null });
    expect(support.buildDelta(0, 0)).toEqual({ kind: 'none', percent: null });

    expect(
      support.computeProviderCompleteness({
        displayName: 'Studio',
        bio: 'Bio',
        cityId: 'berlin',
        serviceKeys: ['photo'],
        basePrice: 100,
        companyName: 'Studio GmbH',
        status: 'active',
        isBlocked: false,
      }),
    ).toBe(100);

    expect(
      support.computeClientCompleteness(
        {
          name: 'Robin',
          email: 'robin@test.local',
          city: 'Berlin',
          phone: '+49',
          avatar: { url: '/a.png' },
          acceptedPrivacyPolicy: true,
        },
        true,
      ),
    ).toBe(100);
  });

  it('resolves preferred role from activity within the requested period', () => {
    const now = Date.now();
    jest.useFakeTimers().setSystemTime(now);

    expect(
      support.resolvePrivateOverviewPreferredRole({
        period: '24h',
        requests: [{ createdAt: new Date(now - 3 * 60 * 60 * 1000) }],
        providerOffers: [{ updatedAt: new Date(now - 30 * 60 * 60 * 1000) }],
        clientOffers: [],
        providerContracts: [],
        clientContracts: [],
        userRole: 'client',
      }),
    ).toBe('customer');

    expect(
      support.resolvePrivateOverviewPreferredRole({
        period: '24h',
        requests: [],
        providerOffers: [{ updatedAt: new Date(now - 2 * 60 * 60 * 1000) }],
        clientOffers: [],
        providerContracts: [],
        clientContracts: [],
        userRole: 'client',
      }),
    ).toBe('provider');

    expect(
      support.resolvePrivateOverviewPreferredRole({
        period: '24h',
        requests: [{ createdAt: new Date(now - 2 * 60 * 60 * 1000) }],
        providerOffers: [{ updatedAt: new Date(now - 2 * 60 * 60 * 1000) }],
        clientOffers: [],
        providerContracts: [],
        clientContracts: [],
        userRole: 'provider',
      }),
    ).toBe('provider');

    jest.useRealTimers();
  });
});
