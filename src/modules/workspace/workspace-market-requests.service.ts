import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { FilterQuery, Model, SortOrder } from 'mongoose';

import { CatalogServicesService } from '../catalog/services/services.service';
import { Request, type RequestDocument, type RequestStatus } from '../requests/schemas/request.schema';
import type { WorkspaceRequestsQueryDto } from './dto/workspace-requests-query.dto';
import type {
  WorkspaceMyRequestCardDto,
  WorkspaceRequestsResponseDto,
} from './dto/workspace-requests-response.dto';
import { WorkspaceRequestsListPolicy } from './workspace-requests-list-policy';
import { WorkspaceRequestsPresenter } from './workspace-requests.presenter';
import {
  WORKSPACE_REQUESTS_PERIOD_MS,
  type WorkspaceRequestCardModel,
  type WorkspaceRequestsLocale,
  type WorkspaceRequestsState,
  WorkspaceRequestsSupport,
} from './workspace-requests.support';

const MARKET_REQUEST_STATUSES: RequestStatus[] = ['published', 'matched', 'closed'];
const DAY_IN_MS = 24 * 60 * 60 * 1000;
type MarketRequestDocument = RequestDocument & {
  id: string;
  createdAt: Date;
  updatedAt?: Date | null;
  publishedAt?: Date | null;
  matchedAt?: Date | null;
};

@Injectable()
export class WorkspaceMarketRequestsService {
  private readonly support = new WorkspaceRequestsSupport();

  constructor(
    @InjectModel(Request.name) private readonly requestModel: Model<RequestDocument>,
    private readonly catalogServices: CatalogServicesService,
    private readonly listPolicy: WorkspaceRequestsListPolicy,
    private readonly presenter: WorkspaceRequestsPresenter,
  ) {}

  private async buildBaseMatch(query: WorkspaceRequestsQueryDto, now: number): Promise<FilterQuery<RequestDocument>> {
    const match: FilterQuery<RequestDocument> = {
      archivedAt: null,
      status: { $in: MARKET_REQUEST_STATUSES },
      updatedAt: {
        $gte: new Date(now - WORKSPACE_REQUESTS_PERIOD_MS[query.period ?? '30d']),
      },
    };

    const city = String(query.city ?? '').trim();
    if (city) {
      match.cityId = city;
    }

    const category = String(query.category ?? '').trim().toLowerCase();
    const service = String(query.service ?? '').trim().toLowerCase();

    if (service) {
      match.serviceKey = service;

      if (category) {
        const services = await this.catalogServices.listServices(category);
        const allowed = new Set(services.map((item) => item.key));
        if (!allowed.has(service)) {
          return { _id: { $exists: false } };
        }
      }
    } else if (category) {
      const services = await this.catalogServices.listServices(category);
      if (services.length === 0) {
        return { _id: { $exists: false } };
      }
      match.serviceKey = { $in: services.map((item) => item.key) };
    }

    return match;
  }

  private resolveStateStatuses(state: WorkspaceRequestsState): RequestStatus[] {
    if (state === 'attention') return ['published'];
    if (state === 'execution') return ['matched'];
    if (state === 'completed') return ['closed'];
    return MARKET_REQUEST_STATUSES;
  }

  private buildListSort(sort: WorkspaceRequestsQueryDto['sort']): Record<string, SortOrder> {
    const resolvedSort = sort ?? 'date_desc';

    if (resolvedSort === 'date_asc' || resolvedSort === 'oldest') {
      return { createdAt: 1 };
    }

    if (resolvedSort === 'newest' || resolvedSort === 'date_desc' || resolvedSort === 'activity') {
      return { updatedAt: -1, createdAt: -1 };
    }

    if (resolvedSort === 'deadline') {
      return { preferredDate: 1, updatedAt: -1 };
    }

    if (resolvedSort === 'price_asc') {
      return { price: 1, updatedAt: -1, createdAt: -1 };
    }

    return { price: -1, updatedAt: -1, createdAt: -1 };
  }

  private resolveWorkflowState(status: RequestStatus): WorkspaceRequestCardModel['workflowState'] {
    if (status === 'matched') return 'active';
    if (status === 'closed') return 'completed';
    return 'open';
  }

