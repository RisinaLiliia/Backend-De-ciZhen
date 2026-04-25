import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import type { AppRole } from '../users/schemas/user.schema';
import { Request, type RequestDocument } from '../requests/schemas/request.schema';
import { Offer, type OfferDocument } from '../offers/schemas/offer.schema';
import { Contract, type ContractDocument } from '../contracts/schemas/contract.schema';
import { Booking, type BookingDocument } from '../bookings/schemas/booking.schema';
import { Review, type ReviewDocument } from '../reviews/schemas/review.schema';
import type { WorkspaceRequestsQueryDto } from './dto/workspace-requests-query.dto';
import type {
  WorkspaceMyRequestCardDto,
  WorkspaceRequestDecisionDto,
  WorkspaceRequestsResponseDto,
  WorkspaceRequestsDecisionPanelDto,
  WorkspaceRequestsSidePanelDto,
  WorkspaceRequestsSummaryItemDto,
} from './dto/workspace-requests-response.dto';

import {
  WORKSPACE_REQUESTS_PERIOD_MS,
  WorkspaceCustomerLifecycleStage,
  WorkspaceContractReviewSnapshot,
  WorkspaceContractSnapshot,
  WorkspaceBookingSnapshot,
  WorkspaceOfferSnapshot,
  WorkspaceRequestCardModel,
  WorkspaceRequestDecisionActionType,
  WorkspaceRequestSnapshot,
  WorkspaceRequestsLocale,
  WorkspaceRequestsRole,
  WorkspaceRequestsState,
  WorkspaceRequestsWorkflowState,
  WorkspaceRequestsProgressStep,
  WorkspaceRequestsSupport,
} from './workspace-requests.support';

@Injectable()
export class WorkspaceRequestsService {
  private readonly support = new WorkspaceRequestsSupport();

  constructor(
    @InjectModel(Request.name) private readonly requestModel: Model<RequestDocument>,
    @InjectModel(Offer.name) private readonly offerModel: Model<OfferDocument>,
    @InjectModel(Contract.name) private readonly contractModel: Model<ContractDocument>,
    @InjectModel(Booking.name) private readonly bookingModel: Model<BookingDocument>,
    @InjectModel(Review.name) private readonly reviewModel: Model<ReviewDocument>,
  ) {}

