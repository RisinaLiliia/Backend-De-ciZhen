import { Injectable } from '@nestjs/common';

import type {
  WorkspaceRequestsDecisionPanelDto,
  WorkspaceRequestsSidePanelDto,
  WorkspaceRequestsSummaryItemDto,
} from './dto/workspace-requests-response.dto';
import {
  WorkspaceRequestCardModel,
  WorkspaceRequestDecisionActionType,
  WorkspaceRequestsLocale,
  WorkspaceRequestsRole,
  WorkspaceRequestsState,
  WorkspaceRequestsWorkflowState,
  WorkspaceRequestsSupport,
} from './workspace-requests.support';

@Injectable()
export class WorkspaceRequestsPresenter {
  private readonly support = new WorkspaceRequestsSupport();

  private buildDecisionQueue(cards: WorkspaceRequestCardModel[]) {
    return [...cards]
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
  }

  buildWorkspaceSummaryFromCounts(args: {
    locale: WorkspaceRequestsLocale;
    activeState: WorkspaceRequestsState;
    counts: {
      all: number;
      attention: number;
      execution: number;
      completed: number;
    };
  }): WorkspaceRequestsSummaryItemDto[] {
    return [
      {
        key: 'all',
        label: args.locale === 'de' ? 'Alle' : 'All',
        value: args.counts.all,
        isHighlighted: args.activeState === 'all',
      },
      {
        key: 'attention',
        label: args.locale === 'de' ? 'Aktiv' : 'Active',
        value: args.counts.attention,
        isHighlighted: args.activeState === 'attention',
      },
      {
        key: 'execution',
        label: args.locale === 'de' ? 'In Ausführung' : 'In execution',
        value: args.counts.execution,
        isHighlighted: args.activeState === 'execution',
      },
      {
        key: 'completed',
        label: args.locale === 'de' ? 'Abgeschlossen' : 'Completed',
        value: args.counts.completed,
        isHighlighted: args.activeState === 'completed',
      },
    ];
  }

  buildWorkspaceSummary(args: {
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

    return this.buildWorkspaceSummaryFromCounts({
      locale: args.locale,
      activeState: args.activeState,
      counts,
    });
  }

  buildWorkspaceDecisionPanel(args: {
    locale: WorkspaceRequestsLocale;
    cards: WorkspaceRequestCardModel[];
  }): WorkspaceRequestsDecisionPanelDto {
    const queue = this.buildDecisionQueue(args.cards);

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
          card.decision.actionLabel ??
          (args.locale === 'de' ? 'Jetzt öffnen' : 'Open now'),
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

  buildWorkspaceMarketDecisionPanel(args: {
    locale: WorkspaceRequestsLocale;
    queueCards: WorkspaceRequestCardModel[];
    counts: {
      attention: number;
      execution: number;
      completed: number;
      overdue: number;
      recent: number;
    };
  }): WorkspaceRequestsDecisionPanelDto {
    const queue = this.buildDecisionQueue(args.queueCards);

    return {
      summary: {
        totalNeedsAction: args.counts.attention + args.counts.execution,
        highPriorityCount: args.counts.execution,
        newOffersCount: args.counts.recent,
        replyRequiredCount: 0,
        confirmCompletionCount: 0,
        overdueCount: args.counts.overdue,
      },
      primaryAction: {
        label: args.locale === 'de' ? 'Markt prüfen' : 'Review market',
        mode: 'decision',
        targetFilter: 'needs_action',
      },
      queue: queue.map((card) => ({
        requestId: card.item.requestId,
        title: card.item.title,
        actionType: card.decision.actionType as Exclude<WorkspaceRequestDecisionActionType, 'none'>,
        actionLabel:
          card.decision.actionLabel ??
          (args.locale === 'de' ? 'Jetzt öffnen' : 'Open now'),
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
        highUrgency: args.counts.attention,
        inProgress: args.counts.execution,
        completedThisPeriod: args.counts.completed,
      },
    };
  }

  buildWorkspaceSidePanel(args: {
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
}
