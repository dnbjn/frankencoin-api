#!/usr/bin/env ts-node
/**
 * Migrates Telegram subscription keys from DailyInfos -> WeeklyInfos.
 *
 * Usage:
 *   ts-node -r tsconfig-paths/register scripts/migrate-daily-to-weekly-subs.ts
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
	const groups = await prisma.telegramGroup.findMany();

	let migrated = 0;

	for (const group of groups) {
		const subs = (group.subscriptions as Record<string, boolean>) ?? {};

		if (!('DailyInfos' in subs)) continue;

		const updated = { ...subs, WeeklyInfos: subs['DailyInfos'] };
		delete updated['DailyInfos'];

		await prisma.telegramGroup.update({
			where: { chatId: group.chatId },
			data: { subscriptions: updated },
		});

		console.log(`${group.chatId}: DailyInfos=${subs['DailyInfos']} → WeeklyInfos=${updated['WeeklyInfos']}`);
		migrated++;
	}

	if (migrated === 0) {
		console.log('No groups had DailyInfos subscription — nothing to migrate.');
	} else {
		console.log(`\nMigrated ${migrated} group(s).`);
	}
}

main()
	.catch(console.error)
	.finally(() => prisma.$disconnect());
