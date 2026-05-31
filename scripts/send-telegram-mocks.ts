#!/usr/bin/env ts-node
/**
 * Send all Telegram message mocks to a target chat.
 *
 * Usage:
 *   yarn telegram:mocks
 *   TELEGRAM_TEST_CHAT_ID=<id> yarn telegram:mocks
 *   ts-node -r tsconfig-paths/register scripts/send-telegram-mocks.ts [chatId]
 */

import * as dotenv from 'dotenv';
dotenv.config();

import TelegramBot from 'node-telegram-bot-api';
import { WelcomeGroupMessage } from '../src/integrations/telegram/messages/WelcomeGroup.message';
import { HelpMessage } from '../src/integrations/telegram/messages/Help.message';
import { StartUpMessage } from '../src/integrations/telegram/messages/StartUp.message';
import { MinterProposalMessage } from '../src/integrations/telegram/messages/MinterProposal.message';
import { MinterProposalVetoedMessage } from '../src/integrations/telegram/messages/MinterProposalVetoed.message';
import { LeadrateProposalMessage } from '../src/integrations/telegram/messages/LeadrateProposal.message';
import { LeadrateChangedMessage } from '../src/integrations/telegram/messages/LeadrateChanged.message';
import { PositionProposalMessage } from '../src/integrations/telegram/messages/PositionProposal.message';
import { PositionDeniedMessage } from '../src/integrations/telegram/messages/PositionDenied.message';
import { PositionExpiringSoonMessage } from '../src/integrations/telegram/messages/PositionExpiringSoon.message';
import { PositionExpiredMessage } from '../src/integrations/telegram/messages/PositionExpired.message';
import { PositionPriceLowest, PositionPriceAlert, PositionPriceWarning } from '../src/integrations/telegram/messages/PositionPrice.message';
import { ChallengeStartedMessage } from '../src/integrations/telegram/messages/ChallengeStarted.message';
import { BidTakenMessage } from '../src/integrations/telegram/messages/BidTaken.message';
import { MintingUpdateMessage } from '../src/integrations/telegram/messages/MintingUpdate.message';
import { EquityInvestedMessage } from '../src/integrations/telegram/messages/EquityInvested.message';
import { EquityRedeemedMessage } from '../src/integrations/telegram/messages/EquityRedeemed.message';
import { WeeklyInfosMessage } from '../src/integrations/telegram/messages/WeeklyInfos.message';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.argv[2] || process.env.TELEGRAM_TEST_CHAT_ID;

if (!BOT_TOKEN) {
	console.error('❌  TELEGRAM_BOT_TOKEN is not set');
	process.exit(1);
}
if (!CHAT_ID) {
	console.error('❌  Provide a chat ID: TELEGRAM_TEST_CHAT_ID=<id> yarn telegram:mocks  or pass as first argument');
	process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN);

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------
const now = Math.floor(Date.now() / 1000);
const ADDR_POS = '0xabc123def456abc123def456abc123def456abc1' as any;
const ADDR_OWNER = '0xbbb222ccc333ddd444eee555fff666aaa777bbb2' as any;
const ADDR_COL = '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599' as any;
const ADDR_MINTER = '0xdead000beef000dead000beef000dead000beef00' as any;
const ADDR_SUGGEST = '0xcafe111babe222cafe111babe222cafe111babe22' as any;
const ADDR_VETOR = '0x1111222233334444555566667777888899990000' as any;
const ADDR_CHALLENGER = '0xf00dface000deadbeef0000f00dface000deadbe0' as any;
const ADDR_BIDDER = '0x9999888877776666555544443333222211110000' as any;
const TX_HASH = '0xaabbccddeeff00112233445566778899aabbccddeeff00112233445566778899aa';
const MODULE = '0x1234567890abcdef1234567890abcdef12345678' as any;

