import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { FilterQuery, Model } from 'mongoose';

import { CatalogServicesService } from '../catalog/services/services.service';
import { CitiesService } from '../catalog/cities/cities.service';
import { ProviderProfile, type ProviderProfileDocument } from '../providers/schemas/provider-profile.schema';
import { ProviderAvailability, type ProviderAvailabilityDocument } from '../availability/schemas/provider-availability.schema';
import { Favorite, type FavoriteDocument } from '../favorites/schemas/favorite.schema';
import type { WorkspaceProvidersQueryDto, WorkspaceProvidersSortDto } from './dto/workspace-providers-query.dto';
import type {
  WorkspaceProvidersDecisionPanelQueueItemDto,
  WorkspaceProvidersListItemDto,
  WorkspaceProvidersResponseDto,
  WorkspaceProvidersSummaryItemDto,
} from './dto/workspace-providers-response.dto';
import { WorkspaceRequestsSupport, WORKSPACE_REQUESTS_PERIOD_MS, type WorkspaceRequestsLocale } from './workspace-requests.support';

type ProviderActionType = WorkspaceProvidersDecisionPanelQueueItemDto['actionType'];
type ProviderPriority = WorkspaceProvidersDecisionPanelQueueItemDto['actionPriorityLevel'];
type ProviderViewerMode = NonNullable<WorkspaceProvidersQueryDto['viewerMode']>;
type ProviderListCard = WorkspaceProvidersListItemDto['card'];
type ProviderBadge = ProviderListCard['badges'][number];

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

const REVIEW_PREVIEWS: Record<WorkspaceRequestsLocale, string[]> = {
  de: [
    'Sehr zuverlässig und schnell!',
    'Pünktlich, freundlich und sauber gearbeitet.',
    'Top Kommunikation und fairer Preis.',
    'Sehr professionell, gerne wieder.',
    'Schnelle Rückmeldung und sauberes Ergebnis.',
    'Arbeit exakt wie besprochen umgesetzt.',
  ],
  en: [
    'Very reliable and quick.',
    'On time, friendly, and tidy work.',
    'Great communication and fair pricing.',
    'Very professional, would book again.',
    'Fast response and clean result.',
    'Delivered exactly as agreed.',
  ],
};

const PROVIDER_BIO_PREVIEWS: Record<WorkspaceRequestsLocale, string[]> = {
  de: [
    'Fokussiert auf saubere Ausführung, klare Absprachen und verlässliche Termine.',
    'Mehrjährige Praxiserfahrung mit schnellen Rückmeldungen und transparentem Ablauf.',
    'Arbeitet strukturiert, zuverlässig und mit hohem Qualitätsanspruch im Detail.',
    'Unterstützt kurzfristig bei passenden Anfragen und kommuniziert proaktiv den Fortschritt.',
    'Spezialisiert auf effiziente Lösungen mit sauberem Finish und fairer Preisstruktur.',
  ],
  en: [
    'Focused on clean execution, clear communication, and dependable timing.',
    'Hands-on experience with fast replies and a transparent working process.',
    'Works in a structured, reliable way with strong attention to detail.',
    'Can support short-notice requests and communicates progress proactively.',
    'Specialized in efficient solutions with a polished finish and fair pricing.',
  ],
};

@Injectable()
export class WorkspaceProvidersService {
  private readonly support = new WorkspaceRequestsSupport();

