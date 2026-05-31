import { Address } from 'viem';

// @dev: timestamps of last trigger emits
export type TelegramState = {
	minterApplied: number;
	minterVetoed: number;
	leadrateProposal: number;
	leadrateChanged: number;
	positions: number;
	positionsDenied: number;
	positionsExpiringSoon1: number;
	positionsExpired: number;
	positionsPriceAlert: Map<Address, PositionPriceAlertState>;
	mintingUpdates: number;
	challenges: number;
	bids: number;
	equityInvested: number;
	equityRedeemed: number;
	ccipProposalNew: number;
	ccipProposalDenied: number;
	ccipProposalEnacted: number;
	ccipRateLimit: number;
};

export type PositionPriceAlertState = {
	warningPrice: number; // e.g. below 110%
	warningTimestamp: number;
	alertPrice: number; // e.g. below 105%
	alertTimestamp: number;
	lowestPrice: number;
	lowestTimestamp: number;
};

export type TelegramGroupState = {
	apiVersion: string;
	createdAt: number;
	updatedAt: number;
	groups: string[];
	subscription: {
		[chatId: string]: { [handle: string]: boolean };
	};
};
