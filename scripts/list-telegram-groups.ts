#!/usr/bin/env ts-node
/**
 * List all registered Telegram groups and their subscriptions.
 *
 * Usage:
 *   ts-node -r tsconfig-paths/register scripts/list-telegram-groups.ts
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const HANDLES = ['/MintingUpdates', '/PriceAlerts', '/WeeklyInfos'];

async function main() {
	const groups = await prisma.telegramGroup.findMany();

	if (groups.length === 0) {
		console.log('No groups found.');
		return;
	}

	console.log(`\n${'─'.repeat(60)}`);
	console.log(`  ${groups.length} registered Telegram group(s)`);
	console.log(`${'─'.repeat(60)}\n`);

	for (const group of groups) {
		const subs = (group.subscriptions as Record<string, boolean>) ?? {};
		const active = HANDLES.filter((h) => subs[h.replace('/', '')]);
		const inactive = HANDLES.filter((h) => !subs[h.replace('/', '')]);

		console.log(`Chat ID : ${group.chatId}`);
		console.log(`  ✅ subscribed  : ${active.length ? active.join(', ') : '—'}`);
		console.log(`  ⬜ unsubscribed: ${inactive.length ? inactive.join(', ') : '—'}`);
		console.log(`  raw            : ${JSON.stringify(subs)}`);
		console.log();
	}
}

main()
	.catch(console.error)
	.finally(() => prisma.$disconnect());
