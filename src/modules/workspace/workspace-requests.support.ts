import type {
  WorkspaceMyRequestCardDto,
  WorkspaceRequestDecisionDto,
} from './dto/workspace-requests-response.dto';

export const WORKSPACE_REQUESTS_PERIOD_MS = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  '90d': 90 * 24 * 60 * 60 * 1000,
} as const;

export type WorkspaceRequestsLocale = 'de' | 'en';
export type WorkspaceRequestsRole = 'all' | 'customer' | 'provider';
export type WorkspaceRequestsState = 'all' | 'attention' | 'execution' | 'completed';
export type WorkspaceRequestsWorkflowState = 'open' | 'clarifying' | 'active' | 'completed';
export type WorkspaceRequestsProgressStep = 'request' | 'offers' | 'selection' | 'contract' | 'done';
export type WorkspaceRequestCardRole = 'customer' | 'provider';
export type WorkspaceRequestDecisionActionType =
  | 'review_offers'
  | 'reply_required'
  | 'confirm_contract'
  | 'confirm_completion'
  | 'review_completion'
  | 'overdue_followup'
  | 'none';
export type WorkspaceRequestDecisionPriorityLevel = 'high' | 'medium' | 'low' | 'none';

export type WorkspaceRequestSnapshot = {
  id: string;
  title?: string | null;
  description?: string | null;
  serviceKey?: string | null;
  cityId?: string | null;
  cityName?: string | null;
  categoryKey?: string | null;
  categoryName?: string | null;
  subcategoryName?: string | null;
  price?: number | null;
  previousPrice?: number | null;
  priceTrend?: 'up' | 'down' | null;
  preferredDate?: Date | string | null;
  status?: string | null;
  createdAt?: Date | string | null;
  isRecurring?: boolean | null;
  imageUrl?: string | null;
  tags?: string[] | null;
};

export type WorkspaceOfferSnapshot = {
  id: string;
  requestId: string;
  providerUserId: string | null;
  clientUserId: string | null;
  status: 'sent' | 'accepted' | 'declined' | 'withdrawn';
  message?: string | null;
  amount?: number | null;
  priceType?: 'fixed' | 'estimate' | 'hourly' | null;
  availableAt?: Date | string | null;
  availabilityNote?: string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  requestTitle?: string | null;
  requestDescription?: string | null;
  requestServiceKey?: string | null;
  requestCityId?: string | null;
  requestCityName?: string | null;
  requestCategoryKey?: string | null;
  requestCategoryName?: string | null;
  requestSubcategoryName?: string | null;
  requestPreferredDate?: Date | string | null;
  requestStatus?: string | null;
  requestPrice?: number | null;
  requestPreviousPrice?: number | null;
  requestPriceTrend?: 'up' | 'down' | null;
  requestCreatedAt?: Date | string | null;
  requestIsRecurring?: boolean | null;
  requestImageUrl?: string | null;
  requestTags?: string[] | null;
};

export type WorkspaceContractSnapshot = {
  id: string;
  requestId: string;
  offerId: string;
  clientId: string;
  providerUserId: string;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  priceAmount?: number | null;
  priceType?: 'fixed' | 'estimate' | 'hourly' | null;
  priceDetails?: string | null;
  confirmedAt?: Date | string | null;
  completedAt?: Date | string | null;
  cancelledAt?: Date | string | null;
  cancelReason?: string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
};

export type WorkspaceBookingSnapshot = {
  id: string;
  requestId: string;
  offerId: string;
  contractId: string | null;
  providerUserId: string;
  clientId: string;
  startAt?: Date | string | null;
  durationMin?: number | null;
  endAt?: Date | string | null;
  status: 'confirmed' | 'cancelled' | 'completed';
};

export type WorkspaceContractReviewSnapshot = {
  clientReviewId: string | null;
  clientReviewedProviderAt: number | null;
  clientReviewRating: number | null;
  clientReviewText: string | null;
};

