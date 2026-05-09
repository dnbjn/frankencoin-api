import { Injectable, Logger } from '@nestjs/common';
import TelegramBot from 'node-telegram-bot-api';
import { PositionsService } from 'modules/positions/positions.service';
import { TelegramGroupState, TelegramState } from './telegram.types';
import { EcosystemMinterService } from 'modules/ecosystem/ecosystem.minter.service';
import { MinterProposalMessage } from './messages/MinterProposal.message';
import { PositionProposalMessage } from './messages/PositionProposal.message';
import { PrismaService } from 'core/database/prisma.service';
import { WelcomeGroupMessage } from './messages/WelcomeGroup.message';
import { ChallengesService } from 'modules/challenges/challenges.service';
import { ChallengeStartedMessage } from './messages/ChallengeStarted.message';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PricesService } from 'modules/prices/prices.service';
import { MintingUpdateMessage } from './messages/MintingUpdate.message';
import { HelpMessage } from './messages/Help.message';
import { MinterProposalVetoedMessage } from './messages/MinterProposalVetoed.message';
import { SavingsLeadrateService } from 'modules/savings/savings.leadrate.service';
import { LeadrateProposalMessage } from './messages/LeadrateProposal.message';
import { LeadrateChangedMessage } from './messages/LeadrateChanged.message';
import { BidTakenMessage } from './messages/BidTaken.message';
import { PositionExpiringSoonMessage } from './messages/PositionExpiringSoon.message';
import { PositionExpiredMessage } from './messages/PositionExpired.message';
import { formatUnits } from 'viem';
import { PriceQuery } from 'modules/prices/prices.types';
import { PositionPriceAlert, PositionPriceLowest, PositionPriceWarning } from './messages/PositionPrice.message';
import { AnalyticsService } from 'modules/analytics/analytics.service';
import { DailyInfosMessage } from './messages/DailyInfos.message';
import { mainnet } from 'viem/chains';
import { EcosystemFrankencoinService } from 'modules/ecosystem/ecosystem.frankencoin.service';
import { formatFloat, normalizeAddress } from 'utils/format';
import { EquityInvestedMessage } from './messages/EquityInvested.message';
import { EquityRedeemedMessage } from './messages/EquityRedeemed.message';
import { PositionDeniedMessage } from './messages/PositionDenied.message';

@Injectable()
export class TelegramService {
	private readonly startUpTime = Date.now();
	private readonly logger = new Logger(this.constructor.name);
	private enabled = !!process.env.TELEGRAM_BOT_TOKEN;
	private bot: TelegramBot | null = null;
	private telegramHandles: string[] = ['/MintingUpdates', '/PriceAlerts', '/DailyInfos', '/help'];
	private telegramState: TelegramState;
	private telegramGroupState: TelegramGroupState;

	constructor(
		private readonly prisma: PrismaService,
		private readonly frankencoin: EcosystemFrankencoinService,
		private readonly minter: EcosystemMinterService,
		private readonly leadrate: SavingsLeadrateService,
		private readonly position: PositionsService,
		private readonly prices: PricesService,
		private readonly challenge: ChallengesService,
		private readonly analytics: AnalyticsService
	) {
		if (!this.enabled) {
			this.logger.warn('TELEGRAM_BOT_TOKEN not set — Telegram integration disabled');
		} else {
			try {
				this.bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
				// Attach error handlers BEFORE polling has a chance to fail. node-telegram-bot-api
				// emits these whenever the polling loop or any internal request errors out
				// (invalid token → 401, network blips, Telegram outages). Without listeners,
				// 'polling_error' becomes an unhandled error and can crash the process.
				this.bot.on('polling_error', (err) => {
					this.logger.warn(`Telegram polling_error: ${err instanceof Error ? err.message : String(err)}`);
				});
				this.bot.on('error', (err) => {
					this.logger.warn(`Telegram bot error: ${err instanceof Error ? err.message : String(err)}`);
				});
				this.bot.on('webhook_error', (err) => {
					this.logger.warn(`Telegram webhook_error: ${err instanceof Error ? err.message : String(err)}`);
				});
			} catch (err) {
				this.logger.error(
					`Failed to initialize Telegram bot, disabling integration: ${err instanceof Error ? err.message : String(err)}`
				);
				this.bot = null;
				this.enabled = false;
			}
		}

		this.telegramState = {
			minterApplied: this.startUpTime,
			minterVetoed: this.startUpTime,
			leadrateProposal: this.startUpTime,
			leadrateChanged: this.startUpTime,
			positions: this.startUpTime,
			positionsDenied: this.startUpTime,
			positionsExpiringSoon1: this.startUpTime,
			positionsExpired: this.startUpTime,
			positionsPriceAlert: new Map(),
			mintingUpdates: this.startUpTime,
			challenges: this.startUpTime,
			bids: this.startUpTime,
			equityInvested: this.startUpTime,
			equityRedeemed: this.startUpTime,
		};

		this.telegramGroupState = {
			apiVersion: process.env.npm_package_version,
			createdAt: this.startUpTime,
			updatedAt: this.startUpTime,
			groups: [],
			subscription: {},
		};

		if (this.enabled) this.readBackupGroups();
	}

