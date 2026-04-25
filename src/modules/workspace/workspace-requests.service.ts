import { Injectable } from '@nestjs/common';

import type { AppRole } from '../users/schemas/user.schema';
import type { WorkspaceRequestsQueryDto } from './dto/workspace-requests-query.dto';
import type {
  WorkspaceRequestsResponseDto,
  WorkspaceRequestsDecisionPanelDto,
  WorkspaceRequestsSidePanelDto,
  WorkspaceRequestsSummaryItemDto,
} from './dto/workspace-requests-response.dto';
import {
  WORKSPACE_REQUESTS_PERIOD_MS,
  WorkspaceRequestCardModel,
  WorkspaceRequestDecisionActionType,
  WorkspaceRequestsLocale,
  WorkspaceRequestsRole,
  WorkspaceRequestsState,
  WorkspaceRequestsWorkflowState,
  WorkspaceRequestsSupport,
} from './workspace-requests.support';
import { WorkspaceRequestCardsBuilder } from './workspace-request-cards.builder';
import { WorkspaceRequestSnapshotsService } from './workspace-request-snapshots.service';

@Injectable()
export class WorkspaceRequestsService {
  private readonly support = new WorkspaceRequestsSupport();
  private readonly cards = new WorkspaceRequestCardsBuilder(this.support);

  constructor(private readonly snapshots: WorkspaceRequestSnapshotsService) {}

