import { Injectable, Logger } from '@nestjs/common';
import { VIEM_CONFIG } from 'app.config';
import { ApiEcosystemFpsInfo } from './ecosystem.fps.types';
import { gql } from '@apollo/client/core';
import { ADDRESS } from '@frankencoin/zchf';
import { EquityABI, FrankencoinABI, ChainIdMain } from '@frankencoin/zchf';
import { mainnet } from 'viem/chains';
import { formatFloat } from 'utils/format';
import { DataSourceManagerService } from 'core/data-source/data-source.manager.service';

@Injectable()
export class EcosystemFpsService {
	private readonly logger = new Logger(this.constructor.name);
	private fpsInfo: ApiEcosystemFpsInfo;

	constructor(private readonly dataSource: DataSourceManagerService) {}

	getEcosystemFpsInfo(): ApiEcosystemFpsInfo {
		return this.fpsInfo;
	}

	async updateFpsInfo() {
		this.logger.debug('Updating EcosystemFpsInfo');

		const chainId = mainnet.id;
		const addr = ADDRESS[chainId].equity;

		const fetchedPrice = await VIEM_CONFIG[chainId].readContract({
			address: addr,
			abi: EquityABI,
			functionName: 'price',
		});
		const fetchedTotalSupply = await VIEM_CONFIG[chainId].readContract({
			address: addr,
			abi: EquityABI,
			functionName: 'totalSupply',
		});

		const fetchedMinterReserve = await VIEM_CONFIG[chainId].readContract({
			address: ADDRESS[chainId].frankencoin,
			abi: FrankencoinABI,
			functionName: 'minterReserve',
		});

		const fetchedBalanceReserve = await VIEM_CONFIG[chainId].readContract({
			address: ADDRESS[chainId].frankencoin,
			abi: FrankencoinABI,
			functionName: 'balanceOf',
			args: [ADDRESS[chainId].equity],
		});

		const data = await this.dataSource.queryWithFailover<{
			frankencoinProfitLosss: {
				items: {
					profits: bigint;
					losses: bigint;
				}[];
			};
		}>({
			query: gql`
				query {
					frankencoinProfitLosss(orderBy: "count", orderDirection: "DESC", limit: 1) {
						items {
							losses
							profits
						}
					}
				}
			`,
		});

		if (!data || !data.frankencoinProfitLosss.items) {
			this.logger.warn('No profitLossPonder data found.');
			return;
		}

		const d = data.frankencoinProfitLosss.items.at(0);

		this.fpsInfo = {
			erc20: {
				name: 'Frankencoin Pool Share',
				symbol: 'FPS',
				decimals: 18,
			},
			chains: {
				[mainnet.id as ChainIdMain]: {
					chainId: mainnet.id,
					address: addr,
				},
			},
			token: {
				price: formatFloat(fetchedPrice),
				totalSupply: formatFloat(fetchedTotalSupply),
				marketCap: formatFloat(fetchedPrice * fetchedTotalSupply, 18 * 2),
			},
			earnings: {
				profit: formatFloat(d.profits),
				loss: formatFloat(d.losses),
			},
			reserve: {
				balance: formatFloat(fetchedBalanceReserve),
				equity: formatFloat(fetchedBalanceReserve - fetchedMinterReserve),
				minter: formatFloat(fetchedMinterReserve),
			},
		};
	}
}