	async readBackupGroups() {
		this.logger.log('Reading backup groups from database');

		const groups = await this.prisma.safeExecute(() => this.prisma.telegramGroup.findMany());

		if (groups && groups.length > 0) {
			this.telegramGroupState.groups = groups.map((g) => g.chatId);
			this.telegramGroupState.subscription = Object.fromEntries(groups.map((g) => [g.chatId, g.subscriptions as any]));
			this.logger.log(`Telegram group state restored (${groups.length} groups)`);
		} else {
			this.logger.log('No telegram groups found, starting fresh');
		}

		await this.applyListener();
	}

	async writeBackupGroups(groups: string[] = this.telegramGroupState.groups) {
		this.telegramGroupState.apiVersion = process.env.npm_package_version;
		this.telegramGroupState.updatedAt = Date.now();

		await this.prisma.safeExecute(async () => {
			// Update or create groups
			for (const chatId of groups) {
				const subscriptions = this.telegramGroupState.subscription[chatId] || {};
				await this.prisma.telegramGroup.upsert({
					where: { chatId },
					create: {
						chatId,
						subscriptions,
					},
					update: {
						subscriptions,
					},
				});
			}

			this.logger.log('Telegram group backup stored in database');
		});
	}

	async removeBackupGroups(groups: string[]) {
		await this.prisma.safeExecute(async () => {
			// Update or create groups
			for (const chatId of groups) {
				await this.prisma.telegramGroup.delete({
					where: {
						chatId,
					},
				});
			}

			this.logger.log('Telegram group backup stored in database');
		});
	}

	async sendMessageAll(message: string) {
		if (this.telegramGroupState.groups.length == 0) return;
		for (const group of this.telegramGroupState.groups) {
			await this.sendMessage(group, message);
		}
	}

	async sendMessageGroup(groups: string[], message: string) {
		if (groups.length == 0) return;
		for (const group of groups) {
			await this.sendMessage(group, message);
		}
	}

	async sendMessage(group: string | number, message: string) {
		if (!this.enabled) return;
		try {
			this.logger.debug(`Sending message to group id: ${group}`);
			await this.bot.sendMessage(group.toString(), message, { parse_mode: 'Markdown', disable_web_page_preview: true });
		} catch (error) {
			const msg = {
				notFound: 'chat not found',
				deleted: 'the group chat was deleted',
				blocked: 'bot was blocked by the user',
			};

			if (typeof error === 'object') {
				if (error?.message.includes(msg.deleted)) {
					this.logger.warn(msg.deleted + `: ${group}`);
					this.removeTelegramGroup(group);
				} else if (error?.message.includes(msg.notFound)) {
					this.logger.warn(msg.notFound + `: ${group}`);
					this.removeTelegramGroup(group);
				} else if (error?.message.includes(msg.blocked)) {
					this.logger.warn(msg.blocked + `: ${group}`);
					this.removeTelegramGroup(group);
				} else {
					this.logger.warn(error?.message);
				}
			} else {
				this.logger.warn(error);
			}
		}
	}

