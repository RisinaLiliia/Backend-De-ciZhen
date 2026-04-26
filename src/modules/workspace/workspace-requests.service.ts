import { Injectable } from '@nestjs/common';

import type { AppRole } from '../users/schemas/user.schema';
import type { WorkspaceRequestsQueryDto } from './dto/workspace-requests-query.dto';
import type { WorkspaceRequestsResponseDto } from './dto/workspace-requests-response.dto';
import {
  WorkspaceRequestsRole,
  WorkspaceRequestsState,
  WorkspaceRequestsSupport,
} from './workspace-requests.support';
import { WorkspaceRequestCardsBuilder } from './workspace-request-cards.builder';
import { WorkspaceRequestSnapshotsService } from './workspace-request-snapshots.service';
import { WorkspaceRequestsListPolicy } from './workspace-requests-list-policy';
import { WorkspaceRequestsPresenter } from './workspace-requests.presenter';

@Injectable()
export class WorkspaceRequestsService {
  private readonly support = new WorkspaceRequestsSupport();
  private readonly cards = new WorkspaceRequestCardsBuilder(this.support);

  constructor(
    private readonly snapshots: WorkspaceRequestSnapshotsService,
    private readonly listPolicy: WorkspaceRequestsListPolicy,
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
    const { cardsByRole, pagedCards, total, limit, page: resolvedPage } = this.listPolicy.resolve({
      cards: allCards,
      query,
      role,
      state,
      now,
    });
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
        page: resolvedPage,
        limit,
        hasMore: resolvedPage * limit < total,
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
