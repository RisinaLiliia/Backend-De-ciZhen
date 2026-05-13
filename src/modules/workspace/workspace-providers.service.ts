import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { FilterQuery, Model } from 'mongoose';

import { CatalogServicesService } from '../catalog/services/services.service';
import { CitiesService } from '../catalog/cities/cities.service';
import { ProviderProfile, type ProviderProfileDocument } from '../providers/schemas/provider-profile.schema';
import { ProviderAvailability, type ProviderAvailabilityDocument } from '../availability/schemas/provider-availability.schema';
import type { WorkspaceProvidersQueryDto } from './dto/workspace-providers-query.dto';
import type {
  WorkspaceProvidersDecisionPanelQueueItemDto,
  WorkspaceProvidersResponseDto,
  WorkspaceProvidersSummaryItemDto,
} from './dto/workspace-providers-response.dto';
import { WorkspaceRequestsSupport, WORKSPACE_REQUESTS_PERIOD_MS, type WorkspaceRequestsLocale } from './workspace-requests.support';

type ProviderActionType = WorkspaceProvidersDecisionPanelQueueItemDto['actionType'];
type ProviderPriority = WorkspaceProvidersDecisionPanelQueueItemDto['actionPriorityLevel'];
type ProviderViewerMode = NonNullable<WorkspaceProvidersQueryDto['viewerMode']>;

type QueueCandidate = {
  providerId: string;
  title: string;
  actionType: ProviderActionType;
  actionLabel: string;
  actionPriority: number;
  actionPriorityLevel: ProviderPriority;
  actionReason: string | null;
  categoryLabel: string | null;
  cityLabel: string | null;
  href: string;
  sortRating: number;
  sortReviews: number;
  sortUpdatedAt: number;
};

@Injectable()
export class WorkspaceProvidersService {
  private readonly support = new WorkspaceRequestsSupport();

  constructor(
    @InjectModel(ProviderProfile.name)
    private readonly providerModel: Model<ProviderProfileDocument>,
    @InjectModel(ProviderAvailability.name)
    private readonly availabilityModel: Model<ProviderAvailabilityDocument>,
    private readonly catalogServices: CatalogServicesService,
    private readonly cities: CitiesService,
  ) {}

  private async buildBaseMatch(
    query: WorkspaceProvidersQueryDto,
  ): Promise<FilterQuery<ProviderProfileDocument>> {
    const match: FilterQuery<ProviderProfileDocument> = {
      status: 'active',
      isBlocked: false,
    };

    const cityId = String(query.cityId ?? '').trim();
    if (cityId) {
      match.cityId = cityId;
    }

    const subcategoryKey = String(query.subcategoryKey ?? '').trim().toLowerCase();
    if (subcategoryKey) {
      match.serviceKeys = { $in: [subcategoryKey] };
      return match;
    }

    const categoryKey = String(query.categoryKey ?? '').trim().toLowerCase();
    if (!categoryKey) {
      return match;
    }

    const services = await this.catalogServices.listServices(categoryKey);
    if (services.length === 0) {
      return { _id: { $exists: false } };
    }

    match.serviceKeys = { $in: services.map((service) => service.key) };
    return match;
  }

  private isTopRated(provider: Pick<ProviderProfileDocument, 'ratingAvg' | 'ratingCount'>) {
    return Number(provider.ratingAvg ?? 0) >= 4.8 && Number(provider.ratingCount ?? 0) >= 10;
  }

  private isTrusted(provider: Pick<ProviderProfileDocument, 'completedJobs' | 'ratingCount'>) {
    return Number(provider.completedJobs ?? 0) >= 10 || Number(provider.ratingCount ?? 0) >= 15;
  }

  private isRecentlyUpdated(
    provider: Pick<ProviderProfileDocument, 'updatedAt'>,
    now: number,
    period: NonNullable<WorkspaceProvidersQueryDto['period']>,
  ) {
    const updatedAt = provider.updatedAt instanceof Date ? provider.updatedAt.getTime() : 0;
    return updatedAt >= now - WORKSPACE_REQUESTS_PERIOD_MS[period];
  }

