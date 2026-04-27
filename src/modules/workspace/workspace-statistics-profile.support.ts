import type {
  WorkspaceStatisticsActivityMetricsDto,
  WorkspaceStatisticsDecisionLayerDto,
  WorkspaceStatisticsFunnelComparisonDto,
  WorkspaceStatisticsProfileFunnelDto,
} from './dto/workspace-statistics-response.dto';
import type { WorkspaceStatisticsRange } from './dto/workspace-statistics-query.dto';
import { WorkspaceStatisticsMarketSupport } from './workspace-statistics-market.support';
import type { FunnelStageCounts } from './workspace-statistics.support';

export class WorkspaceStatisticsProfileSupport extends WorkspaceStatisticsMarketSupport {
  protected buildProfileFunnelContext(params: {
    range: WorkspaceStatisticsRange;
    mode: 'platform' | 'personalized';
    viewerMode: 'provider' | 'customer' | null;
    marketCounts: FunnelStageCounts;
    marketRevenueAmount: number;
    providerCounts: FunnelStageCounts;
    providerRevenueAmount: number;
    customerCounts: FunnelStageCounts;
    customerRevenueAmount: number;
    viewerScopedResponseMinutes: number | null;
    viewerScopedUnansweredOver24h: number | null;
    activityMetrics: WorkspaceStatisticsActivityMetricsDto;
  }): {
    profileFunnel: WorkspaceStatisticsProfileFunnelDto;
    funnelComparison: WorkspaceStatisticsFunnelComparisonDto | null;
    decisionLayer: WorkspaceStatisticsDecisionLayerDto | null;
    selectedUserCounts: FunnelStageCounts;
    selectedUserRevenueAmount: number;
    selectedUserAverageOrderValue: number | null;
    marketAverageOrderValue: number | null;
    hasViewerScopedData: boolean;
    conversionRatePercent: number;
  } {
    const viewerModeCounts = params.viewerMode === 'customer' ? params.customerCounts : params.providerCounts;
    const hasViewerModeCounts = Object.values(viewerModeCounts).some((value) => value > 0);
    const selectedUserCounts = viewerModeCounts;
    const selectedUserRevenueAmount =
      params.viewerMode === 'customer' ? params.customerRevenueAmount : params.providerRevenueAmount;
    const marketAverageOrderValue =
      params.marketCounts.completed > 0
        ? this.roundMoney(params.marketRevenueAmount / params.marketCounts.completed)
        : null;
    const selectedUserAverageOrderValue =
      selectedUserCounts.completed > 0
        ? this.roundMoney(selectedUserRevenueAmount / selectedUserCounts.completed)
        : null;
    const hasViewerScopedData = hasViewerModeCounts || selectedUserRevenueAmount > 0;
    const requestsFunnelTotal =
      params.mode === 'personalized' ? selectedUserCounts.requests : params.marketCounts.requests;
    const offersFunnelTotal =
      params.mode === 'personalized' ? selectedUserCounts.offers : params.marketCounts.offers;
    const confirmedResponsesTotal =
      params.mode === 'personalized' ? selectedUserCounts.responses : params.marketCounts.responses;
    const closedContractsTotal =
      params.mode === 'personalized' ? selectedUserCounts.contracts : params.marketCounts.contracts;
    const completedFunnelTotal =
      params.mode === 'personalized' ? selectedUserCounts.completed : params.marketCounts.completed;
    const profitAmount =
      params.mode === 'personalized' ? selectedUserRevenueAmount : params.marketRevenueAmount;

    const offerResponseRatePercent = this.clampPercent(
      (offersFunnelTotal / Math.max(1, requestsFunnelTotal)) * 100,
    );
    const confirmationRatePercent = this.clampPercent(
      (confirmedResponsesTotal / Math.max(1, offersFunnelTotal)) * 100,
    );
    const contractClosureRatePercent = this.clampPercent(
      (closedContractsTotal / Math.max(1, confirmedResponsesTotal)) * 100,
    );
    const completionRatePercent = this.clampPercent(
      (completedFunnelTotal / Math.max(1, closedContractsTotal)) * 100,
    );
    const conversionRatePercent = this.clampPercent(
      (completedFunnelTotal / Math.max(1, requestsFunnelTotal)) * 100,
    );
    const avgRevenuePerCompleted =
      completedFunnelTotal > 0 ? this.roundMoney(profitAmount / completedFunnelTotal) : 0;

    const requestsWidthPercent = 100;
    const offersWidthPercent = this.roundPercent(
      Math.max(0, Math.min(100, (offersFunnelTotal / Math.max(1, requestsFunnelTotal)) * 100)),
    );
    const confirmationsWidthPercent = this.roundPercent(
      Math.max(
        0,
        Math.min(offersWidthPercent, (confirmedResponsesTotal / Math.max(1, requestsFunnelTotal)) * 100),
      ),
    );
    const contractsWidthPercent = this.roundPercent(
      Math.max(
        0,
        Math.min(confirmationsWidthPercent, (closedContractsTotal / Math.max(1, requestsFunnelTotal)) * 100),
      ),
    );
    const completedWidthPercent = this.roundPercent(
      Math.max(
        0,
        Math.min(contractsWidthPercent, (completedFunnelTotal / Math.max(1, requestsFunnelTotal)) * 100),
      ),
    );

    const funnelStageLabels = this.buildFunnelStageLabels(params.viewerMode ?? 'provider');
    const offerStageRateLabel = params.viewerMode === 'customer' ? 'Angebotsquote' : 'Antwortquote';
    const responseStageRateLabel = params.viewerMode === 'customer' ? 'Akzeptanzrate' : 'Rückmeldequote';
    const contractStageRateLabel = params.viewerMode === 'customer' ? 'Startquote' : 'Abschlussrate';

    const stages: WorkspaceStatisticsProfileFunnelDto['stages'] = [
      {
        id: 'requests',
        label: funnelStageLabels.requests,
        value: requestsFunnelTotal,
        displayValue: this.formatInt(requestsFunnelTotal),
        widthPercent: requestsWidthPercent,
        rateLabel: 'Basis',
        ratePercent: 100,
        helperText: null,
      },
      {
        id: 'offers',
        label: funnelStageLabels.offers,
        value: offersFunnelTotal,
        displayValue: this.formatInt(offersFunnelTotal),
        widthPercent: offersWidthPercent,
        rateLabel: offerStageRateLabel,
        ratePercent: offerResponseRatePercent,
        helperText: null,
      },
      {
        id: 'confirmations',
        label: funnelStageLabels.responses,
        value: confirmedResponsesTotal,
        displayValue: this.formatInt(confirmedResponsesTotal),
        widthPercent: confirmationsWidthPercent,
        rateLabel: responseStageRateLabel,
        ratePercent: confirmationRatePercent,
        helperText: null,
      },
      {
        id: 'contracts',
        label: funnelStageLabels.contracts,
        value: closedContractsTotal,
        displayValue: this.formatInt(closedContractsTotal),
        widthPercent: contractsWidthPercent,
        rateLabel: contractStageRateLabel,
        ratePercent: contractClosureRatePercent,
        helperText: null,
      },
      {
        id: 'completed',
        label: funnelStageLabels.completed,
        value: completedFunnelTotal,
        displayValue: this.formatInt(completedFunnelTotal),
        widthPercent: completedWidthPercent,
        rateLabel: 'Erfüllungsquote',
        ratePercent: completionRatePercent,
        helperText: null,
      },
      {
        id: 'revenue',
        label: 'Gewinnsumme',
        value: profitAmount,
        displayValue: this.formatCurrency(profitAmount),
        widthPercent: completedWidthPercent,
        rateLabel: 'Ø Umsatz / Auftrag',
        ratePercent: null,
        helperText: completedFunnelTotal > 0 ? this.formatCurrency(avgRevenuePerCompleted) : '—',
      },
    ];

    const profileFunnel: WorkspaceStatisticsProfileFunnelDto = {
      periodLabel: this.formatRangeLabel(params.range),
      stage1: requestsFunnelTotal,
      stage2: offersFunnelTotal,
      stage3: confirmedResponsesTotal,
      stage4: closedContractsTotal,
      requestsTotal: requestsFunnelTotal,
      offersTotal: offersFunnelTotal,
      confirmedResponsesTotal,
      closedContractsTotal,
      completedJobsTotal: completedFunnelTotal,
      profitAmount,
      offerResponseRatePercent,
      confirmationRatePercent,
      contractClosureRatePercent,
      completionRatePercent,
      conversionRate: conversionRatePercent,
      totalConversionPercent: conversionRatePercent,
      summaryText: `Von ${this.formatInt(requestsFunnelTotal)} Anfragen wurden ${this.formatInt(completedFunnelTotal)} erfolgreich abgeschlossen.`,
      stages,
    };

    const personalizedFunnelLowData =
      params.mode === 'personalized'
        ? !hasViewerScopedData ||
          selectedUserCounts.requests < 3 ||
          (selectedUserCounts.offers +
            selectedUserCounts.responses +
            selectedUserCounts.contracts +
            selectedUserCounts.completed) <
            3
        : false;

    const funnelComparison =
      params.mode === 'personalized' && params.viewerMode
        ? this.buildFunnelComparison({
            viewerMode: params.viewerMode,
            marketCounts: params.marketCounts,
            userCounts: selectedUserCounts,
            lowData: personalizedFunnelLowData,
          })
        : null;

    const decisionLayer = this.buildDecisionLayer({
      mode: params.mode,
      viewerMode: params.viewerMode,
      activityMetrics: params.activityMetrics,
      marketCounts: params.marketCounts,
      marketRevenueAmount: params.marketRevenueAmount,
      marketAverageOrderValue,
      userCounts: selectedUserCounts,
      userRevenueAmount: selectedUserRevenueAmount,
      userAverageOrderValue: selectedUserAverageOrderValue,
      userResponseMinutes: params.viewerScopedResponseMinutes,
      userUnansweredOver24h: params.viewerScopedUnansweredOver24h,
      reliableComparison: hasViewerScopedData,
    });

    return {
      profileFunnel,
      funnelComparison,
      decisionLayer,
      selectedUserCounts,
      selectedUserRevenueAmount,
      selectedUserAverageOrderValue,
      marketAverageOrderValue,
      hasViewerScopedData,
      conversionRatePercent,
    };
  }
}
