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

const WORKSPACE_REQUESTS_PERIOD_MS = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  '90d': 90 * 24 * 60 * 60 * 1000,
} as const;

type WorkspaceRequestsLocale = 'de' | 'en';
type WorkspaceRequestsRole = 'all' | 'customer' | 'provider';
type WorkspaceRequestsState = 'all' | 'attention' | 'execution' | 'completed';
type WorkspaceRequestsWorkflowState = 'open' | 'clarifying' | 'active' | 'completed';
type WorkspaceRequestsProgressStep = 'request' | 'offers' | 'selection' | 'contract' | 'done';
type WorkspaceRequestCardRole = 'customer' | 'provider';
type WorkspaceRequestDecisionActionType =
  | 'review_offers'
  | 'reply_required'
  | 'confirm_contract'
  | 'confirm_completion'
  | 'review_completion'
  | 'overdue_followup'
  | 'none';
type WorkspaceRequestDecisionPriorityLevel = 'high' | 'medium' | 'low' | 'none';

type WorkspaceRequestSnapshot = {
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

type WorkspaceOfferSnapshot = {
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

type WorkspaceContractSnapshot = {
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

type WorkspaceBookingSnapshot = {
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

type WorkspaceContractReviewSnapshot = {
  clientReviewId: string | null;
  clientReviewedProviderAt: number | null;
  clientReviewRating: number | null;
  clientReviewText: string | null;
};

type WorkspaceCustomerLifecycleStage =
  | 'draft'
  | 'published'
  | 'offers_received'
  | 'contract_pending'
  | 'in_progress'
  | 'completion_pending'
  | 'completed'
  | 'reviewed';

type WorkspaceRequestCardModel = {
  item: WorkspaceMyRequestCardDto;
  role: WorkspaceRequestCardRole;
  workflowState: WorkspaceRequestsWorkflowState;
  decision: WorkspaceRequestDecisionDto;
  sortActivityAt: number;
  sortCreatedAt: number;
  sortBudget: number;
  sortDeadlineAt: number | null;
};

@Injectable()
export class WorkspaceRequestsService {
  constructor(
    @InjectModel(Request.name) private readonly requestModel: Model<RequestDocument>,
    @InjectModel(Offer.name) private readonly offerModel: Model<OfferDocument>,
    @InjectModel(Contract.name) private readonly contractModel: Model<ContractDocument>,
    @InjectModel(Booking.name) private readonly bookingModel: Model<BookingDocument>,
    @InjectModel(Review.name) private readonly reviewModel: Model<ReviewDocument>,
  ) {}

  private normalizeId(value: unknown): string | null {
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
  private parseActivityAt(value: Date | string | null | undefined): number | null {
    if (!value) return null;
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
  }
  private resolveWorkspaceLocale(acceptLanguage?: string | null): WorkspaceRequestsLocale {
    const raw = String(acceptLanguage ?? '').toLowerCase();
    return raw.includes('de') ? 'de' : 'en';
  }
  private formatWorkspaceDate(value: Date | string | null | undefined, locale: WorkspaceRequestsLocale): string | null {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;

    return new Intl.DateTimeFormat(locale === 'de' ? 'de-DE' : 'en-US', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  }
  private formatWorkspacePrice(value: number | null | undefined, locale: WorkspaceRequestsLocale): string {
    const amount = typeof value === 'number' && Number.isFinite(value) ? value : 0;

    return new Intl.NumberFormat(locale === 'de' ? 'de-DE' : 'en-US', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(amount);
  }
  private resolveWorkspaceRecurringLabel(
    locale: WorkspaceRequestsLocale,
    isRecurring: boolean | null | undefined,
  ): string {
    if (isRecurring) {
      return locale === 'de' ? 'Wiederkehrend' : 'Recurring';
    }

    return locale === 'de' ? 'Einmalig' : 'One-time';
  }
  private resolveWorkspacePriceTrendLabel(
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
  private resolveWorkspaceStatusBadge(args: {
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
  private resolveWorkspaceCategoryLabel(request: WorkspaceRequestSnapshot): string {
    const category = String(request.categoryName ?? '').trim();
    if (category) return category;
    const subcategory = String(request.subcategoryName ?? '').trim();
    if (subcategory) return subcategory;
    const serviceKey = String(request.serviceKey ?? '').trim();
    if (serviceKey) return serviceKey;
    return 'Service';
  }
  private resolveWorkspaceServiceLabel(request: WorkspaceRequestSnapshot): string {
    const subcategory = String(request.subcategoryName ?? '').trim();
    if (subcategory) return subcategory;
    const serviceKey = String(request.serviceKey ?? '').trim();
    if (serviceKey) return serviceKey;
    return this.resolveWorkspaceCategoryLabel(request);
  }
  private resolveWorkspaceTitle(request: WorkspaceRequestSnapshot, category: string, locale: WorkspaceRequestsLocale): string {
    const title = String(request.title ?? '').trim();
    if (title) return title;
    const description = String(request.description ?? '').trim();
    if (description) return description.slice(0, 88);
    return locale === 'de' ? `${category} anfragen` : `${category} request`;
  }
  private resolveWorkspaceStateLabel(
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
  private resolveWorkspaceUrgency(deadlineAt: number | null, now: number): 'low' | 'medium' | 'high' | null {
    if (!deadlineAt) return null;
    const delta = deadlineAt - now;
    if (delta <= 2 * 24 * 60 * 60 * 1000) return 'high';
    if (delta <= 7 * 24 * 60 * 60 * 1000) return 'medium';
    return 'low';
  }
  private resolveWorkspaceProgressSteps(
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
  private resolveWorkspaceDecisionPriorityLevel(
    priority: number,
  ): WorkspaceRequestDecisionPriorityLevel {
    if (priority >= 90) return 'high';
    if (priority >= 70) return 'medium';
    if (priority > 0) return 'low';
    return 'none';
  }
  private buildWorkspaceDecision(args: {
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
  private resolveWorkspaceDecisionPrimaryAction(args: {
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
  private buildWorkspaceRequestPreview(args: {
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
  private buildWorkspaceCustomerChatAction(args: {
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
  private buildWorkspaceCustomerStatus(args: {
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
  private buildWorkspaceProviderStatus(args: {
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
  private pickLatestByRequest<T extends { requestId: string; updatedAt?: Date | string | null; createdAt?: Date | string | null }>(
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
    const category = this.resolveWorkspaceCategoryLabel(request);
    const title = this.resolveWorkspaceTitle(request, category, locale);
    const city = String(request.cityName ?? '').trim() || String(request.cityId ?? '').trim() || null;
    const preferredAt = this.parseActivityAt(request.preferredDate);
    const createdAt = this.parseActivityAt(request.createdAt) ?? now;
    const contractConfirmedAt = this.parseActivityAt(contract?.confirmedAt ?? contract?.createdAt ?? null);
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
            ? `Leistung geplant für ${this.formatWorkspaceDate(booking.startAt, locale)}`
            : `Service scheduled for ${this.formatWorkspaceDate(booking.startAt, locale)}`
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
    const deadlineAt = this.parseActivityAt(booking?.startAt ?? null) ?? contractConfirmedAt ?? preferredAt;
    const detailsHref = `/requests/${request.id}`;
    const status = this.buildWorkspaceCustomerStatus({
      locale,
      requestId: request.id,
      workflowState: state,
      requestStatus: request.status ?? null,
      lifecycleStage,
      contract,
      selectedOffer,
    });
    const decision = this.buildWorkspaceDecision({
      locale,
      role: 'customer',
      workflowState: state,
      customerLifecycleStage: lifecycleStage,
      urgency: this.resolveWorkspaceUrgency(deadlineAt, now),
      requestTitle: title,
      requestCreatedAt: createdAt,
      requestStatus: request.status ?? null,
      offersCount: offers.length,
      hasAcceptedOffer: offers.some((offer) => offer.status === 'accepted'),
      contractStatus: contract?.status ?? null,
      activityAt: this.parseActivityAt(contract?.updatedAt ?? contract?.createdAt ?? null)
        ?? this.parseActivityAt(offers[0]?.updatedAt ?? offers[0]?.createdAt ?? null)
        ?? preferredAt
        ?? createdAt,
      now,
    });
    decision.primaryAction = this.resolveWorkspaceDecisionPrimaryAction({
      locale,
      requestId: request.id,
      detailsHref,
      decision,
      statusActions: status.actions,
    });
    const urgency = this.resolveWorkspaceUrgency(deadlineAt, now);

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
        createdAt: this.formatWorkspaceDate(request.createdAt, locale),
        nextEventAt: this.formatWorkspaceDate(booking?.startAt ?? contract?.confirmedAt ?? request.preferredDate ?? null, locale),
        budget: typeof budgetValue === 'number' ? budgetValue : null,
        agreedPrice: typeof contract?.priceAmount === 'number' ? contract.priceAmount : null,
        state,
        stateLabel: this.resolveWorkspaceStateLabel(locale, state),
        urgency,
        activity,
        progress: {
          currentStep: progressStep,
          steps: this.resolveWorkspaceProgressSteps(locale, progressStep),
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
        requestPreview: this.buildWorkspaceRequestPreview({
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
    const category = this.resolveWorkspaceCategoryLabel(request);
    const title = this.resolveWorkspaceTitle(request, category, locale);
    const city = String(request.cityName ?? '').trim() || String(request.cityId ?? '').trim() || null;
    const offerCreatedAt = this.parseActivityAt(offer.createdAt) ?? now;
    const nextEventAt = this.parseActivityAt(contract?.confirmedAt ?? request.preferredDate ?? offer.availableAt ?? null);
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
            ? `Auftrag beginnt ${this.formatWorkspaceDate(contract.confirmedAt ?? request.preferredDate ?? offer.availableAt, locale)}`
            : `Job starts ${this.formatWorkspaceDate(contract.confirmedAt ?? request.preferredDate ?? offer.availableAt, locale)}`
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
    const status = this.buildWorkspaceProviderStatus({
      locale,
      offer,
      workflowState: state,
    });
    const urgency = this.resolveWorkspaceUrgency(nextEventAt, now);
    const decision = this.buildWorkspaceDecision({
      locale,
      role: 'provider',
      workflowState: state,
      urgency,
      requestTitle: title,
      requestCreatedAt: offerCreatedAt,
      requestStatus: request.status ?? null,
      contractStatus: contract?.status ?? null,
      activityAt:
        this.parseActivityAt(contract?.updatedAt ?? contract?.confirmedAt ?? null)
        ?? this.parseActivityAt(offer.updatedAt ?? offer.createdAt)
        ?? nextEventAt
        ?? offerCreatedAt,
      now,
    });
    decision.primaryAction = this.resolveWorkspaceDecisionPrimaryAction({
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
        createdAt: this.formatWorkspaceDate(offer.createdAt, locale),
        nextEventAt: this.formatWorkspaceDate(contract?.confirmedAt ?? request.preferredDate ?? offer.availableAt ?? null, locale),
        budget: typeof budgetValue === 'number' ? budgetValue : null,
        agreedPrice: typeof contract?.priceAmount === 'number' ? contract.priceAmount : null,
        state,
        stateLabel: this.resolveWorkspaceStateLabel(locale, state),
        urgency,
        activity,
        progress: {
          currentStep: progressStep,
          steps: this.resolveWorkspaceProgressSteps(locale, progressStep),
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
        requestPreview: this.buildWorkspaceRequestPreview({
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
        ?? this.parseActivityAt(contract?.updatedAt ?? offer.updatedAt ?? offer.createdAt)
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
        const leftRelevant = this.parseActivityAt(left.decision.lastRelevantActivityAt) ?? 0;
        const rightRelevant = this.parseActivityAt(right.decision.lastRelevantActivityAt) ?? 0;

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
    const locale = this.resolveWorkspaceLocale(acceptLanguage);
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
        providerUserId: this.normalizeId(offer.providerUserId),
        clientUserId: this.normalizeId(offer.clientUserId),
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

    const providerOfferByRequest = this.pickLatestByRequest(
      (myProviderOffers ?? []).map((offer) => ({
        ...offer,
        requestId: String(offer.requestId ?? '').trim(),
      })),
    );
    const providerContractByRequest = this.pickLatestByRequest(
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
    const clientContractByRequest = this.pickLatestByRequest(
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
        clientReviewedProviderAt: this.parseActivityAt(review.createdAt),
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
