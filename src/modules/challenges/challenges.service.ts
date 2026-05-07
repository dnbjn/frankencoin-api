import { Injectable, Logger } from '@nestjs/common';
import { gql } from '@apollo/client/core';
import { VIEM_CONFIG } from 'app.config';
import { DataSourceManagerService } from 'core/data-source/data-source.manager.service';
import {
	ApiBidsBidders,
	ApiBidsChallenges,
	ApiBidsListing,
	ApiBidsMapping,
	ApiBidsPositions,
	ApiChallengesChallengers,
	ApiChallengesListing,
	ApiChallengesMapping,
	ApiChallengesPositions,
	ApiChallengesPrices,
	BidsBidderMapping,
	BidsChallengesMapping,
	BidsId,
	BidsPositionsMapping,
	BidsQueryItem,
	BidsQueryItemMapping,
	ChallengesChallengersMapping,
	ChallengesId,
	ChallengesPositionsMapping,
	ChallengesPricesMapping,
	ChallengesQueryItem,
	ChallengesQueryItemMapping,
	ChallengesQueryStatus,
} from './challenges.types';
import { Address } from 'viem';
import { normalizeAddress } from 'utils/format';
import { ADDRESS, MintingHubV1ABI, MintingHubV2ABI } from '@frankencoin/zchf';
import { mainnet } from 'viem/chains';

@Injectable()
export class ChallengesService {
	private readonly logger = new Logger(this.constructor.name);
	private fetchedChallengesMapping: ChallengesQueryItemMapping = {};
	private fetchedBidsMapping: BidsQueryItemMapping = {};
	private fetchedPrices: ChallengesPricesMapping = {};

	constructor(private readonly dataSource: DataSourceManagerService) {}

	getChallenges(): ApiChallengesListing {
		return {
			num: Object.keys(this.fetchedChallengesMapping).length,
			list: Object.values(this.fetchedChallengesMapping),
		};
	}

	getChallengesMapping(): ApiChallengesMapping {
		const c = this.fetchedChallengesMapping;
		return {
			num: Object.keys(c).length,
			challenges: Object.keys(c) as ChallengesId[],
			map: c,
		};
	}

	getChallengersMapping(): ApiChallengesChallengers {
		const challengersMapping: ChallengesChallengersMapping = {};
		for (const challenge of Object.values(this.fetchedChallengesMapping)) {
			if (!challengersMapping[normalizeAddress(challenge.challenger)]) {
				challengersMapping[normalizeAddress(challenge.challenger)] = [];
			}
			challengersMapping[normalizeAddress(challenge.challenger)].push(challenge);
		}

		return {
			num: Object.keys(challengersMapping).length,
			challengers: Object.keys(challengersMapping) as Address[],
			map: challengersMapping,
		};
	}

	getChallengesPositions(): ApiChallengesPositions {
		const positionsMapping: ChallengesPositionsMapping = {};
		for (const challenge of Object.values(this.fetchedChallengesMapping)) {
			if (!positionsMapping[normalizeAddress(challenge.position)]) {
				positionsMapping[normalizeAddress(challenge.position)] = [];
			}
			positionsMapping[normalizeAddress(challenge.position)].push(challenge);
		}

		return {
			num: Object.keys(positionsMapping).length,
			positions: Object.keys(positionsMapping) as Address[],
			map: positionsMapping,
		};
	}

	// challenges prices
	getChallengesPrices(): ApiChallengesPrices {
		const pr = this.fetchedPrices;
		return {
			num: Object.keys(pr).length,
			ids: Object.keys(pr) as ChallengesId[],
			map: pr,
		};
	}

	// --------------------------------------------------------------------------
	// --------------------------------------------------------------------------
	// --------------------------------------------------------------------------
	getBids(): ApiBidsListing {
		return {
			num: Object.values(this.fetchedBidsMapping).length,
			list: Object.values(this.fetchedBidsMapping),
		};
	}

	getBidsMapping(): ApiBidsMapping {
		const b = this.fetchedBidsMapping;
		return {
			num: Object.keys(b).length,
			bidIds: Object.keys(b) as BidsId[],
			map: b,
		};
	}