  private pickLocalizedLabel(
    entity: { name?: string | null; i18n?: Record<string, string | null | undefined> } | null | undefined,
    locale: WorkspaceRequestsLocale,
  ) {
    if (!entity) return null;
    if (locale === 'de') {
      return entity.i18n?.de ?? entity.name ?? entity.i18n?.en ?? null;
    }
    return entity.i18n?.en ?? entity.name ?? entity.i18n?.de ?? null;
  }

  private buildSummary(args: {
    locale: WorkspaceRequestsLocale;
    total: number;
    available: number;
    topRated: number;
    trusted: number;
  }): WorkspaceProvidersSummaryItemDto[] {
    const { locale } = args;

    return [
      {
        key: 'all',
        label: locale === 'de' ? 'Alle' : 'All',
        value: args.total,
        helper: locale === 'de' ? 'Gesamter Anbieterpool' : 'Full provider pool',
        tone: 'all',
      },
      {
        key: 'available',
        label: locale === 'de' ? 'Verfügbar' : 'Available',
        value: args.available,
        helper: locale === 'de' ? 'Aktive Verfügbarkeit' : 'Active availability',
        tone: 'attention',
      },
      {
        key: 'top_rated',
        label: locale === 'de' ? 'Top bewertet' : 'Top rated',
        value: args.topRated,
        helper: locale === 'de' ? 'Starke Bewertungen' : 'Strong review quality',
        tone: 'execution',
      },
      {
        key: 'trusted',
        label: locale === 'de' ? 'Mit Referenzen' : 'With proof',
        value: args.trusted,
        helper: locale === 'de' ? 'Jobs und Reviews sichtbar' : 'Jobs and reviews visible',
        tone: 'completed',
      },
    ];
  }