  private buildWorkspaceCustomerCard(args: {
    locale: WorkspaceRequestsLocale;
    request: WorkspaceRequestSnapshot;
    offers: WorkspaceOfferSnapshot[];
    contract: WorkspaceContractSnapshot | null;
    booking: WorkspaceBookingSnapshot | null;
    reviewStatus: WorkspaceContractReviewSnapshot | null;
    now: number;
  }): WorkspaceRequestCardModel {
    const { locale, request, offers, contract, booking, reviewStatus, now } = args;
    const category = this.support.resolveWorkspaceCategoryLabel(request);
    const title = this.support.resolveWorkspaceTitle(request, category, locale);
    const city = String(request.cityName ?? '').trim() || String(request.cityId ?? '').trim() || null;
    const preferredAt = this.support.parseActivityAt(request.preferredDate);
    const createdAt = this.support.parseActivityAt(request.createdAt) ?? now;
    const contractConfirmedAt = this.support.parseActivityAt(contract?.confirmedAt ?? contract?.createdAt ?? null);
    const selectedOffer = offers.find((offer) => offer.status === 'accepted')
      ?? offers.find((offer) => Boolean(contract?.offerId) && offer.id === contract?.offerId)
      ?? null;

    let lifecycleStage: WorkspaceCustomerLifecycleStage = 'draft';
    let state: WorkspaceRequestsWorkflowState = 'open';
    let progressStep: WorkspaceRequestsProgressStep = 'request';
    let activity: WorkspaceMyRequestCardDto['activity'] = null;

    if (contract?.status === 'completed' && reviewStatus?.clientReviewedProviderAt) {
      lifecycleStage = 'reviewed';
      state = 'completed';
      progressStep = 'done';
      activity = {
        label: locale === 'de' ? 'Auftrag abgeschlossen und bewertet' : 'Job completed and reviewed',
        tone: 'success',
      };
    } else if (contract?.status === 'completed' || request.status === 'closed') {
      lifecycleStage = 'completed';
      state = 'completed';
      progressStep = 'done';
      activity = {
        label: locale === 'de' ? 'Auftrag abgeschlossen. Bewertung steht noch aus.' : 'Job completed. Review is still pending.',
        tone: 'success',
      };
    } else if (booking?.status === 'completed') {
      lifecycleStage = 'completion_pending';
      state = 'active';
      progressStep = 'done';
      activity = {
        label: locale === 'de'
          ? 'Die Leistung wurde als fertig markiert und wartet auf deine Bestätigung.'
          : 'The work was marked as done and is waiting for your confirmation.',
        tone: 'warning',
      };
    } else if (contract?.status === 'pending' || (selectedOffer && !contract)) {
      lifecycleStage = 'contract_pending';
      state = 'active';
      progressStep = 'contract';
      activity = {
        label: locale === 'de'
          ? 'Ein Anbieter wurde ausgewählt. Prüfe jetzt den Vertrag.'
          : 'A provider has been selected. Review the contract now.',
        tone: 'info',
      };
    } else if (contract) {
      lifecycleStage = 'in_progress';
      state = 'active';
      progressStep = 'contract';
      activity = {
        label: booking?.startAt
          ? locale === 'de'
            ? `Leistung geplant für ${this.support.formatWorkspaceDate(booking.startAt, locale)}`
            : `Service scheduled for ${this.support.formatWorkspaceDate(booking.startAt, locale)}`
          : locale === 'de'
            ? 'Der Auftrag ist in Arbeit.'
            : 'The job is in progress.',
        tone: 'info',
      };
    } else if (offers.length > 0) {
      lifecycleStage = 'offers_received';
      state = 'clarifying';
      progressStep = 'selection';
      activity = {
        label: locale === 'de'
          ? `${offers.length} neue Angebote warten auf deine Auswahl`
          : `${offers.length} new offers are waiting for your decision`,
        tone: 'warning',
      };
    } else if (request.status === 'published') {
      lifecycleStage = 'published';
      activity = {
        label: locale === 'de'
          ? 'Die Anfrage ist veröffentlicht und wartet auf Angebote.'
          : 'The request is published and waiting for offers.',
        tone: 'neutral',
      };
    } else {
      lifecycleStage = 'draft';
      activity = {
        label: request.status === 'paused'
          ? (locale === 'de'
            ? 'Die Veröffentlichung ist pausiert. Du kannst die Anfrage erneut aktivieren.'
            : 'The publication is paused. You can activate the request again.')
          : request.status === 'cancelled'
            ? (locale === 'de'
              ? 'Diese Anfrage wurde storniert. Du kannst sie erneut veröffentlichen.'
              : 'This request was cancelled. You can publish it again.')
            : (locale === 'de'
              ? 'Entwurf ist bereit zur Veröffentlichung'
              : 'Draft is ready to publish'),
        tone: request.status === 'paused' ? 'warning' : 'info',
      };
    }

    const budgetValue = contract?.priceAmount ?? request.price ?? null;
    const deadlineAt = this.support.parseActivityAt(booking?.startAt ?? null) ?? contractConfirmedAt ?? preferredAt;
    const detailsHref = `/requests/${request.id}`;
    const status = this.support.buildWorkspaceCustomerStatus({
      locale,
      requestId: request.id,
      workflowState: state,
      requestStatus: request.status ?? null,
      lifecycleStage,
      contract,
      selectedOffer,
    });
    const decision = this.support.buildWorkspaceDecision({
      locale,
      role: 'customer',
      workflowState: state,
      customerLifecycleStage: lifecycleStage,
      urgency: this.support.resolveWorkspaceUrgency(deadlineAt, now),
      requestTitle: title,
      requestCreatedAt: createdAt,
      requestStatus: request.status ?? null,
      offersCount: offers.length,
      hasAcceptedOffer: offers.some((offer) => offer.status === 'accepted'),
      contractStatus: contract?.status ?? null,
      activityAt: this.support.parseActivityAt(contract?.updatedAt ?? contract?.createdAt ?? null)
        ?? this.support.parseActivityAt(offers[0]?.updatedAt ?? offers[0]?.createdAt ?? null)
        ?? preferredAt
        ?? createdAt,
      now,
    });
    decision.primaryAction = this.support.resolveWorkspaceDecisionPrimaryAction({
      locale,
      requestId: request.id,
      detailsHref,
      decision,
      statusActions: status.actions,
    });
    const urgency = this.support.resolveWorkspaceUrgency(deadlineAt, now);

    return {
      item: {
        id: `customer:${request.id}`,
        requestId: request.id,
        role: 'customer',
        ownerLifecycleStage: lifecycleStage,
        title,
        category,
        subcategory: request.subcategoryName ?? null,
        city,
        createdAt: this.support.formatWorkspaceDate(request.createdAt, locale),
        nextEventAt: this.support.formatWorkspaceDate(booking?.startAt ?? contract?.confirmedAt ?? request.preferredDate ?? null, locale),
        budget: typeof budgetValue === 'number' ? budgetValue : null,
        agreedPrice: typeof contract?.priceAmount === 'number' ? contract.priceAmount : null,
        state,
        stateLabel: this.support.resolveWorkspaceStateLabel(locale, state),
        urgency,
        activity,
        progress: {
          currentStep: progressStep,
          steps: this.support.resolveWorkspaceProgressSteps(locale, progressStep),
        },
        quickActions: [
          {
            key: 'open',
            label: locale === 'de' ? 'Öffnen' : 'Open',
            tone: 'primary',
            href: detailsHref,
          },
          ...(lifecycleStage === 'offers_received'
            ? [
                {
                  key: 'compare',
                  label: locale === 'de' ? 'Anbieter vergleichen' : 'Compare providers',
                  tone: 'secondary' as const,
                  href: detailsHref,
                },
              ]
            : []),
          ...(contract
            ? [
                {
                  key: 'contract',
                  label: locale === 'de' ? 'Vertrag ansehen' : 'View contract',
                  tone: 'secondary' as const,
                  href: detailsHref,
                },
              ]
            : []),
        ],
        requestPreview: this.support.buildWorkspaceRequestPreview({
          locale,
          request,
          title,
          categoryLabel: category,
          budgetValue,
          detailsHref,
        }),
        status,
        decision,
      },
      role: 'customer',
      workflowState: state,
      decision,
      sortActivityAt: contractConfirmedAt ?? preferredAt ?? createdAt,
      sortCreatedAt: createdAt,
      sortBudget: budgetValue ?? 0,
      sortDeadlineAt: deadlineAt,
    };
  }
  private buildWorkspaceProviderCard(args: {
    locale: WorkspaceRequestsLocale;
    offer: WorkspaceOfferSnapshot;
    contract: WorkspaceContractSnapshot | null;
    now: number;
  }): WorkspaceRequestCardModel {
    const { locale, offer, contract, now } = args;
    const request: WorkspaceRequestSnapshot = {
      id: offer.requestId,
      title: offer.requestTitle ?? null,
      description: offer.requestDescription ?? offer.message ?? null,
      serviceKey: offer.requestServiceKey ?? null,
      cityId: offer.requestCityId ?? null,
      cityName: offer.requestCityName ?? null,
      categoryKey: offer.requestCategoryKey ?? null,
      categoryName: offer.requestCategoryName ?? null,
      subcategoryName: offer.requestSubcategoryName ?? null,
      price: offer.requestPrice ?? offer.amount ?? null,
      previousPrice: offer.requestPreviousPrice ?? null,
      priceTrend: offer.requestPriceTrend ?? null,
      preferredDate: offer.requestPreferredDate ?? offer.availableAt ?? null,
      status: offer.requestStatus ?? 'published',
      createdAt: offer.requestCreatedAt ?? offer.createdAt ?? null,
      isRecurring: offer.requestIsRecurring ?? false,
      imageUrl: offer.requestImageUrl ?? null,
      tags: offer.requestTags ?? [],
    };
    const category = this.support.resolveWorkspaceCategoryLabel(request);
    const title = this.support.resolveWorkspaceTitle(request, category, locale);
    const city = String(request.cityName ?? '').trim() || String(request.cityId ?? '').trim() || null;
    const offerCreatedAt = this.support.parseActivityAt(offer.createdAt) ?? now;
    const nextEventAt = this.support.parseActivityAt(contract?.confirmedAt ?? request.preferredDate ?? offer.availableAt ?? null);
    const contractCompleted = Boolean(contract && (contract.status === 'completed' || contract.status === 'cancelled'));

    let state: WorkspaceRequestsWorkflowState;
    let progressStep: WorkspaceRequestsProgressStep;
    let activity: WorkspaceMyRequestCardDto['activity'];

    if (contractCompleted) {
      state = 'completed';
      progressStep = 'done';
      activity = {
        label: locale === 'de' ? 'Auftrag abgeschlossen' : 'Job completed',
        tone: 'success',
      };
    } else if (contract) {
      state = 'active';
      progressStep = 'contract';
      activity = {
        label: nextEventAt
          ? locale === 'de'
            ? `Auftrag beginnt ${this.support.formatWorkspaceDate(contract.confirmedAt ?? request.preferredDate ?? offer.availableAt, locale)}`
            : `Job starts ${this.support.formatWorkspaceDate(contract.confirmedAt ?? request.preferredDate ?? offer.availableAt, locale)}`
          : locale === 'de'
            ? 'Vertrag aktiv'
            : 'Contract active',
        tone: 'info',
      };
    } else if (offer.status === 'accepted') {
      state = 'active';
      progressStep = 'contract';
      activity = {
        label: locale === 'de' ? 'Warte auf Vertragsbestätigung' : 'Waiting for contract confirmation',
        tone: 'warning',
      };
    } else if (
      offer.status === 'declined' ||
      offer.status === 'withdrawn' ||
      request.status === 'cancelled'
    ) {
      state = 'completed';
      progressStep = 'done';
      activity = {
        label: locale === 'de' ? 'Anfrage nicht weiter aktiv' : 'Request is no longer active',
        tone: 'neutral',
      };
    } else {
      state = 'clarifying';
      progressStep = 'selection';
      activity = {
        label: locale === 'de' ? 'Warte auf Rückmeldung des Kunden' : 'Waiting for the customer reply',
        tone: 'warning',
      };
    }

    const budgetValue = contract?.priceAmount ?? offer.amount ?? request.price ?? null;
    const detailsHref = `/requests/${offer.requestId}`;
    const status = this.support.buildWorkspaceProviderStatus({
      locale,
      offer,
      workflowState: state,
    });
    const urgency = this.support.resolveWorkspaceUrgency(nextEventAt, now);
    const decision = this.support.buildWorkspaceDecision({
      locale,
      role: 'provider',
      workflowState: state,
      urgency,
      requestTitle: title,
      requestCreatedAt: offerCreatedAt,
      requestStatus: request.status ?? null,
      contractStatus: contract?.status ?? null,
      activityAt:
        this.support.parseActivityAt(contract?.updatedAt ?? contract?.confirmedAt ?? null)
        ?? this.support.parseActivityAt(offer.updatedAt ?? offer.createdAt)
        ?? nextEventAt
        ?? offerCreatedAt,
      now,
    });
    decision.primaryAction = this.support.resolveWorkspaceDecisionPrimaryAction({
      locale,
      requestId: offer.requestId,
      detailsHref,
      decision,
      statusActions: status.actions,
    });

    return {
      item: {
        id: `provider:${offer.requestId}`,
        requestId: offer.requestId,
        role: 'provider',
        title,
        category,
        subcategory: request.subcategoryName ?? null,
        city,
        createdAt: this.support.formatWorkspaceDate(offer.createdAt, locale),
        nextEventAt: this.support.formatWorkspaceDate(contract?.confirmedAt ?? request.preferredDate ?? offer.availableAt ?? null, locale),
        budget: typeof budgetValue === 'number' ? budgetValue : null,
        agreedPrice: typeof contract?.priceAmount === 'number' ? contract.priceAmount : null,
        state,
        stateLabel: this.support.resolveWorkspaceStateLabel(locale, state),
        urgency,
        activity,
        progress: {
          currentStep: progressStep,
          steps: this.support.resolveWorkspaceProgressSteps(locale, progressStep),
        },
        quickActions: [
          {
            key: 'open',
            label: locale === 'de' ? 'Öffnen' : 'Open',
            tone: 'primary',
            href: detailsHref,
          },
          {
            key: 'chat',
            label: locale === 'de' ? 'Chat' : 'Chat',
            tone: 'secondary',
            href: '/chat',
          },
          ...(state === 'active'
            ? [
                {
                  key: 'contract',
                  label: locale === 'de' ? 'Vertrag ansehen' : 'View contract',
                  tone: 'secondary' as const,
                  href: detailsHref,
                },
              ]
            : []),
        ],
        requestPreview: this.support.buildWorkspaceRequestPreview({
          locale,
          request,
          title,
          categoryLabel: category,
          budgetValue,
          detailsHref,
        }),
        status,
        decision,
      },
      role: 'provider',
      workflowState: state,
      decision,
      sortActivityAt:
        nextEventAt
        ?? this.support.parseActivityAt(contract?.updatedAt ?? offer.updatedAt ?? offer.createdAt)
        ?? offerCreatedAt,
      sortCreatedAt: offerCreatedAt,
      sortBudget: budgetValue ?? 0,
      sortDeadlineAt: nextEventAt,
    };
  }
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