	// bids/bidders
	getBidsBiddersMapping(): ApiBidsBidders {
		const biddersMapping: BidsBidderMapping = {};
		for (const bid of Object.values(this.fetchedBidsMapping)) {
			if (!biddersMapping[normalizeAddress(bid.bidder)]) {
				biddersMapping[normalizeAddress(bid.bidder)] = [];
			}
			biddersMapping[normalizeAddress(bid.bidder)].push(bid);
		}

		return {
			num: Object.keys(biddersMapping).length,
			bidders: Object.keys(biddersMapping) as Address[],
			map: biddersMapping,
		};
	}

	// bids/challenges
	getBidsChallengesMapping(): ApiBidsChallenges {
		const bidChallengesMapping: BidsChallengesMapping = {};
		for (const bid of Object.values(this.fetchedBidsMapping)) {
			const challengeId = `${normalizeAddress(bid.position)}-challenge-${bid.number}`;
			if (!bidChallengesMapping[challengeId]) {
				bidChallengesMapping[challengeId] = [];
			}
			bidChallengesMapping[challengeId].push(bid);
		}

		return {
			num: Object.keys(bidChallengesMapping).length,
			challenges: Object.keys(bidChallengesMapping) as Address[],
			map: bidChallengesMapping,
		};
	}

	// bids/positions
	getBidsPositionsMapping(): ApiBidsPositions {
		const bidPositionsMapping: BidsPositionsMapping = {};
		for (const bid of Object.values(this.fetchedBidsMapping)) {
			const key = normalizeAddress(bid.position);
			if (!bidPositionsMapping[key]) {
				bidPositionsMapping[key] = [];
			}
			bidPositionsMapping[key].push(bid);
		}

		return {
			num: Object.keys(bidPositionsMapping).length,
			positions: Object.keys(bidPositionsMapping) as Address[],
			map: bidPositionsMapping,
		};
	}

	// --------------------------------------------------------------------------
	// --------------------------------------------------------------------------
	// --------------------------------------------------------------------------
	async updateChallengesPrices() {
		this.logger.debug('Updating ChallengesPrices');
		const active = this.getChallenges().list.filter((c: ChallengesQueryItem) => c.status === ChallengesQueryStatus.Active);

		// mapping active challenge -> prices
		const challengesPrices: ChallengesPricesMapping = {};
		const id = mainnet.id;
		for (const c of active) {
			const price = await VIEM_CONFIG[mainnet.id].readContract({
				abi: c.version === 1 ? MintingHubV1ABI : MintingHubV2ABI,
				address: c.version === 1 ? ADDRESS[id].mintingHubV1 : ADDRESS[id].mintingHubV2,
				functionName: 'price',
				args: [parseInt(c.number.toString())],
			});

			challengesPrices[c.id] = price.toString();
		}

		// update
		this.fetchedPrices = challengesPrices;
	}

	// --------------------------------------------------------------------------
	async updateChallengeV1s() {
		this.logger.debug('Updating Challenges V1');
		const challenges = await this.dataSource.queryWithFailover<{
			mintingHubV1ChallengeV1s: {
				items: ChallengesQueryItem[];
			};
		}>({
			query: gql`
				query {
					mintingHubV1ChallengeV1s(orderBy: "status", orderDirection: "asc", limit: 1000) {
						items {
							position
							number
							txHash
							challenger
							start
							created
							duration
							size
							liqPrice
							bids
							filledSize
							acquiredCollateral
							status
						}
					}
				}
			`,
		});

		if (!challenges || !challenges?.mintingHubV1ChallengeV1s?.items?.length) {
			this.logger.warn('No Challenge V1 found.');
			return;
		}

		// mapping
		const list = challenges.mintingHubV1ChallengeV1s.items as ChallengesQueryItem[];

		const mapped: ChallengesQueryItemMapping = {};
		for (const i of list) {
			const key = `${normalizeAddress(i.position)}-challenge-${i.number}`;
			mapped[key] = i;
			mapped[key].version = 1;
			mapped[key].id = key;
		}

		// upsert
		this.fetchedChallengesMapping = { ...this.fetchedChallengesMapping, ...mapped };
	}