  private buildWorkspaceSummary(args: {
    locale: WorkspaceRequestsLocale;
    cards: WorkspaceRequestCardModel[];
    activeState: WorkspaceRequestsState;
  }): WorkspaceRequestsSummaryItemDto[] {
    const counts = {
      all: args.cards.length,
      attention: args.cards.filter((card) => card.workflowState === 'open' || card.workflowState === 'clarifying').length,
      execution: args.cards.filter((card) => card.workflowState === 'active').length,
      completed: args.cards.filter((card) => card.workflowState === 'completed').length,
    };

    return [
      {
        key: 'all',
        label: args.locale === 'de' ? 'Alle' : 'All',
        value: counts.all,
        isHighlighted: args.activeState === 'all',
      },
      {
        key: 'attention',
        label: args.locale === 'de' ? 'Aktiv' : 'Active',
        value: counts.attention,
        isHighlighted: args.activeState === 'attention',
      },
      {
        key: 'execution',
        label: args.locale === 'de' ? 'In Ausführung' : 'In execution',
        value: counts.execution,
        isHighlighted: args.activeState === 'execution',
      },
      {
        key: 'completed',
        label: args.locale === 'de' ? 'Abgeschlossen' : 'Completed',
        value: counts.completed,
        isHighlighted: args.activeState === 'completed',
      },
    ];
  }
  private buildWorkspaceDecisionPanel(args: {
    locale: WorkspaceRequestsLocale;
    cards: WorkspaceRequestCardModel[];
  }): WorkspaceRequestsDecisionPanelDto {
    const queue = [...args.cards]
      .filter((card) => card.decision.needsAction)
      .sort((left, right) => {
        const leftRelevant = this.support.parseActivityAt(left.decision.lastRelevantActivityAt) ?? 0;
        const rightRelevant = this.support.parseActivityAt(right.decision.lastRelevantActivityAt) ?? 0;

        return (
          right.decision.actionPriority - left.decision.actionPriority ||
          rightRelevant - leftRelevant ||
          right.sortCreatedAt - left.sortCreatedAt
        );
      });

    const totalNeedsAction = queue.length;
    const summary = {
      totalNeedsAction,
      highPriorityCount: queue.filter((card) => card.decision.actionPriorityLevel === 'high').length,
      newOffersCount: queue.filter((card) => card.decision.actionType === 'review_offers').length,
      replyRequiredCount: queue.filter((card) => card.decision.actionType === 'reply_required').length,
      confirmCompletionCount: queue.filter((card) => card.decision.actionType === 'confirm_completion').length,
      overdueCount: queue.filter((card) => card.decision.actionType === 'overdue_followup').length,
    };

    return {
      summary,
      primaryAction: {
        label: args.locale === 'de' ? 'Jetzt handeln' : 'Act now',
        mode: 'decision',
        targetFilter: 'needs_action',
      },
      queue: queue.map((card) => ({
        requestId: card.item.requestId,
        title: card.item.title,
        actionType: card.decision.actionType as Exclude<WorkspaceRequestDecisionActionType, 'none'>,
        actionLabel:
          card.decision.actionLabel
          ?? (args.locale === 'de' ? 'Jetzt öffnen' : 'Open now'),
        actionPriority: card.decision.actionPriority,
        actionPriorityLevel:
          card.decision.actionPriorityLevel === 'none'
            ? 'low'
            : card.decision.actionPriorityLevel,
        actionReason: card.decision.actionReason ?? null,
        categoryLabel: card.item.category ?? null,
        cityLabel: card.item.city ?? null,
      })),
      overview: {
        highUrgency: args.cards.filter((card) => card.item.urgency === 'high').length,
        inProgress: args.cards.filter((card) => card.workflowState === 'active').length,
        completedThisPeriod: args.cards.filter((card) => card.workflowState === 'completed').length,
      },
    };
  }
  private buildWorkspaceSidePanel(args: {
    locale: WorkspaceRequestsLocale;
    role: WorkspaceRequestsRole;
    cards: WorkspaceRequestCardModel[];
  }): WorkspaceRequestsSidePanelDto {
    const decisionPanel = this.buildWorkspaceDecisionPanel({
      locale: args.locale,
      cards: args.cards,
    });
    const stateWeight: Record<WorkspaceRequestsWorkflowState, number> = {
      clarifying: 4,
      active: 3,
      open: 2,
      completed: 1,
    };

    const actionableCards = [...args.cards].sort((left, right) => {
      const leftWeight =
        (stateWeight[left.workflowState] * 10) +
        (left.item.urgency === 'high' ? 3 : left.item.urgency === 'medium' ? 2 : 1);
      const rightWeight =
        (stateWeight[right.workflowState] * 10) +
        (right.item.urgency === 'high' ? 3 : right.item.urgency === 'medium' ? 2 : 1);

      return rightWeight - leftWeight || right.sortActivityAt - left.sortActivityAt;
    });

    const focusCard = actionableCards[0] ?? null;
    const clarifyingCount = args.cards.filter((card) => card.workflowState === 'clarifying').length;
    const activeCount = args.cards.filter((card) => card.workflowState === 'active').length;
    const highUrgencyCount = args.cards.filter((card) => card.item.urgency === 'high').length;
    const customerCount = args.cards.filter((card) => card.role === 'customer').length;
    const providerCount = args.cards.filter((card) => card.role === 'provider').length;
    const primaryDecision = decisionPanel.queue[0] ?? null;

    return {
      focus: focusCard
        ? {
            title: args.locale === 'de' ? 'Aktueller Fokus' : 'Current focus',
            description:
              focusCard.item.activity?.label ??
              (args.locale === 'de'
                ? 'Dieser Vorgang sollte als Nächstes geöffnet werden.'
                : 'This item should be opened next.'),
            cta: focusCard.item.quickActions[0]?.href
              ? {
                  label: focusCard.item.quickActions[0].label,
                  href: focusCard.item.quickActions[0].href,
                }
              : undefined,
          }
        : null,
      recommendation: {
        title: args.locale === 'de' ? 'KI-Empfehlung' : 'AI recommendation',
        description: primaryDecision?.actionReason
          ?? (
            args.role === 'provider'
              ? args.locale === 'de'
                ? 'Schnelle Rückmeldungen auf laufende Vorgänge erhöhen aktuell deine Abschlusschance.'
                : 'Fast replies on active flows improve your close rate right now.'
              : args.role === 'customer'
                ? args.locale === 'de'
                  ? 'Prüfe neue Angebote zeitnah, damit Auswahl und Terminbestätigung nicht liegen bleiben.'
                  : 'Review new offers quickly so selection and confirmation keep moving.'
                : args.locale === 'de'
                  ? 'Halte Klärungen kurz und bestätige aktive Vorgänge früh, damit offene Arbeit nicht blockiert.'
                  : 'Keep clarifications short and confirm active work early so the queue stays unblocked.'
          ),
        cta: decisionPanel.summary.totalNeedsAction > 0
          ? {
              label: decisionPanel.primaryAction.label,
              href: '/workspace?section=requests&scope=my&mode=decision',
            }
          : undefined,
      },
      contextItems: [
        {
          title: args.locale === 'de' ? 'Kontext' : 'Context',
          description:
            args.locale === 'de'
              ? `Kunde ${customerCount} · Anbieter ${providerCount}`
              : `Customer ${customerCount} · Provider ${providerCount}`,
          meta: [
            {
              label: args.locale === 'de' ? 'In Klärung' : 'Clarifying',
              value: String(clarifyingCount),
            },
            {
              label: args.locale === 'de' ? 'Hohe Dringlichkeit' : 'High urgency',
              value: String(highUrgencyCount),
            },
          ],
        },
        {
          title: args.locale === 'de' ? 'Laufende Arbeit' : 'Active work',
          description:
            args.locale === 'de'
              ? `${activeCount} Vorgänge sind aktuell in Arbeit.`
              : `${activeCount} items are currently active.`,
        },
      ],
      nextSteps: [
        ...(decisionPanel.summary.totalNeedsAction > 0
          ? [
              {
                id: 'needs-action',
                title: args.locale === 'de'
                  ? `${decisionPanel.summary.totalNeedsAction} Vorgänge brauchen deine Entscheidung`
                  : `${decisionPanel.summary.totalNeedsAction} items need your decision`,
              },
            ]
          : []),
        ...(clarifyingCount > 0
          ? [
              {
                id: 'clarifying',
                title: args.locale === 'de' ? 'Neue Rückmeldungen prüfen' : 'Review new responses',
              },
            ]
          : []),
        ...(highUrgencyCount > 0
          ? [
              {
                id: 'urgent',
                title: args.locale === 'de' ? 'Dringende Vorgänge priorisieren' : 'Prioritize urgent items',
              },
            ]
          : []),
        ...(activeCount > 0
          ? [
              {
                id: 'active',
                title:
                  args.locale === 'de'
                    ? 'Laufende Arbeit bestätigen oder abschließen'
                    : 'Confirm or close active work',
              },
            ]
          : []),
      ],
    };
  }