	async updateTelegram() {
		if (!this.enabled) return;
		// @dev: deactivated, verify indexer status before running workflow.
		// give indexer and start up some time before starting with msg, alert, ...
		// if (Date.now() < this.startUpTime + 20 * 60 * 1000) return; // 20min
		const isSoftStart = Date.now() < this.startUpTime + 2 * 60 * 1000;

		this.logger.debug('Updating Telegram');

		// break if no groups are known
		if (this.telegramGroupState?.groups == undefined) return;
		if (this.telegramGroupState.groups.length == 0) return;

		// DEFAULT
		// Minter Proposal
		const mintersList = this.minter.getMintersList().list.filter((m) => m.applyDate * 1000 > this.telegramState.minterApplied);
		if (mintersList.length > 0) {
			this.telegramState.minterApplied = Date.now(); // do first, allows new income to handle next loop
			for (const minter of mintersList) {
				this.sendMessageAll(MinterProposalMessage(minter));
			}
		}

		// Minter Proposal Vetoed
		const mintersVetoed = this.minter
			.getMintersList()
			.list.filter((m) => m.denyDate > 0 && m.denyDate * 1000 > this.telegramState.minterVetoed);
		if (mintersVetoed.length > 0) {
			this.telegramState.minterVetoed = Date.now();
			for (const minter of mintersVetoed) {
				this.sendMessageAll(MinterProposalVetoedMessage(minter));
			}
		}

		// prepare leadrate
		const leadrateProposal = Object.values(this.leadrate.getInfo().open[mainnet.id] || {}).filter(
			(p) => p.details.created * 1000 > this.telegramState.leadrateProposal
		);
		const leadrateRates = Object.values(this.leadrate.getInfo().rate[mainnet.id] || {});
		const leadrateApplied = leadrateRates.filter((r) => r.created * 1000 > this.telegramState.leadrateChanged);

		// Leadrate Proposal
		if (leadrateProposal.length > 0) {
			this.telegramState.leadrateProposal = Date.now();
			for (const p of leadrateProposal) {
				this.sendMessageAll(LeadrateProposalMessage(p.details, leadrateRates));
			}
		}

		// Leadrate Changed
		if (leadrateApplied.length > 0) {
			this.telegramState.leadrateChanged = Date.now();
			for (const r of leadrateApplied) {
				this.sendMessageAll(LeadrateChangedMessage(r));
			}
		}

		// Positions requested
		const requestedPosition = Object.values(this.position.getPositionsRequests().map).filter(
			(r) => r.start * 1000 > Date.now() && r.created * 1000 > this.telegramState.positions
		);
		if (requestedPosition.length > 0) {
			this.telegramState.positions = Date.now();
			for (const p of requestedPosition) {
				this.sendMessageAll(PositionProposalMessage(p));
			}
		}

		// Positions denied
		const deniedPosition = Object.values(this.position.getPositionsDenied().map).filter(
			(p) => p.denyDate > 0 && p.denyDate * 1000 > this.telegramState.positionsDenied
		);
		if (deniedPosition.length > 0) {
			this.telegramState.positionsDenied = Date.now();
			for (const p of deniedPosition) {
				this.sendMessageAll(PositionDeniedMessage(p));
			}
		}

		// Positions expiring soon (24 hours)
		const openPositions = Object.values(this.position.getPositionsOpen().map);
		const expiringSoonPosition1 = openPositions.filter((p) => {
			const stateDate = new Date(this.telegramState.positionsExpiringSoon1).getTime();
			const warningDays = 1 * 24 * 60 * 60 * 1000;
			const isSoon = p.expiration * 1000 < Date.now() + warningDays;
			const isNew = isSoon && stateDate + warningDays < p.expiration * 1000;
			return isSoon && isNew;
		});
		if (expiringSoonPosition1.length > 0) {
			this.telegramState.positionsExpiringSoon1 = Date.now();
			for (const p of expiringSoonPosition1) {
				this.sendMessageAll(PositionExpiringSoonMessage(p));
			}
		}

		// Positions expired
		const expiredPosition = openPositions.filter((p) => {
			const stateDate = new Date(this.telegramState.positionsExpired).getTime();
			const isExpired = p.expiration * 1000 < Date.now();
			const isNew = isExpired && stateDate < p.expiration * 1000;
			return isExpired && isNew;
		});
		if (expiredPosition.length > 0) {
			this.telegramState.positionsExpired = Date.now();
			for (const p of expiredPosition) {
				this.sendMessageAll(PositionExpiredMessage(p));
			}
		} else {
			// @dev: fixes issue if ponder indexes and stateDate didnt change,
			// it might happen that an old state will trigger this due to re-indexing

			// reset to last 1h
			if (Date.now() - this.telegramState.positionsExpired > 60 * 60 * 1000) {
				this.telegramState.positionsExpired = Date.now() - 5 * 60 * 1000; // reduce 5min to allow latest expiration
			}
		}

		// Position Price Warning
		openPositions.forEach((p) => {
			const posPrice = parseFloat(formatUnits(BigInt(p.price), 36 - p.collateralDecimals));
			const THRES_LOWEST = 1; // 100%
			const THRES_ALERT = 1.05; // 105%
			const THRES_WARN = 1.1; // 110%
			const DELAY_LOWEST = 2 * 60 * 60 * 1000; // 2h guard
			const DELAY_ALERT = 12 * 60 * 60 * 1000; // 12h guard
			const DELAY_WARNING = 24 * 60 * 60 * 1000; // 24h guard

			// price query
			const priceQuery: PriceQuery | undefined = this.prices.getPricesMapping()[normalizeAddress(p.collateral)];
			if (priceQuery == undefined || priceQuery?.timestamp == 0) return false; // not found or still searching

			// price check
			const price = priceQuery.price.chf;
			if (posPrice * THRES_WARN < price) return false; // below threshold

			// get latest or make available
			let last = this.telegramState.positionsPriceAlert.get(normalizeAddress(p.position));
			if (last == undefined) {
				last = {
					warningPrice: 0,
					warningTimestamp: 0,
					alertPrice: 0,
					alertTimestamp: 0,
					lowestPrice: 0,
					lowestTimestamp: 0,
				};
			}

			const groups = this.getSubscribedGroups('/PriceAlerts');

			if (price < posPrice * THRES_LOWEST) {
				// below 100%
				if (last.lowestTimestamp + DELAY_LOWEST < Date.now()) {
					// delay guard passed // @dev: -2% threshold
					if (last.lowestPrice == 0 || last.lowestPrice * 0.98 > price) {
						!isSoftStart && this.sendMessageGroup(groups, PositionPriceLowest(p, priceQuery, last));
						last.lowestPrice = price;
					}
					last.lowestTimestamp = Date.now();
				}
			} else if (price < posPrice * THRES_ALERT) {
				// below 105%
				if (last.alertTimestamp + DELAY_ALERT < Date.now()) {
					// delay guard passed
					!isSoftStart && this.sendMessageGroup(groups, PositionPriceAlert(p, priceQuery, last));
					last.alertTimestamp = Date.now();
					last.alertPrice = price;
				}
			} else if (price < posPrice * THRES_WARN) {
				// if below 110 -> warning
				if (last.alertTimestamp + DELAY_WARNING < Date.now()) {
					if (last.warningTimestamp + DELAY_WARNING < Date.now()) {
						// delay guard passed
						!isSoftStart && this.sendMessageGroup(groups, PositionPriceWarning(p, priceQuery, last));
						last.warningTimestamp = Date.now();
						last.warningPrice = price;
					}
				}
			}

			// reset lowest price
			if (price > posPrice * THRES_ALERT && last.lowestTimestamp > 0) {
				last.lowestTimestamp = 0;
				last.lowestPrice = 0;
			}

			// update state
			this.telegramState.positionsPriceAlert.set(normalizeAddress(p.position), last);
		});

		// Challenges started
		const challengesStarted = Object.values(this.challenge.getChallengesMapping().map).filter(
			(c) => parseInt(c.created.toString()) * 1000 > this.telegramState.challenges
		);
		if (challengesStarted.length > 0) {
			this.telegramState.challenges = Date.now();
			for (const c of challengesStarted) {
				const pos = this.position.getPositionsList().list.find((p) => normalizeAddress(p.position) == normalizeAddress(c.position));
				if (pos == undefined) return;
				this.sendMessageAll(ChallengeStartedMessage(pos, c));
			}
		}

		// Bids taken
		const bidsTaken = Object.values(this.challenge.getBidsMapping().map).filter(
			(b) => parseInt(b.created.toString()) * 1000 > this.telegramState.bids
		);
		if (bidsTaken.length > 0) {
			this.telegramState.bids = Date.now();
			for (const b of bidsTaken) {
				const position = this.position
					.getPositionsList()
					.list.find((p) => normalizeAddress(p.position) == normalizeAddress(b.position));
				const challenge = this.challenge
					.getChallenges()
					.list.find((c) => normalizeAddress(c.position) == normalizeAddress(b.position) && c.number == b.number);
				if (position == undefined || challenge == undefined) return;
				this.sendMessageAll(BidTakenMessage(position, challenge, b));
			}
		}

		// SUPSCRIPTION
		// MintingUpdates
		const requestedMintingUpdates = this.position
			.getMintingUpdatesList()
			.list.filter((m) => m.created * 1000 > this.telegramState.mintingUpdates && BigInt(m.mintedAdjusted) > 0n);
		if (requestedMintingUpdates.length > 0) {
			this.telegramState.mintingUpdates = Date.now();
			const prices = this.prices.getPricesMapping();
			for (const m of requestedMintingUpdates) {
				const groups = this.getSubscribedGroups('/MintingUpdates');
				this.sendMessageGroup(groups, MintingUpdateMessage(m, prices));
			}
		}

		const { logs } = await this.analytics.getTransactionLog(true, 100);
		const equityMinAmount = 10000;
		const equityInvested = logs
			.filter((i) => Number(i.timestamp) * 1000 > this.telegramState.equityInvested)
			.filter((i) => i.kind == 'Equity:Invested')
			.filter((i) => formatFloat(i.amount, 18) >= equityMinAmount);
		if (equityInvested.length > 0) {
			this.telegramState.equityInvested = Date.now();
			for (const i of equityInvested) {
				this.sendMessageAll(EquityInvestedMessage(i));
			}
		}

		const equityRedeemed = logs
			.filter((i) => Number(i.timestamp) * 1000 > this.telegramState.equityRedeemed)
			.filter((i) => i.kind == 'Equity:Redeemed')
			.filter((i) => formatFloat(i.amount, 18) >= equityMinAmount);
		if (equityRedeemed.length > 0) {
			this.telegramState.equityRedeemed = Date.now();
			for (const i of equityRedeemed) {
				this.sendMessageAll(EquityRedeemedMessage(i));
			}
		}
	}