    const [myRequests, myClientOffers, myProviderOffers, myProviderContracts, myClientContracts] = await Promise.all([
      this.requestModel.find({ clientId: uid, archivedAt: null }).sort({ createdAt: -1 }).lean().exec(),
      this.offerModel.find({ clientUserId: uid }).sort({ createdAt: -1 }).lean().exec(),
      this.offerModel
        .aggregate<WorkspaceOfferSnapshot>([
          { $match: { providerUserId: uid } },
          { $sort: { createdAt: -1 } },
          {
            $addFields: {
              requestObjId: {
                $cond: [
                  { $and: [{ $ne: ['$requestId', null] }, { $ne: ['$requestId', ''] }] },
                  { $toObjectId: '$requestId' },
                  null,
                ],
              },
            },
          },
          {
            $lookup: {
              from: 'requests',
              localField: 'requestObjId',
              foreignField: '_id',
              as: 'req',
            },
          },
          { $unwind: { path: '$req', preserveNullAndEmptyArrays: true } },
          {
            $project: {
              id: { $toString: '$_id' },
              requestId: 1,
              providerUserId: 1,
              clientUserId: 1,
              status: 1,
              message: 1,
              amount: '$pricing.amount',
              priceType: '$pricing.type',
              availableAt: '$availability.date',
              availabilityNote: '$availability.note',
              createdAt: 1,
              updatedAt: 1,
              requestTitle: '$req.title',
              requestDescription: '$req.description',
              requestServiceKey: '$req.serviceKey',
              requestCityId: '$req.cityId',
              requestCityName: '$req.cityName',
              requestCategoryKey: '$req.categoryKey',
              requestCategoryName: '$req.categoryName',
              requestSubcategoryName: '$req.subcategoryName',
              requestPreferredDate: '$req.preferredDate',
              requestStatus: '$req.status',
              requestPrice: '$req.price',
              requestPreviousPrice: '$req.previousPrice',
              requestPriceTrend: '$req.priceTrend',
              requestCreatedAt: '$req.createdAt',
              requestIsRecurring: '$req.isRecurring',
              requestImageUrl: '$req.imageUrl',
              requestTags: '$req.tags',
            },
          },
        ])
        .exec(),
      this.contractModel.find({ providerUserId: uid }).sort({ createdAt: -1 }).lean().exec(),
      this.contractModel.find({ clientId: uid }).sort({ createdAt: -1 }).lean().exec(),
    ]);