  async getRequestsOverview(
    userId: string,
    _role: AppRole,
    query: WorkspaceRequestsQueryDto,
    acceptLanguage?: string | null,
  ): Promise<WorkspaceRequestsResponseDto> {
    const uid = String(userId ?? '').trim();
    const locale = this.support.resolveWorkspaceLocale(acceptLanguage);
    const role: WorkspaceRequestsRole = query.role ?? 'all';
    const state: WorkspaceRequestsState = query.state ?? 'all';
    const period = query.period ?? '30d';
    const sort = query.sort ?? 'activity';
    const now = Date.now();
    const page = Math.max(query.page ?? 1, 1);

    const {
      requests,
      customerOffersByRequest,
      providerOfferByRequest,
      providerContractByRequest,
      clientContractByRequest,
      clientBookingByContractId,
      clientReviewByBookingId,
    } = await this.snapshots.loadWorkspaceRequestSnapshots(uid);

    const customerCards = requests.map((request) => {
      const contract = clientContractByRequest.get(request.id) ?? null;
      const booking = contract ? clientBookingByContractId.get(contract.id) ?? null : null;

      return this.cards.buildWorkspaceCustomerCard({
        locale,
        request,
        offers: customerOffersByRequest.get(request.id) ?? [],
        contract,
        booking,
        reviewStatus: booking ? clientReviewByBookingId.get(booking.id) ?? null : null,
        now,
      });
    });

    const providerCards = Array.from(providerOfferByRequest.values()).map((offer) =>
      this.cards.buildWorkspaceProviderCard({
        locale,
        offer,
        contract: providerContractByRequest.get(offer.requestId) ?? null,
        now,
      }),
    );

    const allCards = [...customerCards, ...providerCards];
    const periodCutoff = now - WORKSPACE_REQUESTS_PERIOD_MS[period];
    const cardsInPeriod = allCards.filter((card) => card.sortActivityAt >= periodCutoff);
    const cardsByRole = role === 'all' ? cardsInPeriod : cardsInPeriod.filter((card) => card.role === role);
    const cardsByState =
      state === 'all'
        ? cardsByRole
        : cardsByRole.filter((card) => {
            if (state === 'attention') return card.workflowState === 'open' || card.workflowState === 'clarifying';
            if (state === 'execution') return card.workflowState === 'active';
            return card.workflowState === 'completed';
          });

    const sortedCards = [...cardsByState].sort((left, right) => {
      if (sort === 'deadline') {
        if (left.sortDeadlineAt == null) return 1;
        if (right.sortDeadlineAt == null) return -1;
        return left.sortDeadlineAt - right.sortDeadlineAt || right.sortActivityAt - left.sortActivityAt;
      }
      if (sort === 'newest') return right.sortCreatedAt - left.sortCreatedAt;
      if (sort === 'budget' || sort === 'price_desc') return right.sortBudget - left.sortBudget;
      if (sort === 'oldest' || sort === 'date_asc') return left.sortCreatedAt - right.sortCreatedAt;
      return right.sortActivityAt - left.sortActivityAt;
    });

    const total = sortedCards.length;
    const limit = Math.min(Math.max(query.limit ?? Math.max(total, 1), 1), 100);
    const offset = (page - 1) * limit;
    const pagedCards = sortedCards.slice(offset, offset + limit);
    const decisionPanel = this.buildWorkspaceDecisionPanel({
      locale,
      cards: cardsByRole,
    });

    return {
      section: 'requests',
      scope: 'my',
      header: {
        title: locale === 'de' ? 'Meine Vorgänge' : 'My workflows',
      },
      filters: {
        city: query.city ?? null,
        category: query.category ?? null,
        service: query.service ?? null,
        period,
        role,
        state,
        sort,
      },
      summary: {
        items: this.buildWorkspaceSummary({
          locale,
          cards: cardsByRole,
          activeState: state,
        }),
      },
      list: {
        total,
        page,
        limit,
        hasMore: offset + limit < total,
        items: pagedCards.map((card) => card.item),
      },
      decisionPanel,
      sidePanel: this.buildWorkspaceSidePanel({
        locale,
        role,
        cards: cardsByRole,
      }),
    };
  }
}
