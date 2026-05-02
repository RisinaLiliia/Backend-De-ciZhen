import { WorkspaceRequestsPresenter } from './workspace-requests.presenter';

describe('WorkspaceRequestsPresenter (unit)', () => {
  const presenter = new WorkspaceRequestsPresenter();

  const cards = [
    {
      role: 'customer',
      workflowState: 'clarifying',
      sortActivityAt: Date.parse('2026-04-07T10:00:00.000Z'),
      sortCreatedAt: Date.parse('2026-04-05T08:00:00.000Z'),
      sortBudget: 400,
      sortDeadlineAt: Date.parse('2026-04-12T09:00:00.000Z'),
      item: {
        requestId: 'request-customer-1',
        title: 'Logo design for boutique',
        category: 'Design',
        city: 'Berlin',
        urgency: 'medium',
        activity: { label: '1 neue Angebote warten auf deine Auswahl', tone: 'warning' },
        quickActions: [{ key: 'open', label: 'Öffnen', tone: 'primary', href: '/requests/request-customer-1' }],
      },
      decision: {
        needsAction: true,
        actionType: 'review_offers',
        actionLabel: 'Angebote ansehen',
        actionPriority: 80,
        actionPriorityLevel: 'medium',
        actionReason: 'Neue Angebote warten auf deine Auswahl.',
        lastRelevantActivityAt: '2026-04-07T09:00:00.000Z',
      },
    },
    {
      role: 'provider',
      workflowState: 'active',
      sortActivityAt: Date.parse('2026-04-08T09:00:00.000Z'),
      sortCreatedAt: Date.parse('2026-04-04T09:00:00.000Z'),
      sortBudget: 900,
      sortDeadlineAt: Date.parse('2026-04-20T10:00:00.000Z'),
      item: {
        requestId: 'request-provider-1',
        title: 'Wedding photography',
        category: 'Photography',
        city: 'Hamburg',
        urgency: 'high',
        activity: { label: 'Auftrag beginnt 08.04.2026', tone: 'info' },
        quickActions: [{ key: 'open', label: 'Öffnen', tone: 'primary', href: '/requests/request-provider-1' }],
      },
      decision: {
        needsAction: false,
        actionType: 'none',
        actionLabel: null,
        actionPriority: 0,
        actionPriorityLevel: 'none',
        actionReason: null,
        lastRelevantActivityAt: '2026-04-08T09:00:00.000Z',
      },
    },
  ] as any;

  it('builds summary, decision panel, and side panel from request cards', () => {
    const summary = presenter.buildWorkspaceSummary({
      locale: 'de',
      cards,
      activeState: 'all',
    });
    const decisionPanel = presenter.buildWorkspaceDecisionPanel({
      locale: 'de',
      cards,
    });
    const sidePanel = presenter.buildWorkspaceSidePanel({
      locale: 'de',
      role: 'all',
      cards,
    });

    expect(summary).toEqual([
      expect.objectContaining({ key: 'all', value: 2, isHighlighted: true }),
      expect.objectContaining({ key: 'attention', value: 1 }),
      expect.objectContaining({ key: 'execution', value: 1 }),
      expect.objectContaining({ key: 'completed', value: 0 }),
    ]);
    expect(decisionPanel).toEqual(
      expect.objectContaining({
        summary: expect.objectContaining({
          totalNeedsAction: 1,
          newOffersCount: 1,
          highPriorityCount: 0,
        }),
        primaryAction: {
          label: 'Jetzt handeln',
          mode: 'decision',
          targetFilter: 'needs_action',
        },
        queue: [
          expect.objectContaining({
            requestId: 'request-customer-1',
            actionType: 'review_offers',
            actionLabel: 'Angebote ansehen',
            categoryLabel: 'Design',
            cityLabel: 'Berlin',
          }),
        ],
        overview: expect.objectContaining({
          highUrgency: 1,
          inProgress: 1,
          completedThisPeriod: 0,
        }),
      }),
    );
    expect(sidePanel).toEqual(
      expect.objectContaining({
        focus: expect.objectContaining({
          title: 'Aktueller Fokus',
          cta: expect.objectContaining({ href: '/requests/request-customer-1' }),
        }),
        recommendation: expect.objectContaining({
          title: 'KI-Empfehlung',
          cta: expect.objectContaining({ href: '/workspace?section=requests&scope=my&mode=decision' }),
        }),
        contextItems: expect.arrayContaining([
          expect.objectContaining({ title: 'Kontext' }),
          expect.objectContaining({ title: 'Laufende Arbeit' }),
        ]),
        nextSteps: expect.arrayContaining([
          expect.objectContaining({ id: 'needs-action' }),
          expect.objectContaining({ id: 'clarifying' }),
          expect.objectContaining({ id: 'urgent' }),
          expect.objectContaining({ id: 'active' }),
        ]),
      }),
    );
  });

  it('omits decision CTA when there are no items needing action', () => {
    const passiveCards = [
      {
        ...cards[1],
        role: 'provider',
        workflowState: 'active',
        decision: {
          needsAction: false,
          actionType: 'none',
          actionLabel: null,
          actionPriority: 0,
          actionPriorityLevel: 'none',
          actionReason: null,
          lastRelevantActivityAt: '2026-04-08T09:00:00.000Z',
        },
      },
    ] as any;

    const sidePanel = presenter.buildWorkspaceSidePanel({
      locale: 'de',
      role: 'provider',
      cards: passiveCards,
    });

    expect(sidePanel.recommendation).toEqual(
      expect.objectContaining({
        title: 'KI-Empfehlung',
        cta: undefined,
      }),
    );
  });

  it('builds market decision panel copy from queue cards and aggregate counts', () => {
    const decisionPanel = presenter.buildWorkspaceMarketDecisionPanel({
      locale: 'de',
      queueCards: cards,
      counts: {
        attention: 7,
        execution: 2,
        completed: 1,
        overdue: 5,
        recent: 2,
      },
    });

    expect(decisionPanel).toEqual(
      expect.objectContaining({
        summary: expect.objectContaining({
          totalNeedsAction: 9,
          highPriorityCount: 2,
          newOffersCount: 2,
          overdueCount: 5,
        }),
        primaryAction: {
          label: 'Markt prüfen',
          mode: 'decision',
          targetFilter: 'needs_action',
        },
        overview: {
          highUrgency: 7,
          inProgress: 2,
          completedThisPeriod: 1,
        },
      }),
    );
  });
});
