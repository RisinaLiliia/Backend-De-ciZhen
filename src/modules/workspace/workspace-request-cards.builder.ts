import type {
  WorkspaceMyRequestCardDto,
} from './dto/workspace-requests-response.dto';
import {
  WorkspaceCustomerLifecycleStage,
  WorkspaceContractReviewSnapshot,
  WorkspaceContractSnapshot,
  WorkspaceBookingSnapshot,
  WorkspaceOfferSnapshot,
  WorkspaceRequestCardModel,
  WorkspaceRequestSnapshot,
  WorkspaceRequestsLocale,
  WorkspaceRequestsProgressStep,
  WorkspaceRequestsWorkflowState,
  WorkspaceRequestsSupport,
} from './workspace-requests.support';

export class WorkspaceRequestCardsBuilder {
  constructor(private readonly support: WorkspaceRequestsSupport) {}

  buildWorkspaceCustomerCard(args: {
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
    const primaryAction = decision.primaryAction ?? null;
    const secondaryAction = this.support.resolveWorkspaceDecisionSecondaryAction({
      primaryAction,
      statusActions: status.actions,
    });
    const lifecycleState = this.support.resolveWorkspaceLifecycleState({
      role: 'customer',
      ownerLifecycleStage: lifecycleStage,
      requestStatus: request.status ?? null,
      request,
    });
    const visibility = this.support.resolveWorkspaceVisibilityState({
      request,
      lifecycleState,
    });
    const permissions = this.support.resolveWorkspaceActionPermissions({
      role: 'customer',
      statusActions: status.actions,
      request,
    });
    const urgency = this.support.resolveWorkspaceUrgency(deadlineAt, now);

    return {
      item: {
        id: `customer:${request.id}`,
        requestId: request.id,
        role: 'customer',
        ownerLifecycleStage: lifecycleStage,
        lifecycleState,
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
        visibility,
        responseCount: offers.length,
        ...permissions,
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
        primaryAction,
        secondaryAction,
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

  buildWorkspaceProviderCard(args: {
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
    const primaryAction = decision.primaryAction ?? null;
    const secondaryAction = this.support.resolveWorkspaceDecisionSecondaryAction({
      primaryAction,
      statusActions: status.actions,
    });

    return {
      item: {
        id: `provider:${offer.requestId}`,
        requestId: offer.requestId,
        role: 'provider',
        lifecycleState: null,
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
        visibility: {
          inPublicFeed: request.status === 'published',
          retainedForParticipants: false,
          isInactive: request.status === 'cancelled',
          inactiveReason: null,
          inactiveMessage: null,
          purgeAt: null,
          canRestore: false,
        },
        responseCount: null,
        canEdit: false,
        canDelete: false,
        canDuplicate: false,
        canRestore: false,
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
        primaryAction,
        secondaryAction,
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
}
