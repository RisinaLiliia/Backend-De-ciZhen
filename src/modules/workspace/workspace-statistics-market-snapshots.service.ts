import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { AnalyticsService } from '../analytics/analytics.service';
import { Contract, type ContractDocument } from '../contracts/schemas/contract.schema';
import { Offer, type OfferDocument } from '../offers/schemas/offer.schema';
import { Request, type RequestDocument } from '../requests/schemas/request.schema';
import { Review, type ReviewDocument } from '../reviews/schemas/review.schema';
import { WorkspaceService } from './workspace.service';
import type {
  WorkspaceStatisticsRange,
} from './dto/workspace-statistics-query.dto';

export type WorkspaceStatisticsCategoryAggregateRow = {
  _id: {
    categoryKey?: string | null;
    categoryName?: string | null;
    subcategoryName?: string | null;
    serviceKey?: string | null;
  };
  count: number;
};

type RequestCityAggregateRow = {
  _id: { cityId?: string | null; cityName?: string | null };
  requestCount: number;
  anbieterSuchenCount: number;
};

type OfferCityAggregateRow = {
  _id: { cityId?: string | null; cityName?: string | null };
  auftragSuchenCount: number;
};

type RequestResponseAggregateRow = {
  createdAt: Date;
  firstOfferAt: Date | null;
  responseMinutes: number | null;
};

type ContractLifecycleAggregateRow = {
  _id: null;
  completedJobs: number;
  cancelledJobs: number;
  gmvAmount: number;
};

type ReviewSummaryAggregateRow = {
  _id: null;
  total: number;
  average: number;
};

type ActiveProviderAggregateRow = {
  _id: string;
};

type ActiveProvidersByCityAggregateRow = {
  _id: { cityId?: string | null; cityName?: string | null };
  providersActive: number;
};

type FunnelOfferAggregateRow = {
  _id: null;
  offersTotal: number;
  confirmedResponsesTotal: number;
};

type FunnelContractAggregateRow = {
  _id: null;
  closedContractsTotal: number;
  completedJobsTotal: number;
  profitAmount: number;
};

@Injectable()
export class WorkspaceStatisticsMarketSnapshotsService {
  constructor(
    private readonly workspace: WorkspaceService,
    private readonly analytics: AnalyticsService,
    @InjectModel(Request.name) private readonly requestModel: Model<RequestDocument>,
    @InjectModel(Offer.name) private readonly offerModel: Model<OfferDocument>,
    @InjectModel(Contract.name) private readonly contractModel: Model<ContractDocument>,
    @InjectModel(Review.name) private readonly reviewModel: Model<ReviewDocument>,
  ) {}

  async loadMarketSnapshots(params: {
    range: WorkspaceStatisticsRange;
    filterOptionsRange: WorkspaceStatisticsRange;
    start: Date;
    end: Date;
    filterOptionsStart: Date;
    filterOptionsEnd: Date;
    cityId: string | null;
    categoryKey: string | null;
    subcategoryKey: string | null;
    hasActorScope: boolean;
    requestFunnelMatch: Record<string, unknown>;
    offerFunnelMatch: Record<string, unknown>;
    contractFunnelMatch: Record<string, unknown>;
    scopedRequestMatch: Record<string, unknown>;
    requestRefScopeMatch: Record<string, unknown>;
    funnelRequestRefScopeMatch: Record<string, unknown>;
  }) {
    const {
      range,
      filterOptionsRange,
      start,
      end,
      filterOptionsStart,
      filterOptionsEnd,
      cityId,
      categoryKey,
      subcategoryKey,
      hasActorScope,
      requestFunnelMatch,
      offerFunnelMatch,
      contractFunnelMatch,
      scopedRequestMatch,
      requestRefScopeMatch,
      funnelRequestRefScopeMatch,
    } = params;

    const marketFunnelRequestsPromise = hasActorScope
      ? this.requestModel.countDocuments({
          ...(cityId ? { cityId } : {}),
          ...(categoryKey ? { categoryKey } : {}),
          ...(subcategoryKey ? { serviceKey: subcategoryKey } : {}),
          createdAt: { $gte: start, $lte: end },
        })
      : Promise.resolve<number | null>(null);

    const marketFunnelOffersPromise = hasActorScope
      ? this.offerModel
          .aggregate<FunnelOfferAggregateRow>([
            {
              $lookup: {
                from: 'requests',
                let: { requestId: '$requestId' },
                pipeline: [
                  {
                    $match: {
                      $expr: { $eq: [{ $toString: '$_id' }, '$$requestId'] },
                    },
                  },
                  {
                    $project: {
                      _id: 0,
                      createdAt: '$createdAt',
                      cityId: '$cityId',
                      categoryKey: '$categoryKey',
                      serviceKey: '$serviceKey',
                    },
                  },
                ],
                as: 'requestRef',
              },
            },
            { $unwind: '$requestRef' },
            { $match: funnelRequestRefScopeMatch },
            {
              $group: {
                _id: '$requestId',
                hasAcceptedResponse: {
                  $max: {
                    $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0],
                  },
                },
              },
            },
            {
              $group: {
                _id: null,
                offersTotal: { $sum: 1 },
                confirmedResponsesTotal: { $sum: '$hasAcceptedResponse' },
              },
            },
          ])
          .exec()
      : Promise.resolve<FunnelOfferAggregateRow[] | null>(null);

