import { Injectable } from '@nestjs/common';

import { ReviewsService } from '../reviews/reviews.service';
import type { AppRole } from '../users/schemas/user.schema';
import type { WorkspaceReviewsQueryDto } from './dto/workspace-reviews-query.dto';
import type {
  WorkspaceReviewsDecisionQueueItemDto,
  WorkspaceReviewsResponseDto,
} from './dto/workspace-reviews-response.dto';
import { WorkspaceRequestsSupport, type WorkspaceRequestsLocale } from './workspace-requests.support';

@Injectable()
export class WorkspaceReviewsService {
  private readonly support = new WorkspaceRequestsSupport();

  constructor(private readonly reviews: ReviewsService) {}

  async getReviewsRail(
    query: WorkspaceReviewsQueryDto,
    userId?: string | null,
    _role?: AppRole | null,
    acceptLanguage?: string | null,
  ): Promise<WorkspaceReviewsResponseDto> {
    const locale = this.support.resolveWorkspaceLocale(acceptLanguage);
    const range = query.range ?? '30d';
    const sort = query.sort ?? 'created_desc';
    const overview = await this.reviews.getPlatformOverview(5, 0, sort, range);
    const distribution = overview.summary.distribution;
    const total = overview.summary.total;
    const positive =
      Number(distribution['4'] ?? 0) +
      Number(distribution['5'] ?? 0);
    const critical =
      Number(distribution['1'] ?? 0) +
      Number(distribution['2'] ?? 0);
    const recent = overview.items.length;

    const queue: WorkspaceReviewsDecisionQueueItemDto[] = overview.items.map((item) => {
      const rating = Number(item.rating ?? 0);
      const priorityLevel: WorkspaceReviewsDecisionQueueItemDto['actionPriorityLevel'] = rating <= 2
        ? 'high'
        : rating === 3
          ? 'medium'
          : 'low';
      const actionPriority = rating <= 2 ? 95 : rating === 3 ? 70 : 45;

      return {
        reviewId: String(item._id),
        title: String(item.authorName ?? '').trim() || (locale === 'de' ? 'Anonym' : 'Anonymous'),
        actionType: 'review_feedback' as const,
        actionLabel: locale === 'de'
          ? `${Math.max(1, Math.min(5, Math.round(rating)))}★ Bewertung`
          : `${Math.max(1, Math.min(5, Math.round(rating)))}★ review`,
        actionPriority,
        actionPriorityLevel: priorityLevel,
        actionReason: item.text?.trim() ? item.text.trim().slice(0, 120) : null,
        href: '/workspace?section=reviews',
      };
    });

    const totalNeedsAction = queue.filter((item) => item.actionPriorityLevel !== 'low').length;

    return {
      section: 'reviews',
      header: {
        title: locale === 'de' ? 'Plattformbewertungen' : 'Platform reviews',
        subtitle: locale === 'de'
          ? 'Ein gemeinsamer Blick auf aktuelle Stimmen, Qualität und kritisches Feedback.'
          : 'A shared view of current feedback, quality, and critical reviews.',
      },
      filters: {
        range,
        sort,
      },
      summary: {
        items: [
          {
            key: 'all',
            label: locale === 'de' ? 'Alle' : 'All',
            value: total,
            helper: locale === 'de' ? 'Plattformstimmen im Zeitraum' : 'Platform voices in range',
            tone: 'all',
          },
          {
            key: 'positive',
            label: locale === 'de' ? 'Positiv' : 'Positive',
            value: positive,
            helper: locale === 'de' ? '4-5 Sterne' : '4-5 stars',
            tone: 'execution',
          },
          {
            key: 'critical',
            label: locale === 'de' ? 'Kritisch' : 'Critical',
            value: critical,
            helper: locale === 'de' ? '1-2 Sterne' : '1-2 stars',
            tone: 'attention',
          },
          {
            key: 'recent',
            label: locale === 'de' ? 'Neu' : 'Recent',
            value: recent,
            helper: locale === 'de' ? 'Aktuelle Stimmen' : 'Latest feedback',
            tone: 'completed',
          },
        ],
      },
      decisionPanel: {
        eyebrow: locale === 'de' ? 'Decision Panel' : 'Decision panel',
        totalNeedsAction,
        title: totalNeedsAction > 0
          ? (locale === 'de' ? 'Feedback im Fokus' : 'Feedback in focus')
          : (locale === 'de' ? 'Kein kritisches Feedback' : 'No critical feedback'),
        text: totalNeedsAction > 0
          ? (
            locale === 'de'
              ? `${critical} kritische und ${recent} aktuelle Stimmen im gewählten Zeitraum.`
              : `${critical} critical and ${recent} current voices in the selected range.`
          )
          : (locale === 'de'
            ? 'Im aktuellen Zeitraum gibt es kein priorisiertes Feedback.'
            : 'There is no prioritized feedback in the current range.'),
        primaryAction: {
          label: locale === 'de' ? 'Bewertungen prüfen' : 'Review feedback',
          href: '/workspace?section=reviews',
          targetFilter: 'focus',
        },
        queueTitle: locale === 'de' ? 'Action Queue' : 'Action queue',
        queue,
        emptyText: locale === 'de'
          ? 'Im aktuellen Zeitraum gibt es kein priorisiertes Feedback.'
          : 'There is no prioritized feedback in the current range.',
        overviewEyebrow: locale === 'de' ? 'Review-Lage' : 'Review snapshot',
        overview: [
          {
            key: 'avg',
            label: locale === 'de' ? 'Ø Bewertung' : 'Avg rating',
            value: overview.summary.averageRating.toFixed(1),
          },
          {
            key: 'positive',
            label: locale === 'de' ? 'Positiv' : 'Positive',
            value: String(positive),
          },
          {
            key: 'critical',
            label: locale === 'de' ? 'Kritisch' : 'Critical',
            value: String(critical),
          },
        ],
      },
      composer: {
        enabled: true,
        requiresAuthorName: !String(userId ?? '').trim(),
      },
    };
  }
}