  private buildQueueCandidate(args: {
    locale: WorkspaceRequestsLocale;
    viewerMode: ProviderViewerMode;
    provider: ProviderProfileDocument;
    isAvailable: boolean;
    isTopRated: boolean;
    isTrusted: boolean;
    isRecent: boolean;
    categoryLabel: string | null;
    cityLabel: string | null;
  }): QueueCandidate | null {
    const { locale, provider, viewerMode } = args;
    const title = provider.displayName?.trim() || (locale === 'de' ? 'Anbieterprofil' : 'Provider profile');
    const href = `/providers/${provider.id}`;
    const isProviderPerspective = viewerMode === 'provider';

    if (args.isAvailable && args.isTopRated) {
      return {
        providerId: String(provider.id),
        title,
        actionType: isProviderPerspective ? 'review_provider' : 'contact_provider',
        actionLabel: isProviderPerspective
          ? (locale === 'de' ? 'Starker Wettbewerber' : 'Strong competitor')
          : (locale === 'de' ? 'Jetzt verfügbar' : 'Available now'),
        actionPriority: 95,
        actionPriorityLevel: 'high',
        actionReason: isProviderPerspective
          ? (locale === 'de'
            ? 'Aktive Verfügbarkeit und starke Bewertung im Markt.'
            : 'Active availability and strong rating in the market.')
          : (locale === 'de'
            ? 'Sofort planbar und stark bewertet.'
            : 'Immediately bookable and strongly rated.'),
        categoryLabel: args.categoryLabel,
        cityLabel: args.cityLabel,
        href,
        sortRating: Number(provider.ratingAvg ?? 0),
        sortReviews: Number(provider.ratingCount ?? 0),
        sortUpdatedAt: provider.updatedAt instanceof Date ? provider.updatedAt.getTime() : 0,
      };
    }

    if (args.isAvailable) {
      return {
        providerId: String(provider.id),
        title,
        actionType: isProviderPerspective ? 'review_provider' : 'open_availability',
        actionLabel: isProviderPerspective
          ? (locale === 'de' ? 'Aktiv im Markt' : 'Active in market')
          : (locale === 'de' ? 'Verfügbarkeit aktiv' : 'Availability active'),
        actionPriority: 82,
        actionPriorityLevel: 'high',
        actionReason: isProviderPerspective
          ? (locale === 'de'
            ? 'Im aktuellen Kontext mit aktiver Verfügbarkeit sichtbar.'
            : 'Visible with active availability in the current context.')
          : (locale === 'de'
            ? 'Aktive Verfügbarkeit im aktuellen Kontext.'
            : 'Active availability in the current context.'),
        categoryLabel: args.categoryLabel,
        cityLabel: args.cityLabel,
        href,
        sortRating: Number(provider.ratingAvg ?? 0),
        sortReviews: Number(provider.ratingCount ?? 0),
        sortUpdatedAt: provider.updatedAt instanceof Date ? provider.updatedAt.getTime() : 0,
      };
    }

    if (args.isTopRated) {
      return {
        providerId: String(provider.id),
        title,
        actionType: 'review_provider',
        actionLabel: isProviderPerspective
          ? (locale === 'de' ? 'Hohe Bewertung' : 'High rating')
          : (locale === 'de' ? 'Stark bewertet' : 'Strongly rated'),
        actionPriority: 70,
        actionPriorityLevel: 'medium',
        actionReason: isProviderPerspective
          ? (locale === 'de'
            ? 'Stabile Bewertungen setzen hier den Marktstandard.'
            : 'Stable ratings set the market benchmark here.')
          : (locale === 'de'
            ? 'Stabile Bewertungen im aktuellen Markt.'
            : 'Stable review performance in the current market.'),
        categoryLabel: args.categoryLabel,
        cityLabel: args.cityLabel,
        href,
        sortRating: Number(provider.ratingAvg ?? 0),
        sortReviews: Number(provider.ratingCount ?? 0),
        sortUpdatedAt: provider.updatedAt instanceof Date ? provider.updatedAt.getTime() : 0,
      };
    }

    if (args.isTrusted) {
      return {
        providerId: String(provider.id),
        title,
        actionType: 'review_trust',
        actionLabel: locale === 'de' ? 'Mit Referenzen' : 'Trusted track record',
        actionPriority: 58,
        actionPriorityLevel: 'medium',
        actionReason: isProviderPerspective
          ? (locale === 'de'
            ? 'Belastbare Referenzen und abgeschlossene Aufträge im Sichtfeld.'
            : 'Credible references and completed jobs are visible.')
          : (locale === 'de'
            ? 'Abgeschlossene Aufträge und belastbare Reviews sichtbar.'
            : 'Completed jobs and credible reviews are visible.'),
        categoryLabel: args.categoryLabel,
        cityLabel: args.cityLabel,
        href,
        sortRating: Number(provider.ratingAvg ?? 0),
        sortReviews: Number(provider.ratingCount ?? 0),
        sortUpdatedAt: provider.updatedAt instanceof Date ? provider.updatedAt.getTime() : 0,
      };
    }

    if (args.isRecent) {
      return {
        providerId: String(provider.id),
        title,
        actionType: 'review_provider',
        actionLabel: locale === 'de' ? 'Kürzlich aktualisiert' : 'Recently updated',
        actionPriority: 42,
        actionPriorityLevel: 'low',
        actionReason: locale === 'de'
          ? 'Im gewählten Zeitraum aktualisiert.'
          : 'Updated in the selected time window.',
        categoryLabel: args.categoryLabel,
        cityLabel: args.cityLabel,
        href,
        sortRating: Number(provider.ratingAvg ?? 0),
        sortReviews: Number(provider.ratingCount ?? 0),
        sortUpdatedAt: provider.updatedAt instanceof Date ? provider.updatedAt.getTime() : 0,
      };
    }

    return null;
  }

  private buildPrimaryHref(query: WorkspaceProvidersQueryDto) {
    const qs = new URLSearchParams();
    qs.set('section', 'providers');
    if (query.cityId) qs.set('cityId', query.cityId);
    if (query.categoryKey) qs.set('categoryKey', query.categoryKey);
    if (query.subcategoryKey) qs.set('subcategoryKey', query.subcategoryKey);
    if (query.period) qs.set('period', query.period);
    if (query.viewerMode) qs.set('viewerMode', query.viewerMode);
    const value = qs.toString();
    return `/workspace?${value}`;
  }

