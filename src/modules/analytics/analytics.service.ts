import { Injectable, Logger } from '@nestjs/common';
import { VIEM_CONFIG } from 'app.config';
import { DataSourceManagerService } from 'core/data-source/data-source.manager.service';
import { EcosystemFpsService } from 'modules/ecosystem/ecosystem.fps.service';
import { PositionsService } from 'modules/positions/positions.service';
import { uniqueValues } from 'utils/format-array';
import { formatUnits } from 'viem';
import {
	AnalyticsDailyLog,
	AnalyticsExposureItem,
	AnalyticsProfitLossLog,
	AnalyticsTransactionLog,
	ApiAnalyticsCollateralExposure,
	ApiAnalyticsFpsEarnings,
	ApiAnalyticsProfitLossLog,
	ApiDailyLog,
	ApiTransactionLog,
} from './analytics.types';
import { EcosystemFrankencoinService } from 'modules/ecosystem/ecosystem.frankencoin.service';
import { EcosystemMinterService } from 'modules/ecosystem/ecosystem.minter.service';
import { ADDRESS } from '@frankencoin/zchf';
import { FrankencoinABI } from '@frankencoin/zchf';
import { SavingsCoreService } from 'modules/savings/savings.core.service';
import { gql } from '@apollo/client/core';
import { Interval } from '@nestjs/schedule';
import { mainnet } from 'viem/chains';

@Injectable()
export class AnalyticsService {
	private readonly logger = new Logger(this.constructor.name);
	private exposure: ApiAnalyticsCollateralExposure;
	private fetchedDailyLogs: AnalyticsDailyLog[] = [];

	constructor(
		private readonly positions: PositionsService,
		private readonly fps: EcosystemFpsService,
		private readonly fc: EcosystemFrankencoinService,
		private readonly minters: EcosystemMinterService,
		private readonly save: SavingsCoreService,
		private readonly dataSource: DataSourceManagerService
	) {
		setTimeout(() => this.updateDailyLog(), 10000);
	}

	async getProfitLossLog(): Promise<ApiAnalyticsProfitLossLog> {
		this.logger.debug('Fetching profit loss log...');
		const data = await this.dataSource.queryWithFailover<{
			frankencoinProfitLosss: {
				items: AnalyticsProfitLossLog[];
			};
		}>({
			query: gql`
				query {
					frankencoinProfitLosss(orderBy: "count", orderDirection: "desc", limit: 1000) {
						items {
							chainId
							minter
							created
							count
							kind
							amount
							profits
							losses
							perFPS
						}
					}
				}
			`,
			mergeBackupChainItems: {
				rootField: 'frankencoinProfitLosss',
				orderBy: 'count',
				orderDirection: 'desc',
				limit: 1000,
			},
		});

		if (!data || !data.frankencoinProfitLosss.items) {
			this.logger.warn('No profitloss data found.');
			return;
		}

		const logs = data.frankencoinProfitLosss.items as AnalyticsProfitLossLog[];

		return {
			num: logs.length,
			logs,
		};
	}