const mockPosition: any = {
	version: 2,
	position: ADDR_POS,
	owner: ADDR_OWNER,
	zchf: '0x0000000000000000000000000000000000000000' as any,
	collateral: ADDR_COL,
	price: (45000n * 10n ** 36n / 10n ** 8n).toString(), // 45000 ZCHF per 1e-8 BTC unit → 36-8=28 decimals
	created: now - 86400 * 30,
	isOriginal: true,
	isClone: false,
	denied: false,
	denyDate: 0,
	closed: false,
	original: ADDR_POS,
	parent: ADDR_POS,
	minimumCollateral: (1n * 10n ** 7n).toString(),         // 0.1 WBTC (8 decimals)
	annualInterestPPM: 50000,                                // 5%
	riskPremiumPPM: 20000,
	reserveContribution: 100000,                             // 10%
	start: now - 86400 * 10,
	cooldown: now - 86400 * 5,
	expiration: now + 86400,                                 // expires in 1 day
	challengePeriod: 86400,                                  // 24h
	zchfName: 'Frankencoin',
	zchfSymbol: 'ZCHF',
	zchfDecimals: 18,
	collateralName: 'Wrapped BTC',
	collateralSymbol: 'WBTC',
	collateralDecimals: 8,
	collateralBalance: (15n * 10n ** 7n).toString(),        // 1.5 WBTC
	limitForPosition: (100000n * 10n ** 18n).toString(),
	limitForClones: (100000n * 10n ** 18n).toString(),
	availableForPosition: (50000n * 10n ** 18n).toString(),
	availableForClones: (50000n * 10n ** 18n).toString(),
	availableForMinting: (50000n * 10n ** 18n).toString(),
	minted: (50000n * 10n ** 18n).toString(),
};

const mockMinter: any = {
	chainId: 1,
	txHash: TX_HASH,
	minter: ADDR_MINTER,
	applicationPeriod: 7 * 24 * 3600,
	applicationFee: 1000e18,
	applyMessage: 'New collateral type for the Frankencoin ecosystem',
	applyDate: now - 3600,
	suggestor: ADDR_SUGGEST,
	denyMessage: 'Does not meet requirements',
	denyDate: now - 1800,
	denyTxHash: TX_HASH,
	vetor: ADDR_VETOR,
};

const mockLeadrateRate: any = {
	chainId: 1,
	created: now - 3600,
	count: 5,
	blockheight: 19_000_000,
	module: MODULE,
	approvedRate: 30000, // 3%
	txHash: TX_HASH,
};

const mockLeadrateProposal: any = {
	chainId: 1,
	created: now - 3600,
	count: 6,
	blockheight: 19_000_001,
	module: MODULE,
	txHash: TX_HASH,
	proposer: ADDR_SUGGEST,
	nextRate: 40000, // 4%
	nextChange: now + 7 * 24 * 3600,
};

const mockChallenge: any = {
	version: 2,
	id: `${ADDR_POS}-challenge-1` as any,
	position: ADDR_POS,
	number: 1n,
	txHash: TX_HASH as any,
	challenger: ADDR_CHALLENGER,
	start: BigInt(now - 3600),
	created: BigInt(now - 3600),
	duration: BigInt(86400),
	size: (10n * 10n ** 7n),  // 1.0 WBTC
	liqPrice: (45000n * 10n ** 28n), // 45000 ZCHF per WBTC (36-8=28 decimals)
	bids: 0n,
	filledSize: 0n,
	acquiredCollateral: 0n,
	status: 'Active' as any,
};

const mockBid: any = {
	version: 2,
	id: `${ADDR_POS}-bid-1` as any,
	position: ADDR_POS,
	number: 1n,
	numberBid: 0n,
	txHash: TX_HASH as any,
	bidder: ADDR_BIDDER,
	created: BigInt(now - 1800),
	bidType: 'Averted',
	bid: 54000n * 10n ** 18n,
	price: 45000n * 10n ** 28n,
	filledSize: 12n * 10n ** 7n,  // 1.2 WBTC
	acquiredCollateral: 12n * 10n ** 7n,
	challengeSize: 15n * 10n ** 7n, // 1.5 WBTC
};

const mockMinting: any = {
	version: 1,
	id: `${ADDR_POS}-1` as any,
	count: 1,
	txHash: TX_HASH,
	created: now - 3600,
	position: ADDR_POS,
	owner: ADDR_OWNER,
	isClone: false,
	collateral: ADDR_COL,
	collateralName: 'Wrapped BTC',
	collateralSymbol: 'WBTC',
	collateralDecimals: 8,
	size: (15n * 10n ** 7n).toString(),
	price: (45000n * 10n ** 28n).toString(),
	minted: (50000n * 10n ** 18n).toString(),
	sizeAdjusted: (5n * 10n ** 7n).toString(),
	priceAdjusted: (45000n * 10n ** 28n).toString(),
	mintedAdjusted: (10000n * 10n ** 18n).toString(), // +10000 ZCHF minted
	annualInterestPPM: 50000,
	reserveContribution: 100000,
	feeTimeframe: 30 * 86400,
	feePPM: 4110,
	feePaid: (50n * 10n ** 18n).toString(),
};

