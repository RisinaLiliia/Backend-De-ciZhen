import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { Contract, type ContractDocument } from '../contracts/schemas/contract.schema';
import { Offer, type OfferDocument } from '../offers/schemas/offer.schema';
import { Request, type RequestDocument } from '../requests/schemas/request.schema';
import type { WorkspaceStatisticsViewerMode } from './dto/workspace-statistics-query.dto';

export type UserCategoryActivityRow = {
  categoryKey: string | null;
  categoryName: string | null;
  baseCount: number;
  completedCount: number;
};

export type UserCityActivityRow = {
  cityId: string | null;
  cityName: string;
  baseCount: number;
  completedCount: number;
};

export type ActivityDateRow = {
  createdAt?: Date | string | null;
};

type ProviderFunnelOffersRow = {
  _id: null;
  requestsTotal: number;
  offersTotal: number;
  confirmedResponsesTotal: number;
};

type ProviderFunnelContractsRow = {
  _id: null;
  contractsTotal: number;
  completedTotal: number;
  revenueAmount: number;
};

type CustomerFunnelOffersRow = {
  _id: null;
  offersTotal: number;
  acceptedOffersTotal: number;
};

type CustomerFunnelContractsRow = {
  _id: null;
  contractsTotal: number;
  completedTotal: number;
  revenueAmount: number;
};

type ProviderDecisionRow = {
  requestCreatedAt: Date | null;
  firstOfferAt: Date | null;
  hasAcceptedResponse: number;
};

type CustomerDecisionRow = {
  createdAt: Date | null;
  firstOfferAt: Date | null;
};

export type WorkspaceStatisticsViewerSnapshots = {
  providerFunnelOffersRows: ProviderFunnelOffersRow[] | null;
  providerFunnelContractsRows: ProviderFunnelContractsRow[] | null;
  customerFunnelRequestsTotal: number | null;
  customerFunnelOffersRows: CustomerFunnelOffersRow[] | null;
  customerFunnelContractsRows: CustomerFunnelContractsRow[] | null;
  providerCategoryActivityRows: UserCategoryActivityRow[];
  customerCategoryActivityRows: UserCategoryActivityRow[];
  providerCityActivityRows: UserCityActivityRow[];
  customerCityActivityRows: UserCityActivityRow[];
  clientActivityRows: ActivityDateRow[];
  providerActivityRows: ActivityDateRow[];
};

export type WorkspaceStatisticsViewerDecisionSnapshot = {
  viewerScopedResponseMinutes: number | null;
  viewerScopedUnansweredOver24h: number | null;
};

@Injectable()
export class WorkspaceStatisticsViewerSnapshotsService {
  constructor(
    @InjectModel(Request.name) private readonly requestModel: Model<RequestDocument>,
    @InjectModel(Offer.name) private readonly offerModel: Model<OfferDocument>,
    @InjectModel(Contract.name) private readonly contractModel: Model<ContractDocument>,
  ) {}