export type WorkspaceCustomerLifecycleStage =
  | 'draft'
  | 'published'
  | 'offers_received'
  | 'contract_pending'
  | 'in_progress'
  | 'completion_pending'
  | 'completed'
  | 'reviewed';

export type WorkspaceRequestCardModel = {
  item: WorkspaceMyRequestCardDto;
  role: WorkspaceRequestCardRole;
  workflowState: WorkspaceRequestsWorkflowState;
  decision: WorkspaceRequestDecisionDto;
  sortActivityAt: number;
  sortCreatedAt: number;
  sortBudget: number;
  sortDeadlineAt: number | null;
};


export class WorkspaceRequestsSupport {
  normalizeId(value: unknown): string | null {
    if (!value) return null;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
    const str = (value as any)?.toString?.();
    if (typeof str !== 'string') return null;
    const trimmed = str.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  parseActivityAt(value: Date | string | null | undefined): number | null {
    if (!value) return null;
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
  }
  resolveWorkspaceLocale(acceptLanguage?: string | null): WorkspaceRequestsLocale {
    const raw = String(acceptLanguage ?? '').toLowerCase();
    return raw.includes('de') ? 'de' : 'en';
  }
  formatWorkspaceDate(value: Date | string | null | undefined, locale: WorkspaceRequestsLocale): string | null {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;

    return new Intl.DateTimeFormat(locale === 'de' ? 'de-DE' : 'en-US', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  }
  formatWorkspacePrice(value: number | null | undefined, locale: WorkspaceRequestsLocale): string {
    const amount = typeof value === 'number' && Number.isFinite(value) ? value : 0;

    return new Intl.NumberFormat(locale === 'de' ? 'de-DE' : 'en-US', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(amount);
  }
  resolveWorkspaceRecurringLabel(
    locale: WorkspaceRequestsLocale,
    isRecurring: boolean | null | undefined,
  ): string {
    if (isRecurring) {
      return locale === 'de' ? 'Wiederkehrend' : 'Recurring';
    }

    return locale === 'de' ? 'Einmalig' : 'One-time';
  }
  resolveWorkspacePriceTrendLabel(
    locale: WorkspaceRequestsLocale,
    trend: 'up' | 'down' | null | undefined,
  ): string | null {
    if (trend === 'down') {
      return locale === 'de' ? 'Preis gesunken' : 'Price decreased';
    }

    if (trend === 'up') {
      return locale === 'de' ? 'Preis gestiegen' : 'Price increased';
    }

    return null;
  }
  resolveWorkspaceStatusBadge(args: {
    locale: WorkspaceRequestsLocale;
    role: WorkspaceRequestCardRole;
    workflowState: WorkspaceRequestsWorkflowState;
    requestStatus?: string | null;
    offerStatus?: WorkspaceOfferSnapshot['status'];
  }): {
    label: string | null;
    tone: 'info' | 'warning' | 'success' | 'danger' | null;
  } {
    if (args.role === 'customer') {
      if (args.requestStatus === 'draft') {
        return {
          label: args.locale === 'de' ? 'Entwurf' : 'Draft',
          tone: 'info',
        };
      }

      if (args.requestStatus === 'paused') {
        return {
          label: args.locale === 'de' ? 'Nicht veröffentlicht' : 'Unpublished',
          tone: 'warning',
        };
      }

      if (args.requestStatus === 'cancelled') {
        return {
          label: args.locale === 'de' ? 'Storniert' : 'Cancelled',
          tone: 'danger',
        };
      }

      if (args.workflowState === 'completed') {
        return {
          label: args.locale === 'de' ? 'Abgeschlossen' : 'Completed',
          tone: 'success',
        };
      }

      if (args.workflowState === 'active') {
        return {
          label: args.locale === 'de' ? 'In Arbeit' : 'In progress',
          tone: 'warning',
        };
      }

      return {
        label: args.locale === 'de' ? 'Offen' : 'Open',
        tone: 'info',
      };
    }

    if (args.offerStatus === 'accepted') {
      return {
        label: args.locale === 'de' ? 'Angenommen' : 'Accepted',
        tone: 'success',
      };
    }

    if (args.offerStatus === 'declined' || args.offerStatus === 'withdrawn') {
      return {
        label: args.locale === 'de' ? 'Abgelehnt' : 'Declined',
        tone: 'danger',
      };
    }

    if (args.offerStatus === 'sent') {
      return {
        label: args.locale === 'de' ? 'In Prüfung' : 'In review',
        tone: 'warning',
      };
    }

    return {
      label: null,
      tone: null,
    };
  }
  resolveWorkspaceCategoryLabel(request: WorkspaceRequestSnapshot): string {
    const category = String(request.categoryName ?? '').trim();
    if (category) return category;
    const subcategory = String(request.subcategoryName ?? '').trim();
    if (subcategory) return subcategory;
    const serviceKey = String(request.serviceKey ?? '').trim();
    if (serviceKey) return serviceKey;
    return 'Service';
  }
  resolveWorkspaceServiceLabel(request: WorkspaceRequestSnapshot): string {
    const subcategory = String(request.subcategoryName ?? '').trim();
    if (subcategory) return subcategory;
    const serviceKey = String(request.serviceKey ?? '').trim();
    if (serviceKey) return serviceKey;
    return this.resolveWorkspaceCategoryLabel(request);
  }
  resolveWorkspaceTitle(request: WorkspaceRequestSnapshot, category: string, locale: WorkspaceRequestsLocale): string {
    const title = String(request.title ?? '').trim();
    if (title) return title;
    const description = String(request.description ?? '').trim();
    if (description) return description.slice(0, 88);
    return locale === 'de' ? `${category} anfragen` : `${category} request`;
  }
  resolveWorkspaceStateLabel(
    locale: WorkspaceRequestsLocale,
    state: WorkspaceRequestsWorkflowState,
  ): string {
    if (locale === 'de') {
      if (state === 'open') return 'Offen';
      if (state === 'clarifying') return 'In Klärung';
      if (state === 'active') return 'In Arbeit';
      return 'Abgeschlossen';
    }

    if (state === 'open') return 'Open';
    if (state === 'clarifying') return 'Clarifying';
    if (state === 'active') return 'Active';
    return 'Completed';
  }
  resolveWorkspaceUrgency(deadlineAt: number | null, now: number): 'low' | 'medium' | 'high' | null {
    if (!deadlineAt) return null;
    const delta = deadlineAt - now;
    if (delta <= 2 * 24 * 60 * 60 * 1000) return 'high';
    if (delta <= 7 * 24 * 60 * 60 * 1000) return 'medium';
    return 'low';
  }
  resolveWorkspaceProgressSteps(
    locale: WorkspaceRequestsLocale,
    currentStep: WorkspaceRequestsProgressStep,
  ): WorkspaceMyRequestCardDto['progress']['steps'] {
    const steps = locale === 'de'
      ? [
          { key: 'request' as const, label: 'Anfrage' },
          { key: 'offers' as const, label: 'Angebote' },
          { key: 'selection' as const, label: 'Auswahl' },
          { key: 'contract' as const, label: 'Vertrag' },
          { key: 'done' as const, label: 'Abschluss' },
        ]
      : [
          { key: 'request' as const, label: 'Request' },
          { key: 'offers' as const, label: 'Offers' },
          { key: 'selection' as const, label: 'Selection' },
          { key: 'contract' as const, label: 'Contract' },
          { key: 'done' as const, label: 'Done' },
        ];

    const activeIndex = steps.findIndex((step) => step.key === currentStep);

    return steps.map((step, index) => ({
      ...step,
      status: index < activeIndex ? 'done' : index === activeIndex ? 'current' : 'upcoming',
    }));
  }
  resolveWorkspaceDecisionPriorityLevel(
    priority: number,
  ): WorkspaceRequestDecisionPriorityLevel {
    if (priority >= 90) return 'high';
    if (priority >= 70) return 'medium';
    if (priority > 0) return 'low';
    return 'none';
  }
  buildWorkspaceDecision(args: {
    locale: WorkspaceRequestsLocale;
    role: WorkspaceRequestCardRole;
    workflowState: WorkspaceRequestsWorkflowState;
    customerLifecycleStage?: WorkspaceCustomerLifecycleStage | null;
    urgency: WorkspaceMyRequestCardDto['urgency'];
    requestTitle: string;
    requestCreatedAt: number;
    requestStatus?: string | null;
    offersCount?: number;
    hasAcceptedOffer?: boolean;
    contractStatus?: WorkspaceContractSnapshot['status'] | null;
    activityAt?: number | null;
    now: number;
  }): WorkspaceRequestDecisionDto {
    const staleMs = args.now - (args.activityAt ?? args.requestCreatedAt);
    const isStale = staleMs >= 24 * 60 * 60 * 1000;
    const urgencyBonus = args.urgency === 'high' ? 10 : args.urgency === 'medium' ? 5 : 0;
    const staleBonus = isStale ? 5 : 0;

    let actionType: WorkspaceRequestDecisionActionType = 'none';
    let actionLabel: string | null = null;
    let actionReason: string | null = null;
    let actionPriority = 0;

    if (args.role === 'customer') {
      if (args.customerLifecycleStage === 'reviewed') {
        actionType = 'none';
      } else if (args.customerLifecycleStage === 'completed') {
        actionType = 'review_completion';
        actionLabel = args.locale === 'de' ? 'Bewertung abgeben' : 'Leave review';
        actionReason = args.locale === 'de'
          ? 'Der Auftrag ist abgeschlossen. Dein Feedback schließt den Vorgang sauber ab.'
          : 'The job is completed. Your feedback closes the workflow cleanly.';
        actionPriority = 80;
      } else if (args.customerLifecycleStage === 'completion_pending' || args.contractStatus === 'completed') {
        actionType = 'confirm_completion';
        actionLabel = args.locale === 'de' ? 'Fertigstellung bestätigen' : 'Confirm completion';
        actionReason = args.locale === 'de'
          ? 'Der Anbieter hat den Vorgang als erledigt markiert.'
          : 'The provider marked the work as completed.';
        actionPriority = 100;
      } else if (args.customerLifecycleStage === 'contract_pending' || args.contractStatus === 'pending' || (args.hasAcceptedOffer && !args.contractStatus)) {
        actionType = 'confirm_contract';
        actionLabel = args.locale === 'de' ? 'Vertrag ansehen' : 'View contract';
        actionReason = args.locale === 'de'
          ? 'Die nächsten Schritte hängen von deiner Vertragsbestätigung ab.'
          : 'The next step depends on your contract confirmation.';
        actionPriority = 90;
      } else if (args.customerLifecycleStage === 'offers_received' || (args.offersCount ?? 0) > 0 && args.workflowState !== 'completed') {
        actionType = 'review_offers';
        actionLabel = args.locale === 'de'
          ? 'Angebote ansehen'
          : 'View offers';
        actionReason = args.locale === 'de'
          ? 'Neue Angebote warten auf deine Auswahl.'
          : 'New offers are waiting for your decision.';
        actionPriority = 70;
      } else if (
        args.workflowState !== 'completed' &&
        (args.requestStatus === 'published' || args.requestStatus === 'matched') &&
        isStale
      ) {
        actionType = 'overdue_followup';
        actionLabel = args.locale === 'de' ? 'Seit 24h ohne Aktion' : 'No action in the last 24h';
        actionReason = args.locale === 'de'
          ? 'Dieser Vorgang wartet zu lange auf deine Entscheidung.'
          : 'This workflow has been waiting too long for your decision.';
        actionPriority = 60;
      }
    } else if (args.role === 'provider') {
      if (args.contractStatus === 'pending' || args.workflowState === 'active' && !args.contractStatus) {
        actionType = 'confirm_contract';
        actionLabel = args.locale === 'de' ? 'Vertrag bestätigen' : 'Confirm contract';
        actionReason = args.locale === 'de'
          ? 'Der Auftrag ist bereit für die nächste Bestätigung.'
          : 'The job is ready for the next confirmation.';
        actionPriority = 90;
      } else if (args.workflowState === 'clarifying' && isStale) {
        actionType = 'overdue_followup';
        actionLabel = args.locale === 'de' ? 'Seit 24h ohne Aktion' : 'No action in the last 24h';
        actionReason = args.locale === 'de'
          ? 'Diese Anfrage braucht ein Follow-up, damit sie nicht blockiert.'
          : 'This request needs a follow-up so it does not stay blocked.';
        actionPriority = 60;
      }
    }

    const boostedPriority = actionPriority > 0 ? actionPriority + urgencyBonus + staleBonus : 0;

    return {
      needsAction: actionType !== 'none',
      actionType,
      actionPriority: boostedPriority,
      actionPriorityLevel: this.resolveWorkspaceDecisionPriorityLevel(boostedPriority),
      actionLabel,
      actionReason,
      lastRelevantActivityAt:
        actionType === 'none'
          ? null
          : new Date(args.activityAt ?? args.requestCreatedAt).toISOString(),
      primaryAction: null,
    };
  }
  resolveWorkspaceDecisionPrimaryAction(args: {
    locale: WorkspaceRequestsLocale;
    requestId: string;
    detailsHref: string;
    decision: WorkspaceRequestDecisionDto;
    statusActions: WorkspaceMyRequestCardDto['status']['actions'];
  }): WorkspaceMyRequestCardDto['status']['actions'][number] | null {
    if (!args.decision.needsAction) return null;

    if (args.decision.actionType === 'reply_required') {
      return args.statusActions.find((action) => action.kind === 'open_chat')
        ?? args.statusActions.find((action) => action.key === 'open')
        ?? null;
    }

    if (args.decision.actionType === 'confirm_contract') {
      return args.statusActions.find((action) => action.key === 'contract')
        ?? args.statusActions.find((action) => action.key === 'open')
        ?? {
          key: 'open',
          kind: 'link',
          tone: 'primary',
          icon: 'briefcase',
          label: args.locale === 'de' ? 'Öffnen' : 'Open',
          href: args.detailsHref,
          requestId: args.requestId,
        };
    }

    if (args.decision.actionType === 'confirm_completion') {
      return args.statusActions.find((action) => action.key === 'contract')
        ?? args.statusActions.find((action) => action.key === 'open')
        ?? null;
    }

    if (args.decision.actionType === 'review_completion') {
      return args.statusActions.find((action) => action.key === 'review')
        ?? args.statusActions.find((action) => action.key === 'open')
        ?? null;
    }

    const primaryAction = args.statusActions.find((action) => action.tone === 'primary');
    if (primaryAction) return primaryAction;

    return args.statusActions.find((action) => action.key === 'open')
      ?? {
        key: 'open',
        kind: 'link',
        tone: 'primary',
        icon: 'briefcase',
        label: args.locale === 'de' ? 'Öffnen' : 'Open',
        href: args.detailsHref,
        requestId: args.requestId,
      };
  }
  buildWorkspaceRequestPreview(args: {
    locale: WorkspaceRequestsLocale;
    request: WorkspaceRequestSnapshot;
    title: string;
    categoryLabel: string;
    budgetValue: number | null;
    detailsHref: string;
  }): WorkspaceMyRequestCardDto['requestPreview'] {
    const excerpt = String(args.request.description ?? '').trim() || null;
    const cityLabel = String(args.request.cityName ?? '').trim() || String(args.request.cityId ?? '').trim() || null;
    const imageUrl = String(args.request.imageUrl ?? '').trim() || null;
    const priceTrend =
      args.request.priceTrend === 'up' || args.request.priceTrend === 'down'
        ? args.request.priceTrend
        : null;

    return {
      href: args.detailsHref,
      imageUrl,
      imageCategoryKey: args.request.categoryKey ?? args.request.serviceKey ?? null,
      badgeLabel: this.resolveWorkspaceRecurringLabel(args.locale, args.request.isRecurring ?? false),
      categoryLabel: args.categoryLabel,
      title: args.title,
      excerpt: excerpt && excerpt !== args.title ? excerpt : null,
      cityLabel,
      dateLabel: this.formatWorkspaceDate(args.request.preferredDate ?? args.request.createdAt ?? null, args.locale),
      priceLabel: this.formatWorkspacePrice(args.budgetValue ?? args.request.price ?? null, args.locale),
      priceTrend,
      priceTrendLabel: this.resolveWorkspacePriceTrendLabel(args.locale, priceTrend),
      tags: [
        args.categoryLabel,
        this.resolveWorkspaceServiceLabel(args.request),
        ...((args.request.tags ?? []).slice(0, 2)),
      ].filter((value, index, list) => Boolean(value) && list.indexOf(value) === index),
    };
  }
  buildWorkspaceCustomerChatAction(args: {
    locale: WorkspaceRequestsLocale;
    requestId: string;
    contract: WorkspaceContractSnapshot | null;
    selectedOffer: WorkspaceOfferSnapshot | null;
    label: string;
  }): WorkspaceMyRequestCardDto['status']['actions'][number] | null {
    const participantUserId = args.contract?.providerUserId ?? args.selectedOffer?.providerUserId ?? null;
    if (!participantUserId) return null;

    return {
      key: 'chat',
      kind: 'open_chat',
      tone: 'secondary',
      icon: 'chat',
      label: args.label,
      requestId: args.requestId,
      offerId: args.selectedOffer?.id ?? args.contract?.offerId ?? null,
      chatInput: {
        relatedEntity: {
          type: 'request',
          id: args.requestId,
        },
        participantUserId,
        participantRole: 'provider',
        requestId: args.requestId,
        providerUserId: participantUserId,
        offerId: args.selectedOffer?.id ?? args.contract?.offerId ?? undefined,
        contractId: args.contract?.id ?? undefined,
      },
    };
  }
  buildWorkspaceCustomerStatus(args: {
    locale: WorkspaceRequestsLocale;
    requestId: string;
    workflowState: WorkspaceRequestsWorkflowState;
    requestStatus?: string | null;
    lifecycleStage: WorkspaceCustomerLifecycleStage;
    contract: WorkspaceContractSnapshot | null;
    selectedOffer: WorkspaceOfferSnapshot | null;
  }): WorkspaceMyRequestCardDto['status'] {
    const badge = this.resolveWorkspaceStatusBadge({
      locale: args.locale,
      role: 'customer',
      workflowState: args.workflowState,
      requestStatus: args.requestStatus,
    });

    const detailsHref = `/requests/${args.requestId}`;
    const editAction = {
      key: 'edit-request',
      kind: 'link' as const,
      tone: 'secondary' as const,
      icon: 'edit' as const,
      label: args.locale === 'de' ? 'Bearbeiten' : 'Edit',
      href: `${detailsHref}/edit`,
      requestId: args.requestId,
    };
    const openAction = {
      key: 'open',
      kind: 'link' as const,
      tone: 'secondary' as const,
      icon: 'briefcase' as const,
      label: args.locale === 'de' ? 'Details ansehen' : 'View details',
      href: detailsHref,
      requestId: args.requestId,
    };
    const contractAction = args.contract
      ? {
          key: 'contract',
          kind: 'link' as const,
          tone: 'primary' as const,
          icon: 'briefcase' as const,
          label:
            args.lifecycleStage === 'contract_pending'
              ? (args.locale === 'de' ? 'Vertrag ansehen' : 'View contract')
              : args.lifecycleStage === 'completion_pending'
                ? (args.locale === 'de' ? 'Fertigstellung bestätigen' : 'Confirm completion')
                : (args.locale === 'de' ? 'Auftrag ansehen' : 'View job'),
          href: detailsHref,
          requestId: args.requestId,
        }
      : null;
    const reviewAction = {
      key: 'review',
      kind: 'link' as const,
      tone: 'primary' as const,
      icon: 'briefcase' as const,
      label:
        args.lifecycleStage === 'reviewed'
          ? (args.locale === 'de' ? 'Bewertung ansehen' : 'View review')
          : (args.locale === 'de' ? 'Bewertung abgeben' : 'Leave review'),
      href: detailsHref,
      requestId: args.requestId,
    };
    const responsesAction = {
      key: 'review-responses',
      kind: 'review_responses' as const,
      tone: 'primary' as const,
      icon: 'briefcase' as const,
      label: args.locale === 'de' ? 'Angebote ansehen' : 'View offers',
      href: detailsHref,
      requestId: args.requestId,
    };
    const publishAction = {
      key: 'publish-request',
      kind: 'publish_request' as const,
      tone: 'primary' as const,
      icon: 'send' as const,
      label: args.locale === 'de' ? 'Jetzt veröffentlichen' : 'Publish now',
      requestId: args.requestId,
    };
    const unpublishAction = {
      key: 'unpublish-request',
      kind: 'unpublish_request' as const,
      tone: 'primary' as const,
      icon: 'pause' as const,
      label: args.locale === 'de' ? 'Veröffentlichung pausieren' : 'Pause publication',
      requestId: args.requestId,
    };
    const messageAction = this.buildWorkspaceCustomerChatAction({
      locale: args.locale,
      requestId: args.requestId,
      contract: args.contract,
      selectedOffer: args.selectedOffer,
      label: 'Chat',
    });
    const issueAction = this.buildWorkspaceCustomerChatAction({
      locale: args.locale,
      requestId: args.requestId,
      contract: args.contract,
      selectedOffer: args.selectedOffer,
      label: args.locale === 'de' ? 'Problem melden' : 'Report an issue',
    });
    const duplicateAction = {
      key: 'duplicate-request',
      kind: 'duplicate_request' as const,
      tone: 'secondary' as const,
      icon: 'copy' as const,
      label: args.locale === 'de' ? 'Duplizieren' : 'Duplicate',
      requestId: args.requestId,
    };
    const trailingActions: WorkspaceMyRequestCardDto['status']['actions'] = args.lifecycleStage === 'reviewed'
      ? [
          duplicateAction,
          openAction,
        ]
      : [
          openAction,
          duplicateAction,
        ];

    const lifecycleActions: WorkspaceMyRequestCardDto['status']['actions'] =
      args.lifecycleStage === 'draft'
        ? [publishAction, editAction]
        : args.lifecycleStage === 'published'
          ? [unpublishAction, editAction]
          : args.lifecycleStage === 'offers_received'
            ? [responsesAction, editAction]
            : args.lifecycleStage === 'contract_pending'
              ? [contractAction, messageAction].filter((action): action is NonNullable<typeof action> => Boolean(action))
              : args.lifecycleStage === 'in_progress'
                ? [contractAction, messageAction].filter((action): action is NonNullable<typeof action> => Boolean(action))
                : args.lifecycleStage === 'completion_pending'
                  ? [contractAction, issueAction].filter((action): action is NonNullable<typeof action> => Boolean(action))
                  : [reviewAction];

    return {
      badgeLabel: badge.label,
      badgeTone: badge.tone,
      actions: [
        ...lifecycleActions,
        ...trailingActions,
        {
          key: 'share-request',
          kind: 'share_request',
          tone: 'secondary',
          icon: 'share',
          label: args.locale === 'de' ? 'Teilen' : 'Share',
          href: `/requests/${args.requestId}`,
          requestId: args.requestId,
        },
        {
          key: 'archive-request',
          kind: 'archive_request',
          tone: 'secondary',
          icon: 'archive',
          label: args.locale === 'de' ? 'Archivieren' : 'Archive',
          requestId: args.requestId,
        },
        {
          key: 'delete-request',
          kind: 'delete_request',
          tone: 'danger',
          icon: 'trash',
          label: args.locale === 'de' ? 'Löschen' : 'Delete',
          requestId: args.requestId,
        },
      ],
    };
  }
  buildWorkspaceProviderStatus(args: {
    locale: WorkspaceRequestsLocale;
    offer: WorkspaceOfferSnapshot;
    workflowState: WorkspaceRequestsWorkflowState;
  }): WorkspaceMyRequestCardDto['status'] {
    const badge = this.resolveWorkspaceStatusBadge({
      locale: args.locale,
      role: 'provider',
      workflowState: args.workflowState,
      requestStatus: args.offer.requestStatus ?? null,
      offerStatus: args.offer.status,
    });

    const actions: WorkspaceMyRequestCardDto['status']['actions'] = [];
    const chatInput = args.offer.providerUserId
      ? {
          relatedEntity: {
            type: 'offer' as const,
            id: args.offer.id,
          },
          participantUserId: args.offer.providerUserId,
          participantRole: 'provider' as const,
          requestId: args.offer.requestId,
          providerUserId: args.offer.providerUserId,
          offerId: args.offer.id,
        }
      : null;

    if (args.offer.status === 'sent') {
      actions.push(
        {
          key: 'edit-offer',
          kind: 'edit_offer',
          tone: 'secondary',
          icon: 'edit',
          label: args.locale === 'de' ? 'Bearbeiten' : 'Edit',
          requestId: args.offer.requestId,
          offerId: args.offer.id,
        },
        {
          key: 'withdraw-offer',
          kind: 'withdraw_offer',
          tone: 'danger',
          icon: 'trash',
          label: args.locale === 'de' ? 'Zurückziehen' : 'Withdraw',
          requestId: args.offer.requestId,
          offerId: args.offer.id,
        },
      );
    } else if (args.offer.status === 'accepted') {
      actions.push(
        {
          key: 'contract',
          kind: 'link',
          tone: 'primary',
          icon: 'briefcase',
          label: args.locale === 'de' ? 'Vertrag' : 'Contract',
          href: '/workspace?section=requests&scope=my&period=90d&range=90d',
          requestId: args.offer.requestId,
          offerId: args.offer.id,
        },
        {
          key: 'chat',
          kind: 'open_chat',
          tone: 'secondary',
          icon: 'chat',
          label: args.locale === 'de' ? 'Chat' : 'Chat',
          requestId: args.offer.requestId,
          offerId: args.offer.id,
          chatInput,
        },
      );
    } else if (args.offer.status === 'declined' || args.offer.status === 'withdrawn') {
      actions.push({
        key: 'send-offer',
        kind: 'send_offer',
        tone: 'primary',
        icon: 'send',
        label: args.locale === 'de' ? 'Neu anbieten' : 'Send again',
        requestId: args.offer.requestId,
      });
    } else {
      actions.push({
        key: 'open',
        kind: 'link',
        tone: 'secondary',
        icon: 'briefcase',
        label: args.locale === 'de' ? 'Öffnen' : 'Open',
        href: `/requests/${args.offer.requestId}`,
        requestId: args.offer.requestId,
      });
    }

    return {
      badgeLabel: badge.label,
      badgeTone: badge.tone,
      actions,
    };
  }
  pickLatestByRequest<T extends { requestId: string; updatedAt?: Date | string | null; createdAt?: Date | string | null }>(
    items: T[],
  ) {
    return items.reduce((map, item) => {
      const current = map.get(item.requestId);
      const currentTs = this.parseActivityAt(current?.updatedAt) ?? this.parseActivityAt(current?.createdAt) ?? 0;
      const nextTs = this.parseActivityAt(item.updatedAt) ?? this.parseActivityAt(item.createdAt) ?? 0;
      if (!current || nextTs >= currentTs) {
        map.set(item.requestId, item);
      }
      return map;
    }, new Map<string, T>());
  }
}