	async getCollateralExposure(): Promise<ApiAnalyticsCollateralExposure> {
		const positions = this.positions.getPositionsOpen().map;
		const list = Object.values(positions);
		const collaterals = list.map((p) => p.collateral).filter(uniqueValues);
		const fps = this.fps.getEcosystemFpsInfo();

		let positionsTheta: number = 0;
		let positionsThetaPerToken: number = 0;

		const minterReserveRaw = await VIEM_CONFIG[mainnet.id].readContract({
			address: ADDRESS[mainnet.id].frankencoin,
			abi: FrankencoinABI,
			functionName: 'minterReserve',
		});

		const balanceReserveRaw = await VIEM_CONFIG[mainnet.id].readContract({
			address: ADDRESS[mainnet.id].frankencoin,
			abi: FrankencoinABI,
			functionName: 'balanceOf',
			args: [ADDRESS[mainnet.id].equity],
		});

		const equityInReserveRaw = balanceReserveRaw - minterReserveRaw;

		const minterReserve = formatUnits(minterReserveRaw, 18);
		const balanceReserve = formatUnits(balanceReserveRaw, 18);
		const equityInReserve = formatUnits(equityInReserveRaw, 18);

		const returnData = [];

		for (const c of collaterals) {
			const pos = list.filter((p) => p.collateral === c);
			const originals = pos.filter((p) => p.isOriginal === true);
			const clones = pos.filter((p) => p.isClone === true);

			const totalMintedRaw = pos.reduce<bigint>((a, b) => a + BigInt(b.minted), 0n);
			const totalMinted = formatUnits(totalMintedRaw, 18);
			const totalLimitRaw = pos.reduce<bigint>((a, b) => a + BigInt(b.limitForClones), 0n);
			const totalLimit = formatUnits(totalLimitRaw, 18);
			const totalMintedRatioPPM = (totalMintedRaw * BigInt(1_000_000)) / totalLimitRaw;
			const totalMintedRatio = parseInt(totalMintedRatioPPM.toString()) / 1_000_000;

			const interestMulRaw = pos.reduce<bigint>((a, b) => {
				const effI = Math.floor((b.annualInterestPPM * 1_000_000) / (1_000_000 - b.reserveContribution));
				return a + BigInt(b.minted) * BigInt(effI);
			}, 0n);
			const interestAvgPPM = totalMintedRaw > 0 ? parseInt(interestMulRaw.toString()) / parseInt(totalMintedRaw.toString()) : 0;
			const interestAvg = parseInt(interestAvgPPM.toString()) / 1_000_000;

			const totalTheta = (interestAvg * parseFloat(totalMinted)) / 365;
			positionsTheta += totalTheta;
			const thetaPerToken = totalTheta / fps.token.totalSupply;
			positionsThetaPerToken += thetaPerToken;

			const totalContributionMul = pos.reduce<bigint>((a, b) => {
				return a + BigInt(b.minted) * BigInt(b.reserveContribution);
			}, 0n);

			const totalContributionRaw = BigInt(Math.floor(parseInt(formatUnits(totalContributionMul, 6))));
			const equityInReserveWipedRaw = equityInReserveRaw + totalContributionRaw - totalMintedRaw;
			const fpsPriceWiped = (parseFloat(formatUnits(equityInReserveWipedRaw, 18)) * 3) / fps.token.totalSupply;
			const riskRatioWiped = Math.round(1_000_000 * (1 - fpsPriceWiped / fps.token.price)) / 1_000_000;

			const data: AnalyticsExposureItem = {
				collateral: {
					address: c,
					chainId: mainnet.id,
					name: pos.at(0).collateralName,
					symbol: pos.at(0).collateralSymbol,
				},
				positions: {
					open: pos.length,
					originals: originals.length,
					clones: clones.length,
				},
				mint: {
					totalMinted: parseFloat(totalMinted),
					totalContribution: parseFloat(formatUnits(totalContributionRaw, 18)),
					totalLimit: parseFloat(totalLimit),
					totalMintedRatio: totalMintedRatio,
					interestAverage: interestAvg,
					totalTheta: totalTheta,
					thetaPerFpsToken: thetaPerToken,
				},
				reserveRiskWiped: {
					fpsPrice: fpsPriceWiped < 0 ? 0 : fpsPriceWiped,
					riskRatio: riskRatioWiped,
				},
			};

			returnData.push(data);
		}

		this.exposure = {
			general: {
				balanceInReserve: parseFloat(balanceReserve),
				mintersContribution: parseFloat(minterReserve),
				equityInReserve: parseFloat(equityInReserve),
				fpsPrice: fps.token.price,
				fpsTotalSupply: fps.token.totalSupply,
				thetaFromPositions: positionsTheta,
				thetaPerToken: positionsThetaPerToken,
				earningsPerAnnum: positionsTheta * 365,
				earningsPerToken: positionsThetaPerToken * 365,
				priceToEarnings: fps.token.price / (positionsThetaPerToken * 365),
				priceToBookValue: 3,
			},
			exposures: returnData,
		};

		return this.exposure;
	}

