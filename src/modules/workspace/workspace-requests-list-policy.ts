import { Injectable } from '@nestjs/common';

import {
  WORKSPACE_REQUESTS_PERIOD_MS,
  WorkspaceRequestCardModel,
  WorkspaceRequestsRole,
  WorkspaceRequestsState,
} from './workspace-requests.support';
import type { WorkspaceRequestsQueryDto } from './dto/workspace-requests-query.dto';

export type WorkspaceRequestListPolicyResult = {
  cardsByRole: WorkspaceRequestCardModel[];
  sortedCards: WorkspaceRequestCardModel[];
  pagedCards: WorkspaceRequestCardModel[];
  total: number;
  limit: number;
  page: number;
};

@Injectable()
export class WorkspaceRequestsListPolicy {
  resolve(args: {
    cards: WorkspaceRequestCardModel[];
    query: WorkspaceRequestsQueryDto;
    role: WorkspaceRequestsRole;
    state: WorkspaceRequestsState;
    now: number;
  }): WorkspaceRequestListPolicyResult {
    const { cards, query, role, state, now } = args;
    const period = query.period ?? '30d';
    const sort = query.sort ?? 'activity';
    const page = Math.max(query.page ?? 1, 1);

    const periodCutoff = now - WORKSPACE_REQUESTS_PERIOD_MS[period];
    const cardsInPeriod = cards.filter((card) => card.sortActivityAt >= periodCutoff);
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

    return {
      cardsByRole,
      sortedCards,
      pagedCards,
      total,
      limit,
      page,
    };
  }
}