  private resolveDecision(args: {
    locale: WorkspaceRequestsLocale;
    doc: MarketRequestDocument;
    now: number;
  }): WorkspaceMyRequestCardDto['decision'] {
    const isOverdue = args.now - (args.doc.publishedAt?.getTime() ?? args.doc.createdAt.getTime()) >= DAY_IN_MS;

    if (args.doc.status === 'matched') {
      return {
        needsAction: true,
        actionType: 'confirm_contract',
        actionPriority: 90,
        actionPriorityLevel: 'high',
        actionLabel: args.locale === 'de' ? 'Vertrag ansehen' : 'View contract',
        actionReason: args.locale === 'de' ? 'Bereits vergeben' : 'Already assigned',
        lastRelevantActivityAt: (args.doc.matchedAt ?? args.doc.updatedAt ?? args.doc.createdAt).toISOString(),
        primaryAction: null,
      };
    }

    if (args.doc.status === 'published' && isOverdue) {
      return {
        needsAction: true,
        actionType: 'overdue_followup',
        actionPriority: 75,
        actionPriorityLevel: 'medium',
        actionLabel: args.locale === 'de' ? 'Seit 24h ohne Aktion' : 'No action for 24h',
        actionReason: args.locale === 'de' ? 'Offene Nachfrage' : 'Open demand',
        lastRelevantActivityAt: (args.doc.publishedAt ?? args.doc.createdAt).toISOString(),
        primaryAction: null,
      };
    }

    if (args.doc.status === 'published') {
      return {
        needsAction: true,
        actionType: 'review_offers',
        actionPriority: 45,
        actionPriorityLevel: 'low',
        actionLabel: args.locale === 'de' ? 'Neu im Markt' : 'New on market',
        actionReason: args.locale === 'de' ? 'Neues Marktsignal' : 'New market signal',
        lastRelevantActivityAt: (args.doc.publishedAt ?? args.doc.createdAt).toISOString(),
        primaryAction: null,
      };
    }

    return {
      needsAction: false,
      actionType: 'none',
      actionPriority: 0,
      actionPriorityLevel: 'none',
      actionLabel: null,
      actionReason: null,
      lastRelevantActivityAt: null,
      primaryAction: null,
    };
  }