	// --------------------------------------------------------------------------
	async updateBidV1s() {
		this.logger.debug('Updating Bids V1');
		const bids = await this.dataSource.queryWithFailover<{
			mintingHubV1ChallengeBidV1s: {
				items: BidsQueryItem[];
			};
		}>({
			query: gql`
				query {
					mintingHubV1ChallengeBidV1s(orderBy: "created", orderDirection: "desc", limit: 1000) {
						items {
							position
							number
							numberBid
							txHash
							bidder
							created
							bidType
							bid
							price
							filledSize
							acquiredCollateral
							challengeSize
						}
					}
				}
			`,
		});

		if (!bids || !bids?.mintingHubV1ChallengeBidV1s?.items?.length) {
			this.logger.warn('No Bids V1 found.');
			return;
		}

		// mapping
		const list = bids.mintingHubV1ChallengeBidV1s.items as BidsQueryItem[];
		const mapped: BidsQueryItemMapping = {};
		for (const i of list) {
			const key = `${normalizeAddress(i.position)}-challenge-${i.number}-bid-${i.numberBid}`;
			mapped[key] = i;
			mapped[key].version = 1;
			mapped[key].id = key;
		}

		// upsert
		this.fetchedBidsMapping = { ...this.fetchedBidsMapping, ...mapped };
	}

	// --------------------------------------------------------------------------
	async updateChallengeV2s() {
		this.logger.debug('Updating Challenges V2');
		const challenges = await this.dataSource.queryWithFailover<{
			mintingHubV2ChallengeV2s: {
				items: ChallengesQueryItem[];
			};
		}>({
			query: gql`
				query {
					mintingHubV2ChallengeV2s(orderBy: "status", orderDirection: "asc", limit: 1000) {
						items {
							position
							number
							txHash
							challenger
							start
							created
							duration
							size
							liqPrice
							bids
							filledSize
							acquiredCollateral
							status
						}
					}
				}
			`,
		});

		if (!challenges || !challenges?.mintingHubV2ChallengeV2s?.items?.length) {
			this.logger.warn('No Challenge V2 found.');
			return;
		}

		// mapping
		const list = challenges.mintingHubV2ChallengeV2s.items as ChallengesQueryItem[];
		const mapped: ChallengesQueryItemMapping = {};
		for (const i of list) {
			const key = `${normalizeAddress(i.position)}-challenge-${i.number}`;
			mapped[key] = i;
			mapped[key].version = 2;
			mapped[key].id = key;
		}

		// upsert
		this.fetchedChallengesMapping = { ...this.fetchedChallengesMapping, ...mapped };
	}

	// --------------------------------------------------------------------------
	async updateBidV2s() {
		this.logger.debug('Updating Bids V2');
		const bids = await this.dataSource.queryWithFailover<{
			mintingHubV2ChallengeBidV2s: {
				items: BidsQueryItem[];
			};
		}>({
			query: gql`
				query {
					mintingHubV2ChallengeBidV2s(orderBy: "created", orderDirection: "desc", limit: 1000) {
						items {
							position
							number
							numberBid
							txHash
							bidder
							created
							bidType
							bid
							price
							filledSize
							acquiredCollateral
							challengeSize
						}
					}
				}
			`,
		});

		if (!bids || !bids?.mintingHubV2ChallengeBidV2s?.items?.length) {
			this.logger.warn('No Bids V2 found.');
			return;
		}

		// mapping
		const list = bids.mintingHubV2ChallengeBidV2s.items as BidsQueryItem[];
		const mapped: BidsQueryItemMapping = {};
		for (const i of list) {
			const key = `${normalizeAddress(i.position)}-challenge-${i.number}-bid-${i.numberBid}`;
			mapped[key] = i;
			mapped[key].version = 2;
			mapped[key].id = key;
		}

		// upsert
		this.fetchedBidsMapping = { ...this.fetchedBidsMapping, ...mapped };
	}
}