  async loadViewerSnapshots(params: {
    hasActorScope: boolean;
    viewerMode: WorkspaceStatisticsViewerMode | null;
    normalizedUserId: string;
    cityId: string | null;
    categoryKey: string | null;
    subcategoryKey: string | null;
    start: Date;
    end: Date;
    requestRefScopeMatch: Record<string, unknown>;
    funnelRequestRefScopeMatch: Record<string, unknown>;
  }): Promise<WorkspaceStatisticsViewerSnapshots> {
    const {
      hasActorScope,
      viewerMode,
      normalizedUserId,
      cityId,
      categoryKey,
      subcategoryKey,
      start,
      end,
      requestRefScopeMatch,
      funnelRequestRefScopeMatch,
    } = params;

    const providerFunnelOffersPromise = hasActorScope && viewerMode === 'provider'
      ? this.offerModel
          .aggregate<ProviderFunnelOffersRow>([
            {
              $match: {
                providerUserId: normalizedUserId,
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
                requestsTotal: { $sum: 1 },
                offersTotal: { $sum: 1 },
                confirmedResponsesTotal: { $sum: '$hasAcceptedResponse' },
              },
            },
          ])
          .exec()
      : Promise.resolve<ProviderFunnelOffersRow[] | null>(null);

    const providerFunnelContractsPromise = hasActorScope && viewerMode === 'provider'
      ? this.contractModel
          .aggregate<ProviderFunnelContractsRow>([
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
              $match: {
                providerUserId: normalizedUserId,
              },
            },
            {
              $lookup: {
                from: 'offers',
                let: { requestId: '$requestId' },
                pipeline: [
                  {
                    $match: {
                      providerUserId: normalizedUserId,
                      status: 'accepted',
                      $expr: { $eq: ['$requestId', '$$requestId'] },
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
                    $cond: [
                      { $eq: ['$status', 'completed'] },
                      1,
                      0,
                    ],
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
                contractsTotal: {
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
                completedTotal: {
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
                revenueAmount: {
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
      : Promise.resolve<ProviderFunnelContractsRow[] | null>(null);

    const customerFunnelRequestsPromise = hasActorScope && viewerMode === 'customer'
      ? this.requestModel.countDocuments({
          clientId: normalizedUserId,
          ...(cityId ? { cityId } : {}),
          ...(categoryKey ? { categoryKey } : {}),
          ...(subcategoryKey ? { serviceKey: subcategoryKey } : {}),
          createdAt: { $gte: start, $lte: end },
        })
      : Promise.resolve<number | null>(null);

    const customerFunnelOffersPromise = hasActorScope && viewerMode === 'customer'
      ? this.offerModel
          .aggregate<CustomerFunnelOffersRow>([
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
                      clientId: '$clientId',
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
            {
              $match: {
                ...funnelRequestRefScopeMatch,
                'requestRef.clientId': normalizedUserId,
              },
            },
            {
              $group: {
                _id: '$requestId',
                hasAcceptedOffer: {
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
                acceptedOffersTotal: { $sum: '$hasAcceptedOffer' },
              },
            },
          ])
          .exec()
      : Promise.resolve<CustomerFunnelOffersRow[] | null>(null);

    const customerFunnelContractsPromise = hasActorScope && viewerMode === 'customer'
      ? this.contractModel
          .aggregate<CustomerFunnelContractsRow>([
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
                      clientId: '$clientId',
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
            {
              $match: {
                ...funnelRequestRefScopeMatch,
                'requestRef.clientId': normalizedUserId,
              },
            },
            {
              $lookup: {
                from: 'offers',
                let: { requestId: '$requestId' },
                pipeline: [
                  {
                    $match: {
                      status: 'accepted',
                      $expr: { $eq: ['$requestId', '$$requestId'] },
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
                hasAcceptedOffer: {
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
                    $cond: [
                      { $eq: ['$status', 'completed'] },
                      1,
                      0,
                    ],
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
                contractsTotal: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $eq: ['$hasAcceptedOffer', 1] },
                          { $eq: ['$hasContract', 1] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                completedTotal: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $eq: ['$hasAcceptedOffer', 1] },
                          { $eq: ['$hasCompleted', 1] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                revenueAmount: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $eq: ['$hasAcceptedOffer', 1] },
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
      : Promise.resolve<CustomerFunnelContractsRow[] | null>(null);

    const providerCategoryActivityPromise = hasActorScope && viewerMode === 'provider'
      ? this.offerModel
          .aggregate<UserCategoryActivityRow>([
            {
              $match: {
                providerUserId: normalizedUserId,
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
                      categoryKey: '$categoryKey',
                      categoryName: '$categoryName',
                      cityId: '$cityId',
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
                  categoryKey: '$requestRef.categoryKey',
                  categoryName: '$requestRef.categoryName',
                },
                baseCount: { $sum: 1 },
                completedCount: {
                  $sum: {
                    $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0],
                  },
                },
              },
            },
            {
              $project: {
                _id: 0,
                categoryKey: '$_id.categoryKey',
                categoryName: '$_id.categoryName',
                baseCount: 1,
                completedCount: 1,
              },
            },
          ])
          .exec()
      : Promise.resolve<UserCategoryActivityRow[]>([]);

    const customerCategoryActivityPromise = hasActorScope && viewerMode === 'customer'
      ? this.requestModel
          .aggregate<UserCategoryActivityRow>([
            {
              $match: {
                clientId: normalizedUserId,
                ...(cityId ? { cityId } : {}),
                ...(categoryKey ? { categoryKey } : {}),
                ...(subcategoryKey ? { serviceKey: subcategoryKey } : {}),
                createdAt: { $gte: start, $lte: end },
              },
            },
            {
              $group: {
                _id: {
                  categoryKey: '$categoryKey',
                  categoryName: '$categoryName',
                },
                baseCount: { $sum: 1 },
                completedCount: { $sum: 0 },
              },
            },
            {
              $project: {
                _id: 0,
                categoryKey: '$_id.categoryKey',
                categoryName: '$_id.categoryName',
                baseCount: 1,
                completedCount: 1,
              },
            },
          ])
          .exec()
      : Promise.resolve<UserCategoryActivityRow[]>([]);

    const providerCityActivityPromise = hasActorScope && viewerMode === 'provider'
      ? this.offerModel
          .aggregate<UserCityActivityRow>([
            {
              $match: {
                providerUserId: normalizedUserId,
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
                baseCount: { $sum: 1 },
                completedCount: {
                  $sum: {
                    $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0],
                  },
                },
              },
            },
            {
              $project: {
                _id: 0,
                cityId: '$_id.cityId',
                cityName: '$_id.cityName',
                baseCount: 1,
                completedCount: 1,
              },
            },
          ])
          .exec()
      : Promise.resolve<UserCityActivityRow[]>([]);

    const customerCityActivityPromise = hasActorScope && viewerMode === 'customer'
      ? this.requestModel
          .aggregate<UserCityActivityRow>([
            {
              $match: {
                clientId: normalizedUserId,
                ...(cityId ? { cityId } : {}),
                ...(categoryKey ? { categoryKey } : {}),
                createdAt: { $gte: start, $lte: end },
              },
            },
            {
              $group: {
                _id: {
                  cityId: '$cityId',
                  cityName: '$cityName',
                },
                baseCount: { $sum: 1 },
                completedCount: { $sum: 0 },
              },
            },
            {
              $project: {
                _id: 0,
                cityId: '$_id.cityId',
                cityName: '$_id.cityName',
                baseCount: 1,
                completedCount: 1,
              },
            },
          ])
          .exec()
      : Promise.resolve<UserCityActivityRow[]>([]);

    const clientActivityRowsPromise = hasActorScope
      ? this.requestModel
          .aggregate<ActivityDateRow>([
            {
              $match: {
                clientId: normalizedUserId,
                ...(cityId ? { cityId } : {}),
                ...(categoryKey ? { categoryKey } : {}),
                createdAt: { $gte: start, $lte: end },
              },
            },
            {
              $project: {
                _id: 0,
                createdAt: 1,
              },
            },
          ])
          .exec()
      : Promise.resolve<ActivityDateRow[]>([]);

    const providerActivityRowsPromise = hasActorScope
      ? this.offerModel
          .aggregate<ActivityDateRow>([
            {
              $match: {
                providerUserId: normalizedUserId,
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
                    },
                  },
                ],
                as: 'requestRef',
              },
            },
            { $unwind: '$requestRef' },
            ...(Object.keys(requestRefScopeMatch).length > 0 ? [{ $match: requestRefScopeMatch }] : []),
            {
              $project: {
                _id: 0,
                createdAt: 1,
              },
            },
          ])
          .exec()
      : Promise.resolve<ActivityDateRow[]>([]);

    const [
      providerFunnelOffersRows,
      providerFunnelContractsRows,
      customerFunnelRequestsTotal,
      customerFunnelOffersRows,
      customerFunnelContractsRows,
      providerCategoryActivityRows,
      customerCategoryActivityRows,
      providerCityActivityRows,
      customerCityActivityRows,
      clientActivityRows,
      providerActivityRows,
    ] = await Promise.all([
      providerFunnelOffersPromise,
      providerFunnelContractsPromise,
      customerFunnelRequestsPromise,
      customerFunnelOffersPromise,
      customerFunnelContractsPromise,
      providerCategoryActivityPromise,
      customerCategoryActivityPromise,
      providerCityActivityPromise,
      customerCityActivityPromise,
      clientActivityRowsPromise,
      providerActivityRowsPromise,
    ]);

    return {
      providerFunnelOffersRows,
      providerFunnelContractsRows,
      customerFunnelRequestsTotal,
      customerFunnelOffersRows,
      customerFunnelContractsRows,
      providerCategoryActivityRows,
      customerCategoryActivityRows,
      providerCityActivityRows,
      customerCityActivityRows,
      clientActivityRows,
      providerActivityRows,
    };
  }

  async loadViewerDecisionSnapshot(params: {
    hasActorScope: boolean;
    viewerMode: WorkspaceStatisticsViewerMode | null;
    normalizedUserId: string;
    cityId: string | null;
    categoryKey: string | null;
    subcategoryKey: string | null;
    start: Date;
    end: Date;
    funnelRequestRefScopeMatch: Record<string, unknown>;
    unansweredThreshold: Date;
  }): Promise<WorkspaceStatisticsViewerDecisionSnapshot> {
    const {
      hasActorScope,
      viewerMode,
      normalizedUserId,
      cityId,
      categoryKey,
      subcategoryKey,
      start,
      end,
      funnelRequestRefScopeMatch,
      unansweredThreshold,
    } = params;

    if (!hasActorScope || !viewerMode) {
      return {
        viewerScopedResponseMinutes: null,
        viewerScopedUnansweredOver24h: null,
      };
    }

    if (viewerMode === 'provider') {
      const providerDecisionRows = await this.offerModel
        .aggregate<ProviderDecisionRow>([
          {
            $match: {
              providerUserId: normalizedUserId,
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
              requestCreatedAt: { $min: '$requestRef.createdAt' },
              firstOfferAt: { $min: '$createdAt' },
              hasAcceptedResponse: {
                $max: {
                  $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0],
                },
              },
            },
          },
          {
            $project: {
              _id: 0,
              requestCreatedAt: 1,
              firstOfferAt: 1,
              hasAcceptedResponse: 1,
            },
          },
        ])
        .exec();

      const providerResponseMinutes = providerDecisionRows
        .map((row) => {
          const requestCreatedAt = row.requestCreatedAt ? new Date(row.requestCreatedAt) : null;
          const firstOfferAt = row.firstOfferAt ? new Date(row.firstOfferAt) : null;
          if (!requestCreatedAt || !firstOfferAt) return null;
          if (
            !Number.isFinite(requestCreatedAt.getTime()) ||
            !Number.isFinite(firstOfferAt.getTime())
          ) {
            return null;
          }
          if (firstOfferAt < requestCreatedAt) return null;
          return (firstOfferAt.getTime() - requestCreatedAt.getTime()) / 60000;
        })
        .filter(
          (value): value is number =>
            typeof value === 'number' && Number.isFinite(value) && value >= 0,
        );

      return {
        viewerScopedResponseMinutes: this.toMedian(providerResponseMinutes),
        viewerScopedUnansweredOver24h: providerDecisionRows.filter((row) => {
          const firstOfferAt = row.firstOfferAt ? new Date(row.firstOfferAt) : null;
          if (!firstOfferAt || !Number.isFinite(firstOfferAt.getTime())) return false;
          if (firstOfferAt > unansweredThreshold) return false;
          return row.hasAcceptedResponse === 0;
        }).length,
      };
    }

    const customerDecisionRows = await this.requestModel
      .aggregate<CustomerDecisionRow>([
        {
          $match: {
            clientId: normalizedUserId,
            ...(cityId ? { cityId } : {}),
            ...(categoryKey ? { categoryKey } : {}),
            ...(subcategoryKey ? { serviceKey: subcategoryKey } : {}),
            createdAt: { $gte: start, $lte: end },
          },
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
      ])
      .exec();

    const customerResponseMinutes = customerDecisionRows
      .map((row) => {
        const createdAt = row.createdAt ? new Date(row.createdAt) : null;
        const firstOfferAt = row.firstOfferAt ? new Date(row.firstOfferAt) : null;
        if (!createdAt || !firstOfferAt) return null;
        if (!Number.isFinite(createdAt.getTime()) || !Number.isFinite(firstOfferAt.getTime())) {
          return null;
        }
        if (firstOfferAt < createdAt) return null;
        return (firstOfferAt.getTime() - createdAt.getTime()) / 60000;
      })
      .filter(
        (value): value is number =>
          typeof value === 'number' && Number.isFinite(value) && value >= 0,
      );

    return {
      viewerScopedResponseMinutes: this.toMedian(customerResponseMinutes),
      viewerScopedUnansweredOver24h: customerDecisionRows.filter((row) => {
        const createdAt = row.createdAt ? new Date(row.createdAt) : null;
        if (!createdAt || !Number.isFinite(createdAt.getTime())) return false;
        if (createdAt > unansweredThreshold) return false;
        return row.firstOfferAt === null;
      }).length,
    };
  }

  private toMedian(values: number[]): number | null {
    if (values.length === 0) return null;
    const sorted = values.slice().sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      return Math.round((((sorted[middle - 1] + sorted[middle]) / 2) * 100)) / 100;
    }
    return Math.round((sorted[middle] * 100)) / 100;
  }
}