  private buildMarketCard(args: {
    locale: WorkspaceRequestsLocale;
    doc: MarketRequestDocument;
    now: number;
  }): WorkspaceRequestCardModel {
    const { locale, doc, now } = args;
    const category = this.support.resolveWorkspaceCategoryLabel(doc);
    const title = this.support.resolveWorkspaceTitle(doc as any, category, locale);
    const workflowState = this.resolveWorkflowState(doc.status);
    const preferredAt = this.support.parseActivityAt(doc.preferredDate);
    const createdAt = this.support.parseActivityAt(doc.createdAt) ?? now;
    const activityAt = this.support.parseActivityAt(
      doc.status === 'matched'
        ? (doc.matchedAt ?? doc.updatedAt ?? doc.createdAt)
        : doc.status === 'closed'
          ? (doc.updatedAt ?? doc.createdAt)
          : (doc.publishedAt ?? doc.createdAt),
    ) ?? createdAt;
    const urgency = workflowState === 'open'
      ? 'high'
      : workflowState === 'active'
        ? 'medium'
        : 'low';
    const detailsHref = `/requests/${doc.id}`;
    const decision = this.resolveDecision({ locale, doc, now });
    const budgetValue = typeof doc.price === 'number' ? doc.price : null;

    return {
      role: 'provider',
      workflowState,
      sortActivityAt: activityAt,
      sortCreatedAt: createdAt,
      sortBudget: budgetValue ?? 0,
      sortDeadlineAt: preferredAt,
      decision,
      item: {
        id: `market:${doc.id}`,
        requestId: String(doc.id),
        role: 'provider',
        ownerLifecycleStage: null,
        lifecycleState: null,
        title,
        category,
        subcategory: doc.subcategoryName ?? null,
        city: doc.cityName ?? doc.cityId ?? null,
        createdAt: this.support.formatWorkspaceDate(doc.createdAt, locale),
        createdAtIso: doc.createdAt?.toISOString() ?? null,
        nextEventAt: this.support.formatWorkspaceDate(doc.preferredDate ?? null, locale),
        nextEventAtIso: doc.preferredDate ? new Date(doc.preferredDate).toISOString() : null,
        budget: budgetValue,
        agreedPrice: doc.status === 'matched' ? budgetValue : null,
        state: workflowState,
        stateLabel: this.support.resolveWorkspaceStateLabel(locale, workflowState),
        urgency,
        activity: workflowState === 'completed'
          ? {
              label: locale === 'de' ? 'Auftrag abgeschlossen' : 'Job completed',
              tone: 'success',
            }
          : workflowState === 'active'
            ? {
                label: locale === 'de' ? 'Bereits vergeben' : 'Already assigned',
                tone: 'info',
              }
            : {
                label: decision.actionLabel ?? (locale === 'de' ? 'Aktuelle Nachfrage' : 'Current demand'),
                tone: decision.actionType === 'overdue_followup' ? 'warning' : 'neutral',
              },
        visibility: {
          inPublicFeed: doc.status === 'published',
          retainedForParticipants: false,
          isInactive: false,
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
        capabilities: {
          canManage: false,
          canEdit: false,
          canDelete: false,
          canDuplicate: false,
          canRestore: false,
          canReviewOffers: false,
          canPublish: false,
          canUnpublish: false,
        },
        progress: {
          currentStep: workflowState === 'completed' ? 'done' : workflowState === 'active' ? 'contract' : 'request',
          steps: this.support.resolveWorkspaceProgressSteps(
            locale,
            workflowState === 'completed' ? 'done' : workflowState === 'active' ? 'contract' : 'request',
          ),
        },
        quickActions: [],
        requestPreview: this.support.buildWorkspaceRequestPreview({
          locale,
          request: doc as any,
          title,
          categoryLabel: category,
          budgetValue,
          detailsHref,
        }),
        status: {
          badgeLabel: null,
          badgeTone: null,
          actions: [],
        },
        menuActions: [],
        primaryAction: null,
        secondaryAction: null,
        decision,
      },
    };
  }

  async getMarketOverview(
    query: WorkspaceRequestsQueryDto,
    acceptLanguage?: string | null,
  ): Promise<WorkspaceRequestsResponseDto> {
    const locale = this.support.resolveWorkspaceLocale(acceptLanguage);
    const now = Date.now();
    const state: WorkspaceRequestsState = query.state ?? 'all';
    const period = query.period ?? '30d';
    const sort = query.sort ?? 'date_desc';
    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
    const baseMatch = await this.buildBaseMatch(query, now);
    const stateStatuses = this.resolveStateStatuses(state);
    const listMatch: FilterQuery<RequestDocument> = {
      ...baseMatch,
      status: { $in: stateStatuses },
    };
    const staleCutoff = new Date(now - DAY_IN_MS);
    const [attentionCount, executionCount, completedCount, overdueCount, recentCount, total, listDocs, matchedQueueDocs, overdueQueueDocs, recentQueueDocs] = await Promise.all([
      this.requestModel.countDocuments({ ...baseMatch, status: 'published' }).exec(),
      this.requestModel.countDocuments({ ...baseMatch, status: 'matched' }).exec(),
      this.requestModel.countDocuments({ ...baseMatch, status: 'closed' }).exec(),
      this.requestModel.countDocuments({ ...baseMatch, status: 'published', createdAt: { $lt: staleCutoff } }).exec(),
      this.requestModel.countDocuments({ ...baseMatch, status: 'published', createdAt: { $gte: staleCutoff } }).exec(),
      this.requestModel.countDocuments(listMatch).exec(),
      this.requestModel.find(listMatch).sort(this.buildListSort(sort)).skip((page - 1) * limit).limit(limit).exec(),
      this.requestModel.find({ ...baseMatch, status: 'matched' }).sort({ matchedAt: -1, updatedAt: -1, createdAt: -1 }).limit(5).exec(),
      this.requestModel.find({ ...baseMatch, status: 'published', createdAt: { $lt: staleCutoff } }).sort({ createdAt: 1 }).limit(5).exec(),
      this.requestModel.find({ ...baseMatch, status: 'published', createdAt: { $gte: staleCutoff } }).sort({ createdAt: -1 }).limit(5).exec(),
    ]);
    const listCards = (listDocs as unknown as MarketRequestDocument[]).map((doc) => this.buildMarketCard({ locale, doc, now }));
    const queueCards = ([...matchedQueueDocs, ...overdueQueueDocs, ...recentQueueDocs] as unknown as MarketRequestDocument[])
      .map((doc) => this.buildMarketCard({ locale, doc, now }))
      .slice(0, 5);
    const listResult = this.listPolicy.resolve({
      cards: listCards,
      query: {
        ...query,
        page: 1,
        limit: listCards.length || limit,
      } as WorkspaceRequestsQueryDto,
      role: 'all',
      state: 'all',
      now,
    });

    return {
      section: 'requests',
      scope: 'market',
      header: {
        title: locale === 'de' ? 'Marktanfragen' : 'Market requests',
        subtitle: locale === 'de'
          ? 'Ein gemeinsamer Marktblick für Nachfrage, Vergabe und Abschlüsse.'
          : 'One shared market view for demand, assignments, and completions.',
      },
      filters: {
        city: query.city ?? null,
        category: query.category ?? null,
        service: query.service ?? null,
        period,
        role: 'all',
        state,
        sort,
      },
      summary: {
        items: this.presenter.buildWorkspaceSummaryFromCounts({
          locale,
          activeState: state,
          counts: {
            all: attentionCount + executionCount + completedCount,
            attention: attentionCount,
            execution: executionCount,
            completed: completedCount,
          },
        }),
      },
      list: {
        total,
        page,
        limit,
        hasMore: page * limit < total,
        items: listResult.sortedCards.map((card) => card.item),
      },
      decisionPanel: this.presenter.buildWorkspaceMarketDecisionPanel({
        locale,
        queueCards,
        counts: {
          attention: attentionCount,
          execution: executionCount,
          completed: completedCount,
          overdue: overdueCount,
          recent: recentCount,
        },
      }),
      sidePanel: null,
    };
  }
}