const mockPrices: any = {
	[ADDR_COL.toLowerCase()]: {
		chainId: 1,
		address: ADDR_COL,
		name: 'Wrapped BTC',
		symbol: 'WBTC',
		decimals: 8,
		source: 'coingecko',
		timestamp: now,
		price: { usd: 48600, chf: 43200 }, // ~96% collateralized at 45000 liq price
	},
};

const mockPricesUndercol: any = {
	[ADDR_COL.toLowerCase()]: {
		...mockPrices[ADDR_COL.toLowerCase()],
		price: { usd: 43000, chf: 43900 }, // below 100%
	},
};

const mockPricesAlert: any = {
	[ADDR_COL.toLowerCase()]: {
		...mockPrices[ADDR_COL.toLowerCase()],
		price: { usd: 46500, chf: 46500 }, // ~103% → alert
	},
};

const mockPriceState: any = {
	warningPrice: 0,
	warningTimestamp: 0,
	alertPrice: 0,
	alertTimestamp: 0,
	lowestPrice: 0,
	lowestTimestamp: 0,
};

const mockEquityLog: any = {
	chainId: 1,
	count: 1,
	timestamp: String(now - 600),
	kind: 'Equity:Invested',
	amount: 15000n * 10n ** 18n,
	txHash: TX_HASH,
	totalInflow: 0n,
	totalOutflow: 0n,
	totalTradeFee: 0n,
	totalSupply: 1_200_000n * 10n ** 18n,
	totalEquity: 24_000_000n * 10n ** 18n,
	totalSavings: 300_000n * 10n ** 18n,
	fpsTotalSupply: 20000n * 10n ** 18n,
	fpsPrice: 1200n * 10n ** 18n,
	totalMintedV1: 0n,
	totalMintedV2: 0n,
	currentMintLeadRate: 0n,
	currentSaveLeadRate: 0n,
	projectedInterests: 0n,
	annualV1Interests: 0n,
	annualV2Interests: 0n,
	annualV1BorrowRate: 0n,
	annualV2BorrowRate: 0n,
	annualNetEarnings: 0n,
	realizedNetEarnings: 0n,
	earningsPerFPS: 0n,
};

const mockDailyBefore: any = {
	date: new Date(Date.now() - 30 * 86400 * 1000).toISOString().split('T')[0],
	timestamp: String(now - 30 * 86400),
	txHash: TX_HASH,
	totalInflow: 0n,
	totalOutflow: 0n,
	totalTradeFee: 0n,
	totalSupply: 1_100_000n * 10n ** 18n,
	totalEquity: 22_000_000n * 10n ** 18n,
	totalSavings: 250_000n * 10n ** 18n,
	fpsTotalSupply: 19000n * 10n ** 18n,
	fpsPrice: 1140n * 10n ** 18n,
	totalMintedV1: 0n,
	totalMintedV2: 0n,
	currentMintLeadRate: 0n,
	currentSaveLeadRate: 0n,
	projectedInterests: 0n,
	annualV1Interests: 0n,
	annualV2Interests: 0n,
	annualV1BorrowRate: 0n,
	annualV2BorrowRate: 0n,
	annualNetEarnings: 0n,
	realizedNetEarnings: 0n,
	earningsPerFPS: 0n,
};

const mockDailyNow: any = {
	...mockDailyBefore,
	date: new Date().toISOString().split('T')[0],
	timestamp: String(now),
	totalSupply: 1_200_000n * 10n ** 18n,
	totalEquity: 24_000_000n * 10n ** 18n,
	totalSavings: 300_000n * 10n ** 18n,
	fpsPrice: 1200n * 10n ** 18n,
};