    const marketFunnelContractsPromise = hasActorScope
      ? this.contractModel
          .aggregate<FunnelContractAggregateRow>([
            {
              $lookup: {
                from: 'requests',
                let: { requestId: '$requestId' },
                pipeline: [
                  {
                    $match: {
                      $expr: { $eq: [{ $toString: '$_id' }, '$$requestId'] },
                    },
                  },
                  {
                    $project: {
                      _id: 0,
                      createdAt: '$createdAt',
                      cityId: '$cityId',
                      categoryKey: '$categoryKey',
                      serviceKey: '$serviceKey',
                    },
                  },
                ],
                as: 'requestRef',
              },
            },
            { $unwind: '$requestRef' },
            { $match: funnelRequestRefScopeMatch },
            {
              $lookup: {
                from: 'offers',
                let: { requestId: '$requestId' },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $eq: ['$requestId', '$$requestId'] },
                          { $eq: ['$status', 'accepted'] },
                        ],
                      },
                    },
                  },
                  { $limit: 1 },
                ],
                as: 'acceptedOfferRef',
              },
            },
            {
              $group: {
                _id: '$requestId',
                hasAcceptedResponse: {
                  $max: {
                    $cond: [{ $gt: [{ $size: '$acceptedOfferRef' }, 0] }, 1, 0],
                  },
                },
                hasContract: {
                  $max: {
                    $cond: [
                      { $in: ['$status', ['confirmed', 'in_progress', 'completed']] },
                      1,
                      0,
                    ],
                  },
                },
                hasCompleted: {
                  $max: {
                    $cond: [{ $eq: ['$status', 'completed'] }, 1, 0],
                  },
                },
                completedRevenue: {
                  $max: {
                    $cond: [
                      {
                        $and: [
                          { $eq: ['$status', 'completed'] },
                          { $ne: ['$priceAmount', null] },
                          { $gt: ['$priceAmount', 0] },
                        ],
                      },
                      '$priceAmount',
                      0,
                    ],
                  },
                },
              },
            },
            {
              $group: {
                _id: null,
                closedContractsTotal: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $eq: ['$hasAcceptedResponse', 1] },
                          { $eq: ['$hasContract', 1] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                completedJobsTotal: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $eq: ['$hasAcceptedResponse', 1] },
                          { $eq: ['$hasCompleted', 1] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                profitAmount: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $eq: ['$hasAcceptedResponse', 1] },
                          { $eq: ['$hasCompleted', 1] },
                        ],
                      },
                      '$completedRevenue',
                      0,
                    ],
                  },
                },
              },
            },
          ])
          .exec()
      : Promise.resolve<FunnelContractAggregateRow[] | null>(null);

    const publicOverviewPromise = this.workspace.getPublicOverview({
      page: 1,
      limit: 100,
      cityActivityLimit: 5000,
      activityRange: range,
    });
    const filterOptionsPublicOverviewPromise =
      filterOptionsRange === range
        ? publicOverviewPromise
        : this.workspace.getPublicOverview({
            page: 1,
            limit: 100,
            cityActivityLimit: 5000,
            activityRange: filterOptionsRange,
          });
    const filterOptionsCategoryRowsPromise =
      filterOptionsRange === range
        ? this.aggregateCategoryRows({
            start,
            end,
          })
        : this.aggregateCategoryRows({
            start: filterOptionsStart,
            end: filterOptionsEnd,
          });

    const [
      publicOverview,
      filterOptionsPublicOverview,
      activity,
      filterOptionsCategoryRows,
      categoryRows,
      cityRows,
      offerCityRows,
      searchCityRows,
      requestResponseRows,
      contractLifecycleRows,
      reviewSummary,
      activeProviderRows,
      activeProvidersByCityRows,
      funnelRequestsTotal,
      funnelOffersRows,
      funnelContractsRows,
      marketFunnelRequestsTotal,
      marketFunnelOffersRows,
      marketFunnelContractsRows,
    ] = await Promise.all([
      publicOverviewPromise,
      filterOptionsPublicOverviewPromise,
      this.analytics.getPlatformActivity(range, { cityId, categoryKey, subcategoryKey }),
      filterOptionsCategoryRowsPromise,
      this.aggregateCategoryRows({
        start,
        end,
        match: {
          ...(cityId ? { cityId } : {}),
          ...(categoryKey ? { categoryKey } : {}),
          ...(subcategoryKey ? { serviceKey: subcategoryKey } : {}),
        },
      }),
      this.requestModel
        .aggregate<RequestCityAggregateRow>([
          {
            $match: scopedRequestMatch,
          },
          {
            $group: {
              _id: {
                cityId: '$cityId',
                cityName: '$cityName',
              },
              requestCount: { $sum: 1 },
              clientIds: { $addToSet: '$clientId' },
            },
          },
          {
            $project: {
              _id: 1,
              requestCount: 1,
              anbieterSuchenCount: {
                $size: {
                  $filter: {
                    input: '$clientIds',
                    as: 'clientId',
                    cond: {
                      $and: [{ $ne: ['$$clientId', null] }, { $ne: ['$$clientId', ''] }],
                    },
                  },
                },
              },
            },
          },
          { $sort: { requestCount: -1 } },
        ])
        .exec(),
      this.offerModel
        .aggregate<OfferCityAggregateRow>([
          {
            $match: {
              createdAt: { $gte: start, $lte: end },
            },
          },
          {
            $lookup: {
              from: 'requests',
              let: { requestId: '$requestId' },
              pipeline: [
                {
                  $match: {
                    $expr: { $eq: [{ $toString: '$_id' }, '$$requestId'] },
                  },
                },
                {
                  $project: {
                    _id: 0,
                    cityId: '$cityId',
                    cityName: '$cityName',
                  },
                },
              ],
              as: 'requestRef',
            },
          },
          { $unwind: '$requestRef' },
          ...(Object.keys(requestRefScopeMatch).length > 0 ? [{ $match: requestRefScopeMatch }] : []),
          {
            $group: {
              _id: {
                cityId: '$requestRef.cityId',
                cityName: '$requestRef.cityName',
              },
              auftragSuchenCount: { $sum: 1 },
            },
          },
        ])
        .exec(),
      this.analytics.getCitySearchCounts(range, { cityId, categoryKey, subcategoryKey }),
      this.requestModel
        .aggregate<RequestResponseAggregateRow>([
          {
            $match: scopedRequestMatch,
          },
          {
            $project: {
              createdAt: 1,
              requestId: { $toString: '$_id' },
            },
          },
          {
            $lookup: {
              from: 'offers',
              let: { requestId: '$requestId' },
              pipeline: [
                {
                  $match: {
                    $expr: { $eq: ['$requestId', '$$requestId'] },
                  },
                },
                {
                  $group: {
                    _id: null,
                    firstOfferAt: { $min: '$createdAt' },
                  },
                },
              ],
              as: 'offerStats',
            },
          },
          {
            $project: {
              createdAt: 1,
              firstOfferAt: {
                $ifNull: [{ $arrayElemAt: ['$offerStats.firstOfferAt', 0] }, null],
              },
            },
          },
          {
            $project: {
              createdAt: 1,
              firstOfferAt: 1,
              responseMinutes: {
                $cond: [
                  {
                    $and: [{ $ne: ['$firstOfferAt', null] }, { $gte: ['$firstOfferAt', '$createdAt'] }],
                  },
                  {
                    $divide: [{ $subtract: ['$firstOfferAt', '$createdAt'] }, 60000],
                  },
                  null,
                ],
              },
            },
          },
        ])
        .exec(),
      this.contractModel
        .aggregate<ContractLifecycleAggregateRow>([
          {
            $lookup: {
              from: 'requests',
              let: { requestId: '$requestId' },
              pipeline: [
                {
                  $match: {
                    $expr: { $eq: [{ $toString: '$_id' }, '$$requestId'] },
                  },
                },
                {
                  $project: {
                    _id: 0,
                    cityId: '$cityId',
                    categoryKey: '$categoryKey',
                    serviceKey: '$serviceKey',
                  },
                },
              ],
              as: 'requestRef',
            },
          },
          { $unwind: '$requestRef' },
          ...(Object.keys(requestRefScopeMatch).length > 0 ? [{ $match: requestRefScopeMatch }] : []),
          {
            $match: {
              $or: [{ completedAt: { $gte: start, $lte: end } }, { cancelledAt: { $gte: start, $lte: end } }],
            },
          },
          {
            $group: {
              _id: null,
              completedJobs: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $ne: ['$completedAt', null] },
                        { $gte: ['$completedAt', start] },
                        { $lte: ['$completedAt', end] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              cancelledJobs: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $ne: ['$cancelledAt', null] },
                        { $gte: ['$cancelledAt', start] },
                        { $lte: ['$cancelledAt', end] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              gmvAmount: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $ne: ['$completedAt', null] },
                        { $gte: ['$completedAt', start] },
                        { $lte: ['$completedAt', end] },
                        { $ne: ['$priceAmount', null] },
                        { $gt: ['$priceAmount', 0] },
                      ],
                    },
                    '$priceAmount',
                    0,
                  ],
                },
              },
            },
          },
        ])
        .exec(),
      this.reviewModel
        .aggregate<ReviewSummaryAggregateRow>([
          { $match: { targetRole: 'platform' } },
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              average: { $avg: '$rating' },
            },
          },
        ])
        .exec(),
      this.offerModel
        .aggregate<ActiveProviderAggregateRow>([
          {
            $match: {
              createdAt: { $gte: start, $lte: end },
            },
          },
          {
            $lookup: {
              from: 'requests',
              let: { requestId: '$requestId' },
              pipeline: [
                {
                  $match: {
                    $expr: { $eq: [{ $toString: '$_id' }, '$$requestId'] },
                  },
                },
                {
                  $project: {
                    _id: 0,
                    cityId: '$cityId',
                    categoryKey: '$categoryKey',
                    serviceKey: '$serviceKey',
                  },
                },
              ],
              as: 'requestRef',
            },
          },
          { $unwind: '$requestRef' },
          ...(Object.keys(requestRefScopeMatch).length > 0 ? [{ $match: requestRefScopeMatch }] : []),
          {
            $group: {
              _id: '$providerUserId',
            },
          },
        ])
        .exec(),
      this.offerModel
        .aggregate<ActiveProvidersByCityAggregateRow>([
          {
            $match: {
              createdAt: { $gte: start, $lte: end },
            },
          },
          {
            $lookup: {
              from: 'requests',
              let: { requestId: '$requestId' },
              pipeline: [
                {
                  $match: {
                    $expr: { $eq: [{ $toString: '$_id' }, '$$requestId'] },
                  },
                },
                {
                  $project: {
                    _id: 0,
                    cityId: '$cityId',
                    cityName: '$cityName',
                    categoryKey: '$categoryKey',
                    serviceKey: '$serviceKey',
                  },
                },
              ],
              as: 'requestRef',
            },
          },
          { $unwind: '$requestRef' },
          ...(Object.keys(requestRefScopeMatch).length > 0 ? [{ $match: requestRefScopeMatch }] : []),
          {
            $group: {
              _id: {
                cityId: '$requestRef.cityId',
                cityName: '$requestRef.cityName',
              },
              providerIds: { $addToSet: '$providerUserId' },
            },
          },
          {
            $project: {
              _id: 1,
              providersActive: {
                $size: {
                  $filter: {
                    input: '$providerIds',
                    as: 'providerId',
                    cond: {
                      $and: [{ $ne: ['$$providerId', null] }, { $ne: ['$$providerId', ''] }],
                    },
                  },
                },
              },
            },
          },
        ])
        .exec(),
      this.requestModel.countDocuments({
        ...requestFunnelMatch,
        ...(cityId ? { cityId } : {}),
        ...(categoryKey ? { categoryKey } : {}),
        ...(subcategoryKey ? { serviceKey: subcategoryKey } : {}),
        createdAt: { $gte: start, $lte: end },
      }),
      this.offerModel
        .aggregate<FunnelOfferAggregateRow>([
          {
            $match: {
              ...offerFunnelMatch,
              createdAt: { $gte: start, $lte: end },
            },
          },
          {
            $lookup: {
              from: 'requests',
              let: { requestId: '$requestId' },
              pipeline: [
                {
                  $match: {
                    $expr: { $eq: [{ $toString: '$_id' }, '$$requestId'] },
                  },
                },
                {
                  $project: {
                    _id: 0,
                    cityId: '$cityId',
                    categoryKey: '$categoryKey',
                    serviceKey: '$serviceKey',
                  },
                },
              ],
              as: 'requestRef',
            },
          },
          { $unwind: '$requestRef' },
          ...(Object.keys(requestRefScopeMatch).length > 0 ? [{ $match: requestRefScopeMatch }] : []),
          {
            $group: {
              _id: null,
              offersTotal: { $sum: 1 },
              confirmedResponsesTotal: {
                $sum: {
                  $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0],
                },
              },
            },
          },
        ])
        .exec(),
      this.contractModel
        .aggregate<FunnelContractAggregateRow>([
          {
            $lookup: {
              from: 'requests',
              let: { requestId: '$requestId' },
              pipeline: [
                {
                  $match: {
                    $expr: { $eq: [{ $toString: '$_id' }, '$$requestId'] },
                  },
                },
                {
                  $project: {
                    _id: 0,
                    cityId: '$cityId',
                    categoryKey: '$categoryKey',
                    serviceKey: '$serviceKey',
                  },
                },
              ],
              as: 'requestRef',
            },
          },
          { $unwind: '$requestRef' },
          ...(Object.keys(requestRefScopeMatch).length > 0 ? [{ $match: requestRefScopeMatch }] : []),
          {
            $match: {
              ...contractFunnelMatch,
              $or: [
                { createdAt: { $gte: start, $lte: end } },
                { confirmedAt: { $gte: start, $lte: end } },
                { completedAt: { $gte: start, $lte: end } },
              ],
            },
          },
          {
            $group: {
              _id: null,
              closedContractsTotal: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $in: ['$status', ['confirmed', 'in_progress', 'completed']] },
                        {
                          $or: [
                            {
                              $and: [
                                { $ne: ['$confirmedAt', null] },
                                { $gte: ['$confirmedAt', start] },
                                { $lte: ['$confirmedAt', end] },
                              ],
                            },
                            {
                              $and: [
                                { $eq: ['$confirmedAt', null] },
                                { $gte: ['$createdAt', start] },
                                { $lte: ['$createdAt', end] },
                              ],
                            },
                          ],
                        },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              completedJobsTotal: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $eq: ['$status', 'completed'] },
                        { $ne: ['$completedAt', null] },
                        { $gte: ['$completedAt', start] },
                        { $lte: ['$completedAt', end] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              profitAmount: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $eq: ['$status', 'completed'] },
                        { $ne: ['$completedAt', null] },
                        { $gte: ['$completedAt', start] },
                        { $lte: ['$completedAt', end] },
                        { $ne: ['$priceAmount', null] },
                        { $gt: ['$priceAmount', 0] },
                      ],
                    },
                    '$priceAmount',
                    0,
                  ],
                },
              },
            },
          },
        ])
        .exec(),
      marketFunnelRequestsPromise,
      marketFunnelOffersPromise,
      marketFunnelContractsPromise,
    ]);

    return {
      publicOverview,
      filterOptionsPublicOverview,
      activity,
      filterOptionsCategoryRows,
      categoryRows,
      cityRows,
      offerCityRows,
      searchCityRows,
      requestResponseRows,
      contractLifecycleRows,
      reviewSummary,
      activeProviderRows,
      activeProvidersByCityRows,
      funnelRequestsTotal,
      funnelOffersRows,
      funnelContractsRows,
      marketFunnelRequestsTotal,
      marketFunnelOffersRows,
      marketFunnelContractsRows,
    };
  }

  private aggregateCategoryRows(params: {
    start: Date;
    end: Date;
    match?: Record<string, unknown>;
  }) {
    return this.requestModel
      .aggregate<WorkspaceStatisticsCategoryAggregateRow>([
        {
          $match: {
            status: 'published',
            createdAt: { $gte: params.start, $lte: params.end },
            ...(params.match ?? {}),
          },
        },
        {
          $group: {
            _id: {
              categoryKey: '$categoryKey',
              categoryName: '$categoryName',
              subcategoryName: '$subcategoryName',
              serviceKey: '$serviceKey',
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ])
      .exec();
  }
}