  constructor(
    @InjectModel(ProviderProfile.name)
    private readonly providerModel: Model<ProviderProfileDocument>,
    @InjectModel(ProviderAvailability.name)
    private readonly availabilityModel: Model<ProviderAvailabilityDocument>,
    @InjectModel(Favorite.name)
    private readonly favoriteModel: Model<FavoriteDocument>,
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

  private resolveSort(sort?: WorkspaceProvidersSortDto | null): WorkspaceProvidersSortDto {
    return sort === 'date_asc' || sort === 'price_asc' || sort === 'price_desc' ? sort : 'date_desc';
  }

  private resolvePagination(page?: number | null, limit?: number | null) {
    const safeLimit = Math.min(100, Math.max(1, Math.trunc(limit ?? 20)));
    const safePage = Math.max(1, Math.trunc(page ?? 1));
    return { page: safePage, limit: safeLimit };
  }

  private hashProviderCardSeed(input: string) {
    let hash = 0;
    for (let index = 0; index < input.length; index += 1) {
      hash = (hash * 31 + input.charCodeAt(index)) % 100000;
    }
    return hash;
  }

  private computeProviderResponseRate(provider: ProviderProfileDocument) {
    const ratingPart = Math.round(Number(provider.ratingAvg ?? 0) * 12);
    const reviewsPart = Math.min(8, Math.floor(Math.log10(Math.max(1, Number(provider.ratingCount ?? 0))) * 5));
    const jobsPart = Math.min(10, Math.floor(Number(provider.completedJobs ?? 0) / 25));
    return Math.max(74, Math.min(99, ratingPart + reviewsPart + jobsPart));
  }

  private resolveProviderResponseMinutes(seed: number) {
    return 10 + (seed % 16);
  }

  private resolveProviderIsVerified(provider: ProviderProfileDocument) {
    return Number(provider.ratingCount ?? 0) >= 30 || Number(provider.completedJobs ?? 0) >= 25;
  }

  private buildProviderCardBadges(args: {
    locale: WorkspaceRequestsLocale;
    provider: ProviderProfileDocument;
    responseRate: number;
    responseMinutes: number;
  }): ProviderBadge[] {
    const { locale, provider, responseRate, responseMinutes } = args;
    const isTopProvider = Number(provider.ratingAvg ?? 0) >= 4.8 && Number(provider.ratingCount ?? 0) >= 30 && responseRate >= 80;
    const isTopService = Number(provider.ratingAvg ?? 0) >= 4.7 && Number(provider.ratingCount ?? 0) >= 15;
    const isFastReply = responseMinutes <= 20;

    const topProviderLabel = locale === 'de' ? 'Top Anbieter' : 'Top provider';
    const topProviderTooltip = locale === 'de' ? 'Top Bewertung und hohe Zuverlässigkeit' : 'Top rating and high reliability';
    const topServiceLabel = locale === 'de' ? 'Top Service' : 'Top service';
    const topServiceTooltip = locale === 'de' ? 'Konstant starke Bewertungen' : 'Consistently strong ratings';
    const fastReplyLabel = locale === 'de' ? 'Schnelle Antwort' : 'Fast reply';
    const fastReplyTooltip = locale === 'de' ? 'Reagiert in der Regel sehr schnell' : 'Usually responds very quickly';

    const badges: ProviderBadge[] = [];
    if (isTopProvider) {
      badges.push({
        variant: 'info',
        size: 'sm',
        tone: 'soft',
        label: topProviderLabel,
        tooltip: topProviderTooltip,
      });
    } else if (isTopService) {
      badges.push({
        variant: 'info',
        size: 'sm',
        tone: 'soft',
        label: topServiceLabel,
        tooltip: topServiceTooltip,
      });
      if (isFastReply) {
        badges.push({
          variant: 'opportunity',
          size: 'sm',
          tone: 'soft',
          label: fastReplyLabel,
          tooltip: fastReplyTooltip,
        });
      }
    } else if (isFastReply) {
      badges.push({
        variant: 'opportunity',
        size: 'sm',
        tone: 'soft',
        label: fastReplyLabel,
        tooltip: fastReplyTooltip,
      });
    }

    return badges;
  }

  private buildProviderServicePreview(args: {
    provider: ProviderProfileDocument;
    serviceByKey: Map<string, string>;
    fallbackRole: string;
  }) {
    const labels = (Array.isArray(args.provider.serviceKeys) ? args.provider.serviceKeys : [])
      .map((key) => args.serviceByKey.get(String(key ?? '').trim().toLowerCase()) ?? null)
      .filter((value): value is string => Boolean(value && value.trim()))
      .slice(0, 2);

    if (labels.length > 0) {
      return labels;
    }

    return [args.fallbackRole];
  }

  private buildProviderCard(args: {
    locale: WorkspaceRequestsLocale;
    provider: ProviderProfileDocument;
    isAvailable: boolean;
    categoryLabel: string | null;
    cityLabel: string | null;
    serviceByKey: Map<string, string>;
  }): ProviderListCard {
    const { locale, provider, isAvailable, categoryLabel, cityLabel, serviceByKey } = args;
    const seed = this.hashProviderCardSeed(String(provider.id ?? provider.userId ?? 'provider'));
    const responseMinutes = this.resolveProviderResponseMinutes(seed);
    const responseRate = this.computeProviderResponseRate(provider);
    const localeTag = locale === 'de' ? 'de-DE' : 'en-US';
    const priceFormatter = new Intl.NumberFormat(localeTag, {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    });
    const role = categoryLabel?.trim() || (locale === 'de' ? 'Dienstleistung' : 'Service');
    const servicePreview = this.buildProviderServicePreview({ provider, serviceByKey, fallbackRole: role });

    return {
      id: String(provider.id),
      badges: this.buildProviderCardBadges({ locale, provider, responseRate, responseMinutes }),
      isVerified: this.resolveProviderIsVerified(provider),
      status: isAvailable ? 'online' : 'offline',
      statusLabel: isAvailable
        ? (locale === 'de' ? 'Aktiv' : 'Active')
        : (locale === 'de' ? 'Nicht aktiv' : 'Inactive'),
      avatarUrl: provider.avatarUrl ?? null,
      name: provider.displayName?.trim() || (locale === 'de' ? 'Anbieterprofil' : 'Provider profile'),
      role,
      cityLabel: cityLabel?.trim() || null,
      rating: Number(provider.ratingAvg ?? 0).toFixed(1),
      responseTime: `~${responseMinutes} ${locale === 'de' ? 'Min.' : 'min'}`,
      responseTimeLabel: locale === 'de' ? 'Antwortzeit' : 'Response time',
      responseRate,
      responseRateLabel: locale === 'de' ? 'Antwortquote' : 'Response rate',
      aboutPreview: provider.bio?.trim() || PROVIDER_BIO_PREVIEWS[locale][seed % PROVIDER_BIO_PREVIEWS[locale].length] || null,
      reviewsCount: Number(provider.ratingCount ?? 0),
      reviewsLabel: locale === 'de' ? 'Bewertungen' : 'reviews',
      reviewPreview: REVIEW_PREVIEWS[locale][seed % REVIEW_PREVIEWS[locale].length] || null,
      availabilityDatePrefix: isAvailable ? (locale === 'de' ? 'Verfügbar' : 'Available') : null,
      availabilityDateLabel: isAvailable ? (locale === 'de' ? 'Jetzt' : 'Now') : null,
      availabilityDateIso: null,
      pricingPrefixLabel:
        typeof provider.basePrice === 'number' && Number.isFinite(provider.basePrice)
          ? (locale === 'de' ? 'Ab' : 'From')
          : null,
      pricingValueLabel:
        typeof provider.basePrice === 'number' && Number.isFinite(provider.basePrice)
          ? priceFormatter.format(provider.basePrice)
          : (locale === 'de' ? 'Festpreis' : 'Fixed price'),
      pricingSuffixLabel:
        typeof provider.basePrice === 'number' && Number.isFinite(provider.basePrice)
          ? (locale === 'de' ? '/ Std.' : '/ hr')
          : null,
      servicePreview,
      ctaLabel: locale === 'de' ? 'Profil ansehen' : 'View profile',
      profileHref: `/providers/${provider.id}`,
      reviewsHref: `/providers/${provider.id}#reviews`,
    };
  }

  private sortProviders(providers: ProviderProfileDocument[], sort: WorkspaceProvidersSortDto) {
    const copy = [...providers];
    copy.sort((left, right) => {
      const leftUpdatedAt = left.updatedAt instanceof Date ? left.updatedAt.getTime() : 0;
      const rightUpdatedAt = right.updatedAt instanceof Date ? right.updatedAt.getTime() : 0;
      const leftPrice = typeof left.basePrice === 'number' && Number.isFinite(left.basePrice) ? left.basePrice : Number.POSITIVE_INFINITY;
      const rightPrice = typeof right.basePrice === 'number' && Number.isFinite(right.basePrice) ? right.basePrice : Number.POSITIVE_INFINITY;
      const ratingDelta = Number(right.ratingAvg ?? 0) - Number(left.ratingAvg ?? 0);
      const reviewsDelta = Number(right.ratingCount ?? 0) - Number(left.ratingCount ?? 0);

      if (sort === 'date_asc') {
        return leftUpdatedAt - rightUpdatedAt || ratingDelta || reviewsDelta;
      }
      if (sort === 'price_asc') {
        return leftPrice - rightPrice || ratingDelta || reviewsDelta || rightUpdatedAt - leftUpdatedAt;
      }
      if (sort === 'price_desc') {
        return rightPrice - leftPrice || ratingDelta || reviewsDelta || rightUpdatedAt - leftUpdatedAt;
      }
      return rightUpdatedAt - leftUpdatedAt || ratingDelta || reviewsDelta;
    });
    return copy;
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
    if (query.sort) qs.set('sort', query.sort);
    const value = qs.toString();
    return `/workspace?${value}`;
  }

  async getProvidersOverview(
    query: WorkspaceProvidersQueryDto,
    userId?: string | null,
    acceptLanguage?: string | null,
  ): Promise<WorkspaceProvidersResponseDto> {
    const locale = this.support.resolveWorkspaceLocale(acceptLanguage);
    const period = query.period ?? '30d';
    const viewerMode: ProviderViewerMode = query.viewerMode ?? 'customer';
    const sort = this.resolveSort(query.sort);
    const pagination = this.resolvePagination(query.page, query.limit);
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
    const services = serviceKeys.length > 0 ? await this.catalogServices.listServices() : [];
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

    const sortedProviders = this.sortProviders(providers, sort);
    const totalCount = sortedProviders.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / pagination.limit));
    const page = Math.min(pagination.page, totalPages);
    const start = (page - 1) * pagination.limit;
    const visibleProviders = sortedProviders.slice(start, start + pagination.limit);
    const favoriteProviderIds = userId && visibleProviders.length > 0
      ? new Set(
        (
          await this.favoriteModel
            .find({
              userId,
              type: 'provider',
              targetId: { $in: visibleProviders.map((provider) => String(provider.id)) },
            })
            .select({ targetId: 1 })
            .exec()
        )
          .map((row) => String(row.targetId ?? '').trim())
          .filter((value) => value.length > 0),
      )
      : new Set<string>();
    const listItems = visibleProviders.map<WorkspaceProvidersListItemDto>((provider) => {
      const primaryServiceKey = Array.isArray(provider.serviceKeys) ? provider.serviceKeys[0] : null;
      const categoryLabel = primaryServiceKey ? serviceByKey.get(primaryServiceKey) ?? primaryServiceKey : null;
      const cityLabel = provider.cityId ? cityById.get(String(provider.cityId)) ?? String(provider.cityId) : null;
      const isAvailable = availableSet.has(String(provider.userId ?? '').trim());
      return {
        id: String(provider.id),
        userId: provider.userId ?? null,
        isFavorite: favoriteProviderIds.has(String(provider.id)),
        card: this.buildProviderCard({
          locale,
          provider,
          isAvailable,
          categoryLabel,
          cityLabel,
          serviceByKey,
        }),
      };
    });

    const localeTag = locale === 'de' ? 'de-DE' : 'en-US';
    const totalLabel = new Intl.NumberFormat(localeTag).format(totalCount);

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
        sort,
        page,
        limit: pagination.limit,
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
        totalNeedsAction: queue.length,
        title: queue.length > 0
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
        text: queue.length > 0
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
      list: {
        totalCount,
        totalLabel,
        sort,
        page,
        limit: pagination.limit,
        totalPages,
        emptyTitle: locale === 'de' ? 'Keine Anbieter gefunden' : 'No providers found',
        emptyHint: viewerMode === 'provider'
          ? (locale === 'de'
            ? 'Passe Filter oder Perspektive an, um mehr Wettbewerber zu sehen.'
            : 'Adjust filters or perspective to see more competitors.')
          : (locale === 'de'
            ? 'Passe Filter oder Perspektive an, um mehr Anbieter zu sehen.'
            : 'Adjust filters or perspective to see more providers.'),
        items: listItems,
      },
    };
  }
}