	upsertTelegramGroup(id: number | string): boolean {
		if (!id) return;
		if (this.telegramGroupState.groups.includes(id.toString())) return false;
		this.telegramGroupState.groups.push(id.toString());
		this.logger.log(`Upserted Telegram Group: ${id}`);
		this.sendMessage(id, WelcomeGroupMessage(id, this.telegramHandles));
		return true;
	}

	async removeTelegramGroup(id: number | string): Promise<boolean> {
		if (!id) return;
		const inGroup: boolean = this.telegramGroupState.groups.includes(id.toString());
		const inSubscription = !!this.telegramGroupState.subscription[id.toString()];
		const update: boolean = inGroup || inSubscription;

		if (inGroup) {
			this.telegramGroupState.groups = this.telegramGroupState.groups.filter((g) => g !== id.toString());
		}

		if (inSubscription) {
			delete this.telegramGroupState.subscription[id.toString()];
		}

		if (update) {
			this.logger.log(`Removed Telegram Group: ${id}`);
			await this.removeBackupGroups([String(id)]);
		}

		return update;
	}

	getSubscribedGroups(handle: string): string[] {
		const key = handle.replace('/', '');
		return Object.entries(this.telegramGroupState.subscription)
			.filter(([_, subs]) => subs[key])
			.map(([chatId]) => chatId);
	}