    const customerOffersByRequest = (myClientOffers as Array<any>).reduce((map, offer) => {
      const requestId = String(offer.requestId ?? '').trim();
      if (!requestId) return map;
      const current = map.get(requestId) ?? [];
      current.push({
        id: String(offer._id),
        requestId,
        providerUserId: this.support.normalizeId(offer.providerUserId),
        clientUserId: this.support.normalizeId(offer.clientUserId),
        status: offer.status,
        message: offer.message ?? null,
        amount: typeof offer.pricing?.amount === 'number' ? offer.pricing.amount : null,
        priceType: offer.pricing?.type ?? null,
        availableAt: offer.availability?.date ?? null,
        availabilityNote: offer.availability?.note ?? null,
        createdAt: offer.createdAt ?? null,
        updatedAt: offer.updatedAt ?? null,
      } satisfies WorkspaceOfferSnapshot);
      map.set(requestId, current);
      return map;
    }, new Map<string, WorkspaceOfferSnapshot[]>());

    const providerOfferByRequest = this.support.pickLatestByRequest(
      (myProviderOffers ?? []).map((offer) => ({
        ...offer,
        requestId: String(offer.requestId ?? '').trim(),
      })),
    );
    const providerContractByRequest = this.support.pickLatestByRequest(
      (myProviderContracts as Array<any>).map((contract) => ({
        id: String(contract._id),
        requestId: String(contract.requestId ?? '').trim(),
        offerId: String(contract.offerId ?? ''),
        clientId: String(contract.clientId ?? ''),
        providerUserId: String(contract.providerUserId ?? ''),
        status: contract.status,
        priceAmount: contract.priceAmount ?? null,
        priceType: contract.priceType ?? null,
        priceDetails: contract.priceDetails ?? null,
        confirmedAt: contract.confirmedAt ?? null,
        completedAt: contract.completedAt ?? null,
        cancelledAt: contract.cancelledAt ?? null,
        cancelReason: contract.cancelReason ?? null,
        createdAt: contract.createdAt ?? null,
        updatedAt: contract.updatedAt ?? null,
      } satisfies WorkspaceContractSnapshot)),
    );
    const clientContractByRequest = this.support.pickLatestByRequest(
      (myClientContracts as Array<any>).map((contract) => ({
        id: String(contract._id),
        requestId: String(contract.requestId ?? '').trim(),
        offerId: String(contract.offerId ?? ''),
        clientId: String(contract.clientId ?? ''),
        providerUserId: String(contract.providerUserId ?? ''),
        status: contract.status,
        priceAmount: contract.priceAmount ?? null,
        priceType: contract.priceType ?? null,
        priceDetails: contract.priceDetails ?? null,
        confirmedAt: contract.confirmedAt ?? null,
        completedAt: contract.completedAt ?? null,
        cancelledAt: contract.cancelledAt ?? null,
        cancelReason: contract.cancelReason ?? null,
        createdAt: contract.createdAt ?? null,
        updatedAt: contract.updatedAt ?? null,
      } satisfies WorkspaceContractSnapshot)),
    );
    const clientContractIds = Array.from(clientContractByRequest.values()).map((contract) => contract.id);
    const clientBookings = clientContractIds.length > 0
      ? await this.bookingModel
        .find({ contractId: { $in: clientContractIds } })
        .lean()
        .exec()
      : [];
    const clientBookingByContractId = new Map(
      (clientBookings as Array<any>).map((booking) => [
        String(booking.contractId ?? '').trim(),
        {
          id: String(booking._id),
          requestId: String(booking.requestId ?? '').trim(),
          offerId: String(booking.offerId ?? '').trim(),
          contractId: String(booking.contractId ?? '').trim() || null,
          providerUserId: String(booking.providerUserId ?? '').trim(),
          clientId: String(booking.clientId ?? '').trim(),
          startAt: booking.startAt ?? null,
          durationMin: booking.durationMin ?? null,
          endAt: booking.endAt ?? null,
          status: booking.status,
        } satisfies WorkspaceBookingSnapshot,
      ]),
    );
    const completedBookingIds = Array.from(clientBookingByContractId.values())
      .filter((booking) => booking.status === 'completed')
      .map((booking) => booking.id);
    const clientProviderReviews = completedBookingIds.length > 0
      ? await this.reviewModel
        .find({ bookingId: { $in: completedBookingIds }, targetRole: 'provider' })
        .sort({ createdAt: -1 })
        .lean()
        .exec()
      : [];
    const clientReviewByBookingId = new Map<string, WorkspaceContractReviewSnapshot>();
    for (const review of clientProviderReviews as Array<any>) {
      const bookingId = String(review.bookingId ?? '').trim();
      if (!bookingId || clientReviewByBookingId.has(bookingId)) continue;
      clientReviewByBookingId.set(bookingId, {
        clientReviewId: String(review._id ?? '').trim() || null,
        clientReviewedProviderAt: this.support.parseActivityAt(review.createdAt),
        clientReviewRating: typeof review.rating === 'number' ? review.rating : null,
        clientReviewText: typeof review.text === 'string' ? review.text : null,
      });
    }

