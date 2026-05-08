import { Injectable, Logger } from '@nestjs/common';
import { gql } from '@apollo/client/core';
import { DataSourceManagerService } from 'core/data-source/data-source.manager.service';
import { TransferReferenceObjectArray, TransferReferenceQuery } from './transfer.reference.types';
import { Address } from 'viem';
import { normalizeAddress } from 'utils/format';

@Injectable()
export class TransferReferenceService {
	private readonly logger = new Logger(this.constructor.name);
	private fetchedReferences: TransferReferenceObjectArray = {};

	constructor(private readonly dataSource: DataSourceManagerService) {}

	getList() {
		const m = Object.values(this.fetchedReferences);
		return {
			num: m.length,
			list: m.reverse(),
		};
	}

	async getByCount(count: string): Promise<TransferReferenceQuery | undefined> {
		try {
			const cachedItem = this.fetchedReferences[count];
			if (cachedItem != undefined) return cachedItem;

			const data = await this.dataSource.queryWithFailover<{
				transferReferences: { items: TransferReferenceQuery[] };
			}>({
				query: gql`
				query {
					transferReferences(where: {count: "${count}" }, limit: 1) {
						items {
							amount
							chainId
							count
							created
							from
							reference
							sender
							targetChain
							to
							txHash
						}
					}
				}
			`,
			});

			if (!data || !data.transferReferences.items) {
				return undefined;
			} else {
				const item = data.transferReferences.items.at(0);
				this.fetchedReferences[count] = item;
				return item;
			}
		} catch (error) {
			this.logger.warn(`getByCount failed: ${error instanceof Error ? error.message : String(error)}`);
			return undefined;
		}
	}

	async getByFromFilter(Props: {
		from: Address;
		to?: Address | undefined;
		reference?: string | undefined;
		start?: string | number;
		end?: string | number;
	}) {
		try {
			const { from, to, reference, start, end } = Props;
			const startTimestamp = new Date(start ?? 0).getTime() / 1000;
			const endTimestamp = end ? new Date(end).getTime() / 1000 : Date.now() / 1000;

			let filtered = Object.values(this.fetchedReferences).filter((i) => normalizeAddress(i.from) == normalizeAddress(from));
			if (to != undefined) filtered = filtered.filter((i) => normalizeAddress(i.to) == normalizeAddress(to));
			if (reference != undefined) filtered = filtered.filter((i) => i.reference == reference);

			return filtered.filter((i) => i.created >= Math.round(startTimestamp) && i.created < Math.round(endTimestamp));
		} catch (error) {
			this.logger.warn(`getByFromFilter failed: ${error instanceof Error ? error.message : String(error)}`);
			return { error };
		}
	}

	async getByToFilter(Props: {
		to: Address;
		from?: Address | undefined;
		reference?: string | undefined;
		start?: string | number;
		end?: string | number;
	}) {
		try {
			const { from, to, reference, start, end } = Props;
			const startTimestamp = new Date(start ?? 0).getTime() / 1000;
			const endTimestamp = end ? new Date(end).getTime() / 1000 : Date.now() / 1000;

			let filtered = Object.values(this.fetchedReferences).filter((i) => normalizeAddress(i.to) == normalizeAddress(to));
			if (from != undefined) filtered = filtered.filter((i) => normalizeAddress(i.from) == normalizeAddress(from));
			if (reference != undefined) filtered = filtered.filter((i) => i.reference == reference);

			return filtered.filter((i) => i.created >= Math.round(startTimestamp) && i.created < Math.round(endTimestamp));
		} catch (error) {
			this.logger.warn(`getByToFilter failed: ${error instanceof Error ? error.message : String(error)}`);
			return { error };
		}
	}

	async getHistoryByFromFilter(Props: {
		from: Address;
		to?: Address | undefined;
		reference?: string | undefined;
		start?: string | number;
		end?: string | number;
	}) {
		// fetch from indexer
		try {
			const { from, to, reference, start, end } = Props;
			const startTimestamp = new Date(start ?? 0).getTime() / 1000;
			const endTimestamp = end ? new Date(end).getTime() / 1000 : Date.now() / 1000;

			const data = await this.dataSource.queryWithFailover<{
				transferReferences: { items: TransferReferenceQuery[] };
			}>({
				query: gql`
				query {
					transferReferences(
						where: {
							from: "${normalizeAddress(from)}",
							${to != undefined ? `to: "${normalizeAddress(to)}",` : ''}
							${reference != undefined ? `reference: "${reference}",` : ''}
							created_gte: "${Math.round(startTimestamp)}",
							created_lt: "${Math.round(endTimestamp)}",
						},
						orderBy: "count",
						limit: 100) {
							items {
								amount
								chainId
								count
								created
								from
								reference
								sender
								targetChain
								to
								txHash
							}
						}
					}`,
			});
			if (!data) return [];
			return data.transferReferences?.items ?? [];
		} catch (error) {
			this.logger.warn(`getHistoryByFromFilter failed: ${error instanceof Error ? error.message : String(error)}`);
			return { error };
		}
	}

	async getHistoryByToFilter(Props: {
		to: Address;
		from?: Address | undefined;
		reference?: string | undefined;
		start?: string | number;
		end?: string | number;
	}) {
		// fetch from indexer
		try {
			const { from, to, reference, start, end } = Props;
			const startTimestamp = new Date(start ?? 0).getTime() / 1000;
			const endTimestamp = end ? new Date(end).getTime() / 1000 : Date.now() / 1000;

			const data = await this.dataSource.queryWithFailover<{
				transferReferences: { items: TransferReferenceQuery[] };
			}>({
				query: gql`
				query {
					transferReferences(
						where: {
							to: "${normalizeAddress(to)}",
							${from != undefined ? `from: "${normalizeAddress(from)}",` : ''}
							${reference != undefined ? `reference: "${reference}",` : ''}
							created_gte: "${Math.round(startTimestamp)}",
							created_lt: "${Math.round(endTimestamp)}",
						},
						orderBy: "count",
						limit: 100) {
							items {
								amount
								chainId
								count
								created
								from
								reference
								sender
								targetChain
								to
								txHash
							}
						}
					}`,
			});
			if (!data) return [];
			return data?.transferReferences?.items ?? [];
		} catch (error) {
			this.logger.warn(`getHistoryByToFilter failed: ${error instanceof Error ? error.message : String(error)}`);
			return { error };
		}
	}

	async updateReferences() {
		this.logger.debug('Updating transfer references...');
		const data = await this.dataSource.queryWithFailover<{
			transferReferences: { items: TransferReferenceQuery[] };
		}>({
			query: gql`
				query {
					transferReferences(orderBy: "count", limit: 1000) {
						items {
							amount
							chainId
							count
							created
							from
							reference
							sender
							targetChain
							to
							txHash
						}
					}
				}
			`,
		});

		if (!data || !data.transferReferences.items) {
			this.logger.warn('No transfer references found.');
			return;
		}

		const list: TransferReferenceObjectArray = {};
		for (const i of data.transferReferences.items) {
			list[i.count] = i;
		}

		const a = Object.keys(list).length;
		const b = Object.keys(this.fetchedReferences).length;
		const isDiff = a !== b;

		if (isDiff) this.logger.log(`Transfer reference. merging, from ${b} to ${a} entries`);
		this.fetchedReferences = { ...this.fetchedReferences, ...list };

		return list;
	}
}