// Supply keys are seconds; we need entries clearly before each 'date' string in the daily logs
// Use keys that are a few days older than the daily log dates so the filter finds them
const keyBefore = now - 35 * 86400; // 35 days ago
const keyAfter = now - 1 * 86400;   // yesterday
const mockSupply: any = {
	[keyBefore]: { supply: 1_100_000, created: keyBefore, allocation: {} },
	[keyAfter]: { supply: 1_200_000, created: keyAfter, allocation: {} },
};

// ---------------------------------------------------------------------------
// Messages to send
// ---------------------------------------------------------------------------
const handles = ['/MintingUpdates', '/PriceAlerts', '/WeeklyInfos', '/help'];
const chatSubs = { MintingUpdates: true, PriceAlerts: false, WeeklyInfos: true };

const messages: Array<{ label: string; text: string }> = [
	{ label: 'WelcomeGroup', text: WelcomeGroupMessage(CHAT_ID, handles) },
	{ label: 'Help', text: HelpMessage(handles, chatSubs) },
	{ label: 'StartUp', text: StartUpMessage(handles) },
	{ label: 'MinterProposal', text: MinterProposalMessage(mockMinter) },
	{ label: 'MinterProposalVetoed', text: MinterProposalVetoedMessage(mockMinter) },
	{ label: 'LeadrateProposal', text: LeadrateProposalMessage(mockLeadrateProposal, [mockLeadrateRate]) },
	{ label: 'LeadrateChanged', text: LeadrateChangedMessage(mockLeadrateRate) },
	{ label: 'PositionProposal', text: PositionProposalMessage({ ...mockPosition, start: now + 86400 }) },
	{ label: 'PositionDenied', text: PositionDeniedMessage({ ...mockPosition, denied: true, denyDate: now - 3600 }) },
	{ label: 'PositionExpiringSoon', text: PositionExpiringSoonMessage(mockPosition) },
	{ label: 'PositionExpired (v1)', text: PositionExpiredMessage({ ...mockPosition, version: 1, expiration: now - 3600 }) },
	{ label: 'PositionExpired (v2)', text: PositionExpiredMessage({ ...mockPosition, expiration: now - 3600 }) },
	{ label: 'PriceWarning', text: PositionPriceWarning(mockPosition, mockPrices[ADDR_COL.toLowerCase()], mockPriceState) },
	{ label: 'PriceAlert', text: PositionPriceAlert(mockPosition, mockPricesAlert[ADDR_COL.toLowerCase()], mockPriceState) },
	{ label: 'PriceLowest', text: PositionPriceLowest(mockPosition, mockPricesUndercol[ADDR_COL.toLowerCase()], mockPriceState) },
	{ label: 'ChallengeStarted', text: ChallengeStartedMessage(mockPosition, mockChallenge) },
	{ label: 'BidTaken', text: BidTakenMessage(mockPosition, mockChallenge, mockBid) },
	{ label: 'MintingUpdate', text: MintingUpdateMessage(mockMinting, mockPrices) },
	{ label: 'EquityInvested', text: EquityInvestedMessage(mockEquityLog) },
	{ label: 'EquityRedeemed', text: EquityRedeemedMessage({ ...mockEquityLog, kind: 'Equity:Redeemed' }) },
	{ label: 'WeeklyInfos', text: WeeklyInfosMessage(mockDailyBefore, mockDailyNow, mockSupply) },
];

// ---------------------------------------------------------------------------
// Send
// ---------------------------------------------------------------------------
async function send(label: string, text: string) {
	try {
		await bot.sendMessage(CHAT_ID, text, { parse_mode: 'Markdown', disable_web_page_preview: true });
		console.log(`✅  ${label}`);
	} catch (err) {
		console.error(`❌  ${label}: ${err.message}`);
		console.error('    Message preview:', text.slice(0, 120).replace(/\n/g, ' '));
	}
}

async function main() {
	console.log(`\n📤  Sending ${messages.length} mock messages to chat ${CHAT_ID}\n`);

	// Section header
	await send('— header —', `🧪 *Telegram Mock Preview*\n\n${messages.length} message types — one per section below.`);

	for (const { label, text } of messages) {
		await new Promise((r) => setTimeout(r, 400)); // avoid hitting rate limit
		await send(label, text);
	}

	console.log('\n✅  Done\n');
	process.exit(0);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