    const customerCards = (myRequests as Array<any>).map((request) =>
      this.buildWorkspaceCustomerCard({
        locale,
        request: {
          id: String(request._id),
          title: request.title ?? null,
          description: request.description ?? null,
          serviceKey: request.serviceKey ?? null,
          cityId: request.cityId ?? null,
          cityName: request.cityName ?? null,
          categoryKey: request.categoryKey ?? null,
          categoryName: request.categoryName ?? null,
          subcategoryName: request.subcategoryName ?? null,
          price: request.price ?? null,
          previousPrice: request.previousPrice ?? null,
          priceTrend: request.priceTrend ?? null,
          preferredDate: request.preferredDate ?? null,
          status: request.status ?? null,
          createdAt: request.createdAt ?? null,
          isRecurring: request.isRecurring ?? false,
          imageUrl: request.imageUrl ?? null,
          tags: request.tags ?? [],
        },
        offers: customerOffersByRequest.get(String(request._id)) ?? [],
        contract: clientContractByRequest.get(String(request._id)) ?? null,
        booking: (() => {
          const contract = clientContractByRequest.get(String(request._id)) ?? null;
          return contract ? clientBookingByContractId.get(contract.id) ?? null : null;
        })(),
        reviewStatus: (() => {
          const contract = clientContractByRequest.get(String(request._id)) ?? null;
          if (!contract) return null;
          const booking = clientBookingByContractId.get(contract.id) ?? null;
          return booking ? clientReviewByBookingId.get(booking.id) ?? null : null;
        })(),
        now,
      }),
    );

    const providerCards = Array.from(providerOfferByRequest.values()).map((offer) =>
      this.buildWorkspaceProviderCard({
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