	private buildSubscriptionKeyboard(chatId: string): TelegramBot.InlineKeyboardButton[][] {
		const subs = this.telegramGroupState.subscription[chatId] || {};
		return [
			[{ text: `${subs['MintingUpdates'] ? '✅' : '⬜'} Minting Updates`, callback_data: 'sub:MintingUpdates' }],
			[{ text: `${subs['PriceAlerts'] ? '✅' : '⬜'} Price Alerts`, callback_data: 'sub:PriceAlerts' }],
			[{ text: `${subs['DailyInfos'] ? '✅' : '⬜'} Daily Infos (weekly)`, callback_data: 'sub:DailyInfos' }],
		];
	}

	private async sendSubscriptionMenu(chatId: number | string) {
		const id = chatId.toString();
		try {
			await this.bot.sendMessage(id, '📡 *Manage Subscriptions*\n\nTap to toggle an alert type on or off:', {
				parse_mode: 'Markdown',
				reply_markup: { inline_keyboard: this.buildSubscriptionKeyboard(id) },
			});
		} catch (error) {
			this.logger.warn(`Failed to send subscription menu to ${id}: ${error?.message}`);
		}
	}

	async applyListener() {
		try {
			await this.bot.setMyCommands([
				{ command: 'start', description: 'Connect this chat & show info' },
				{ command: 'help', description: 'Show status & subscriptions' },
				{ command: 'subscribe', description: 'Manage alert subscriptions' },
			]);
			this.logger.log('Bot command menu registered');
		} catch (e) {
			this.logger.warn(`Failed to set bot commands: ${e.message}`);
		}

		const toggle = (handle: string, msg: TelegramBot.Message) => {
			if (handle !== msg.text) return;
			const group = msg.chat.id.toString();
			const key = handle.replace('/', '');
			const chatSubs = this.telegramGroupState.subscription[group] || {};
			if (chatSubs[key]) {
				delete chatSubs[key];
				this.sendMessage(group, `⬜ Unsubscribed from *${handle}*`);
			} else {
				chatSubs[key] = true;
				this.sendMessage(group, `✅ Subscribed to *${handle}*`);
			}
			this.telegramGroupState.subscription[group] = chatSubs;
			this.writeBackupGroups([group]);
		};

		this.bot.on('message', async (m) => {
			if (this.upsertTelegramGroup(m.chat.id) == true) await this.writeBackupGroups([String(m.chat.id)]);

			if (m.text === '/start' || m.text === '/help') {
				await this.sendMessage(
					m.chat.id,
					HelpMessage(this.telegramHandles, this.telegramGroupState.subscription[m.chat.id.toString()] || {})
				);
			} else if (m.text === '/subscribe') {
				await this.sendSubscriptionMenu(m.chat.id);
			} else {
				this.telegramHandles.forEach((h) => toggle(h, m));
			}
		});

		this.bot.on('callback_query', async (query) => {
			if (!query.data?.startsWith('sub:')) return;
			const handle = query.data.replace('sub:', '');
			const chatId = query.message.chat.id.toString();

			const chatSubs = this.telegramGroupState.subscription[chatId] || {};
			if (chatSubs[handle]) {
				delete chatSubs[handle];
			} else {
				chatSubs[handle] = true;
			}
			this.telegramGroupState.subscription[chatId] = chatSubs;
			await this.writeBackupGroups([chatId]);

			try {
				await this.bot.editMessageReplyMarkup(
					{ inline_keyboard: this.buildSubscriptionKeyboard(chatId) },
					{ chat_id: query.message.chat.id, message_id: query.message.message_id }
				);
			} catch (_) {}

			const isOn = !!chatSubs[handle];
			await this.bot.answerCallbackQuery(query.id, {
				text: isOn ? `✅ Subscribed to ${handle}` : `⬜ Unsubscribed from ${handle}`,
			});
		});
	}

	@Cron(CronExpression.EVERY_WEEK)
	scheduleDailyInfos() {
		if (!this.enabled) return;
		const days = 1000 * 3600 * 24 * 30;
		const infos = this.analytics.getDailyLog().logs.filter((i) => Number(i.timestamp) >= Date.now() - days);
		const groups = this.getSubscribedGroups('/DailyInfos');

		const before = infos.at(0);
		const now = infos.at(-1);

		const supply = this.frankencoin.getTotalSupply();

		this.sendMessageGroup(groups, DailyInfosMessage(before, now, supply));
	}
}
