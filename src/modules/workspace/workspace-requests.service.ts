import { Injectable } from '@nestjs/common';

import type { AppRole } from '../users/schemas/user.schema';
import type { WorkspaceRequestsQueryDto } from './dto/workspace-requests-query.dto';
import type { WorkspaceRequestsResponseDto } from './dto/workspace-requests-response.dto';
import {
  WORKSPACE_REQUESTS_PERIOD_MS,
  WorkspaceRequestsRole,
  WorkspaceRequestsState,
  WorkspaceRequestsSupport,
} from './workspace-requests.support';
import { WorkspaceRequestCardsBuilder } from './workspace-request-cards.builder';
import { WorkspaceRequestSnapshotsService } from './workspace-request-snapshots.service';
import { WorkspaceRequestsPresenter } from './workspace-requests.presenter';

@Injectable()
export class WorkspaceRequestsService {
  private readonly support = new WorkspaceRequestsSupport();
  private readonly cards = new WorkspaceRequestCardsBuilder(this.support);

  constructor(
    private readonly snapshots: WorkspaceRequestSnapshotsService,
    private readonly presenter: WorkspaceRequestsPresenter,
  ) {}

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
    const decisionPanel = this.presenter.buildWorkspaceDecisionPanel({
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
        items: this.presenter.buildWorkspaceSummary({
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
      sidePanel: this.presenter.buildWorkspaceSidePanel({
        locale,
        role,
        cards: cardsByRole,
      }),
    };
  }
}