	async getFpsEarnings(): Promise<ApiAnalyticsFpsEarnings> {
		const num: number = this.positions.getPositionsList().list.filter((p) => p.isOriginal).length;
		const positionProposalFees: number = 1000 * num;
		const investFeeRaw = this.fc.getEcosystemFrankencoinKeyValues()['Equity:InvestedFeePaidPPM']?.amount || 0n;
		const investFees = parseFloat(formatUnits(investFeeRaw, 18 + 6));
		const redeemFeeRaw = this.fc.getEcosystemFrankencoinKeyValues()['Equity:RedeemedFeePaidPPM']?.amount || 0n;
		const redeemFees = parseFloat(formatUnits(redeemFeeRaw, 18 + 6));
		const minterProposalFees = this.minters
			.getMintersList()
			.list.reduce<number>((a, b) => a + parseFloat(formatUnits(BigInt(b.applicationFee), 18)), 0);
		const otherProfitClaims: number = this.fps.getEcosystemFpsInfo().earnings.profit - positionProposalFees - minterProposalFees;

		const expo = await this.getCollateralExposure();
		const equityAdjusted: number = expo.general.equityInReserve;
		const otherContributions: number =
			equityAdjusted - minterProposalFees - investFees - redeemFees - positionProposalFees - otherProfitClaims;

		return {
			minterProposalFees,
			investFees,
			redeemFees,
			positionProposalFees,
			otherProfitClaims,
			otherContributions,

			savingsInterestCosts: this.save.getInfo().totalInterest,
			otherLossClaims: this.fps.getEcosystemFpsInfo().earnings.loss,
		};
	}

	async getTransactionLog(latest: boolean, limit: number = 50, after: string = ''): Promise<ApiTransactionLog> {
		this.logger.debug('Fetching transaction log...');
		const txLog = await this.dataSource.queryWithFailover<{
			analyticTransactionLogs: {
				items: AnalyticsTransactionLog[];
			};
		}>({
			query: gql`
				query {
					analyticTransactionLogs(orderBy: "count", orderDirection: "${latest ? 'desc' : 'asc'}", limit: ${limit}, ${after.length > 0 ? `after: "${after}"` : ''}) {
						items {
							chainId,
							count,
							timestamp,
							kind,
							amount,
							txHash,

							totalInflow,
							totalOutflow,
							totalTradeFee,

							totalSupply,
							totalEquity,
							totalSavings,

							fpsTotalSupply,
							fpsPrice,

							totalMintedV1,
							totalMintedV2,

							currentMintLeadRate,
							currentSaveLeadRate,
							projectedInterests,
							annualV1Interests,
							annualV2Interests,

							annualV1BorrowRate,
							annualV2BorrowRate,

							annualNetEarnings,
							realizedNetEarnings,
							earningsPerFPS,
						}
						pageInfo {
							startCursor
       			 			endCursor
        					hasNextPage
      					}
					}
				}
			`,
			preferBackup: true,
		});

		if (!txLog || !txLog.analyticTransactionLogs.items) {
			this.logger.warn('No transaction log data found.');
			return;
		}

		const logs = txLog.analyticTransactionLogs.items;

		return {
			num: logs.length,
			logs,
			// @ts-expect-error not in type
			pageInfo: txLog.analyticTransactionLogs.pageInfo ?? {
				startCursor: '',
				endCursor: '',
				hasNextPage: false,
			},
		};
	}

	@Interval(10 * 60 * 1000) // 10min
	async updateDailyLog() {
		this.logger.debug('Fetching daily log...');
		const fetched = await this.dataSource.queryWithFailover<{
			analyticDailyLogs: {
				items: AnalyticsDailyLog[];
			};
		}>({
			query: gql`
				query {
					analyticDailyLogs(orderBy: "timestamp", orderDirection: "asc", limit: 1000) {
						items {
							date
							timestamp
							txHash

							totalInflow
							totalOutflow
							totalTradeFee

							totalSupply
							totalEquity
							totalSavings

							fpsTotalSupply
							fpsPrice

							totalMintedV1
							totalMintedV2

							currentMintLeadRate
							currentSaveLeadRate
							projectedInterests
							annualV1Interests
							annualV2Interests

							annualV1BorrowRate
							annualV2BorrowRate

							annualNetEarnings
							realizedNetEarnings
							earningsPerFPS
						}
					}
				}
			`,
		});

		if (!fetched || !fetched.analyticDailyLogs.items) {
			this.logger.warn('No daily log data found.');
			return;
		}

		this.fetchedDailyLogs = fetched.analyticDailyLogs.items;
	}

	getDailyLog(): ApiDailyLog {
		return {
			num: this.fetchedDailyLogs.length,
			logs: this.fetchedDailyLogs,
		};
	}
}
