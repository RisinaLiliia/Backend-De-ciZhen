import { WorkspaceRequestsListPolicy } from './workspace-requests-list-policy';

describe('WorkspaceRequestsListPolicy (unit)', () => {
  const policy = new WorkspaceRequestsListPolicy();

  const cards = [
    {
      role: 'customer',
      workflowState: 'clarifying',
      sortActivityAt: Date.parse('2026-04-07T10:00:00.000Z'),
      sortCreatedAt: Date.parse('2026-04-05T08:00:00.000Z'),
      sortBudget: 400,
      sortDeadlineAt: Date.parse('2026-04-12T09:00:00.000Z'),
      item: { requestId: 'customer-1' },
      decision: {},
    },
    {
      role: 'provider',
      workflowState: 'active',
      sortActivityAt: Date.parse('2026-04-08T10:00:00.000Z'),
      sortCreatedAt: Date.parse('2026-04-04T08:00:00.000Z'),
      sortBudget: 900,
      sortDeadlineAt: Date.parse('2026-04-20T09:00:00.000Z'),
      item: { requestId: 'provider-1' },
      decision: {},
    },
    {
      role: 'customer',
      workflowState: 'completed',
      sortActivityAt: Date.parse('2026-03-30T10:00:00.000Z'),
      sortCreatedAt: Date.parse('2026-03-20T08:00:00.000Z'),
      sortBudget: 250,
      sortDeadlineAt: Date.parse('2026-03-31T09:00:00.000Z'),
      item: { requestId: 'customer-old' },
      decision: {},
    },
  ] as any;

  it('filters by period, role, and state and sorts by activity by default', () => {
    const result = policy.resolve({
      cards,
      query: { scope: 'my', period: '30d', sort: 'activity' },
      role: 'all',
      state: 'all',
      now: Date.parse('2026-04-10T10:00:00.000Z'),
    });

    expect(result.cardsByRole.map((card) => card.item.requestId)).toEqual(['customer-1', 'provider-1', 'customer-old']);
    expect(result.sortedCards.map((card) => card.item.requestId)).toEqual(['provider-1', 'customer-1', 'customer-old']);
    expect(result.pagedCards.map((card) => card.item.requestId)).toEqual(['provider-1', 'customer-1', 'customer-old']);
    expect(result.total).toBe(3);
    expect(result.limit).toBe(3);
    expect(result.page).toBe(1);
  });

  it('supports role/state filtering, deadline sorting, and pagination', () => {
    const result = policy.resolve({
      cards,
      query: { scope: 'my', period: '30d', sort: 'deadline', page: 1, limit: 1 },
      role: 'customer',
      state: 'attention',
      now: Date.parse('2026-04-10T10:00:00.000Z'),
    });

    expect(result.cardsByRole.map((card) => card.item.requestId)).toEqual(['customer-1', 'customer-old']);
    expect(result.sortedCards.map((card) => card.item.requestId)).toEqual(['customer-1']);
    expect(result.pagedCards.map((card) => card.item.requestId)).toEqual(['customer-1']);
    expect(result.total).toBe(1);
    expect(result.limit).toBe(1);
  });

  it('supports completed-state filtering and budget sorting aliases', () => {
    const result = policy.resolve({
      cards,
      query: { scope: 'my', period: '30d', sort: 'price_desc' },
      role: 'all',
      state: 'completed',
      now: Date.parse('2026-04-10T10:00:00.000Z'),
    });

    expect(result.sortedCards.map((card) => card.item.requestId)).toEqual(['customer-old']);
    expect(result.total).toBe(1);
  });
});