  async getProvidersOverview(
    query: WorkspaceProvidersQueryDto,
    acceptLanguage?: string | null,
  ): Promise<WorkspaceProvidersResponseDto> {
    const locale = this.support.resolveWorkspaceLocale(acceptLanguage);
    const period = query.period ?? '30d';
    const viewerMode: ProviderViewerMode = query.viewerMode ?? 'customer';
    const now = Date.now();
    const baseMatch = await this.buildBaseMatch(query);
    const providers = await this.providerModel
      .find(baseMatch)
      .sort({ ratingAvg: -1, ratingCount: -1, completedJobs: -1, updatedAt: -1 })
      .exec();

    const providerUserIds = providers
      .map((provider) => String(provider.userId ?? '').trim())
      .filter((userId) => userId.length > 0);
    const availableDocs = providerUserIds.length > 0
      ? await this.availabilityModel
        .find({ providerUserId: { $in: providerUserIds }, isActive: true })
        .select({ providerUserId: 1 })
        .exec()
      : [];
    const availableSet = new Set(
      availableDocs.map((doc) => String(doc.providerUserId ?? '').trim()).filter((userId) => userId.length > 0),
    );

    const serviceKeys = Array.from(
      new Set(
        providers
          .flatMap((provider) => Array.isArray(provider.serviceKeys) ? provider.serviceKeys : [])
          .map((key) => String(key ?? '').trim().toLowerCase())
          .filter((key) => key.length > 0),
      ),
    );
    const services = serviceKeys.length > 0
      ? await this.catalogServices.listServices()
      : [];
    const serviceByKey = new Map(
      services.map((service) => [service.key, this.pickLocalizedLabel(service as any, locale) ?? service.key]),
    );

    const cityIds = Array.from(
      new Set(
        providers
          .map((provider) => String(provider.cityId ?? '').trim())
          .filter((cityId) => cityId.length > 0),
      ),
    );
    const cities = cityIds.length > 0 ? await this.cities.listByIds(cityIds, 'DE') : [];
    const cityById = new Map(
      cities.map((city) => [String(city._id), this.pickLocalizedLabel(city as any, locale) ?? city.name ?? String(city._id)]),
    );

    let availableCount = 0;
    let topRatedCount = 0;
    let trustedCount = 0;
    let recentCount = 0;

    const queueCandidates = providers
      .map((provider) => {
        const isAvailable = availableSet.has(String(provider.userId ?? '').trim());
        const isTopRated = this.isTopRated(provider);
        const isTrusted = this.isTrusted(provider);
        const isRecent = this.isRecentlyUpdated(provider, now, period);
        if (isAvailable) availableCount += 1;
        if (isTopRated) topRatedCount += 1;
        if (isTrusted) trustedCount += 1;
        if (isRecent) recentCount += 1;

        const primaryServiceKey = Array.isArray(provider.serviceKeys) ? provider.serviceKeys[0] : null;
        const categoryLabel = primaryServiceKey ? serviceByKey.get(primaryServiceKey) ?? primaryServiceKey : null;
        const cityLabel = provider.cityId ? cityById.get(String(provider.cityId)) ?? String(provider.cityId) : null;

        return this.buildQueueCandidate({
          locale,
          viewerMode,
          provider,
          isAvailable,
          isTopRated,
          isTrusted,
          isRecent,
          categoryLabel,
          cityLabel,
        });
      })
      .filter((candidate): candidate is QueueCandidate => candidate !== null)
      .sort((left, right) =>
        right.actionPriority - left.actionPriority
        || right.sortRating - left.sortRating
        || right.sortReviews - left.sortReviews
        || right.sortUpdatedAt - left.sortUpdatedAt)
      .slice(0, 5);

    const totalNeedsAction = queueCandidates.length;
    const queue = queueCandidates.map((candidate) => ({
      providerId: candidate.providerId,
      title: candidate.title,
      actionType: candidate.actionType,
      actionLabel: candidate.actionLabel,
      actionPriority: candidate.actionPriority,
      actionPriorityLevel: candidate.actionPriorityLevel,
      actionReason: candidate.actionReason,
      categoryLabel: candidate.categoryLabel,
      cityLabel: candidate.cityLabel,
      href: candidate.href,
    }));

    return {
      section: 'providers',
      header: {
        title: viewerMode === 'provider'
          ? (locale === 'de' ? 'Wettbewerb im Markt' : 'Competition in the market')
          : (locale === 'de' ? 'Anbieter im Markt' : 'Providers in the market'),
        subtitle: viewerMode === 'provider'
          ? (locale === 'de'
            ? 'Ein gemeinsamer Marktblick auf verfügbare, bewährte und sichtbare Wettbewerber.'
            : 'One shared market view of available, proven, and visible competitors.')
          : (locale === 'de'
            ? 'Ein gemeinsamer Marktblick für verfügbare, bewährte und relevante Anbieter.'
            : 'One shared market view for available, proven, and relevant providers.'),
      },
      filters: {
        cityId: query.cityId ?? null,
        categoryKey: query.categoryKey ?? null,
        subcategoryKey: query.subcategoryKey ?? null,
        period,
        viewerMode,
      },
      summary: {
        items: this.buildSummary({
          locale,
          total: providers.length,
          available: availableCount,
          topRated: topRatedCount,
          trusted: trustedCount,
        }),
      },
      decisionPanel: {
        eyebrow: locale === 'de' ? 'Decision Panel' : 'Decision panel',
        totalNeedsAction,
        title: totalNeedsAction > 0
          ? (
            viewerMode === 'provider'
              ? (locale === 'de' ? 'Wettbewerber prägen den Markt' : 'Competitors are shaping the market')
              : (locale === 'de' ? 'Anbieter brauchen Aufmerksamkeit' : 'Providers need attention')
          )
          : (
            viewerMode === 'provider'
              ? (locale === 'de' ? 'Keine auffälligen Wettbewerber' : 'No standout competitors')
              : (locale === 'de' ? 'Keine priorisierten Anbieter' : 'No prioritized providers')
          ),
        text: totalNeedsAction > 0
          ? (
            viewerMode === 'provider'
              ? (locale === 'de'
                ? `${availableCount} aktiv verfügbar, ${topRatedCount} stark bewertet, ${recentCount} frisch aktualisiert.`
                : `${availableCount} actively available, ${topRatedCount} strongly rated, ${recentCount} recently updated.`)
              : (locale === 'de'
                ? `${availableCount} direkt verfügbar, ${topRatedCount} stark bewertet, ${recentCount} frisch aktualisiert.`
                : `${availableCount} immediately available, ${topRatedCount} strongly rated, ${recentCount} recently updated.`)
          )
          : (
            viewerMode === 'provider'
              ? (locale === 'de'
                ? 'Im aktuellen Kontext gibt es keine auffälligen Wettbewerber.'
                : 'There are no standout competitors in the current context.')
              : (locale === 'de'
                ? 'Im aktuellen Kontext gibt es keine priorisierten Anbieter.'
                : 'There are no prioritized providers in the current context.')
          ),
        primaryAction: {
          label: viewerMode === 'provider'
            ? (locale === 'de' ? 'Markt prüfen' : 'Review market')
            : (locale === 'de' ? 'Anbieter prüfen' : 'Review providers'),
          href: this.buildPrimaryHref(query),
          targetFilter: 'recommended',
        },
        queueTitle: locale === 'de' ? 'Action Queue' : 'Action queue',
        queue,
        emptyText: viewerMode === 'provider'
          ? (locale === 'de'
            ? 'Im aktuellen Kontext gibt es keine auffälligen Wettbewerber.'
            : 'There are no standout competitors in the current context.')
          : (locale === 'de'
            ? 'Im aktuellen Kontext gibt es keine priorisierten Anbieter.'
            : 'There are no prioritized providers in the current context.'),
        overviewEyebrow: viewerMode === 'provider'
          ? (locale === 'de' ? 'Wettbewerb' : 'Competition snapshot')
          : (locale === 'de' ? 'Angebotslage' : 'Supply snapshot'),
        overview: [
          {
            key: 'available',
            label: locale === 'de' ? 'Jetzt verfügbar' : 'Available now',
            value: availableCount,
          },
          {
            key: 'top_rated',
            label: locale === 'de' ? 'Top bewertet' : 'Top rated',
            value: topRatedCount,
          },
          {
            key: 'trusted',
            label: locale === 'de' ? 'Mit Referenzen' : 'With proof',
            value: trustedCount,
          },
        ],
      },
    };
  }
}
