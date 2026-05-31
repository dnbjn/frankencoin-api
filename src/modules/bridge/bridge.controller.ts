import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BridgeService } from './bridge.service';

@ApiTags('Bridge Controller')
@Controller('bridge')
export class BridgeController {
	constructor(private readonly bridge: BridgeService) {}

	@Get('proposals')
	@ApiOperation({
		summary: 'Get all CCIP Admin proposals',
		description:
			'Returns: list of CCIPAdminProposal, all governance proposals submitted to any CCIPAdmin contract across all indexed chains. ' +
			'Each proposal goes through a 7-day veto window before it can be enacted. ' +
			'Proposals can be filtered by status (Pending, Denied, Enacted) and type (AddChain, RemoveChain, RemotePoolUpdate, AdminTransfer). ' +
			'The details field contains a JSON-encoded struct with proposal-specific data (e.g. remoteChainSelector for AddChain).',
	})
	@ApiQuery({ name: 'status', required: false, description: 'Filter by proposal status: Pending | Denied | Enacted' })
	@ApiQuery({ name: 'type', required: false, description: 'Filter by proposal type: AddChain | RemoveChain | RemotePoolUpdate | AdminTransfer' })
	@ApiResponse({
		status: 200,
		description: 'Returns a list of CCIP Admin proposals',
		schema: {
			properties: {
				list: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							chainId: { type: 'number', description: 'Chain ID of the CCIPAdmin contract that owns this proposal' },
							hash: { type: 'string', description: 'Keccak256 hash of the encoded proposal data, used as the proposal identifier' },
							proposer: { type: 'string', nullable: true, description: 'Address of the qualified voter who submitted the proposal' },
							type: { type: 'string', nullable: true, description: 'Proposal type: AddChain | RemoveChain | RemotePoolUpdate | AdminTransfer' },
							deadline: { type: 'number', description: 'Unix timestamp after which the proposal can be enacted (7 days for most, 21 days for AdminTransfer)' },
							status: { type: 'string', description: 'Current status: Pending | Denied | Enacted' },
							details: { type: 'string', nullable: true, description: 'JSON-encoded proposal-specific data' },
							created: { type: 'number', description: 'Unix timestamp when the proposal was submitted' },
						},
					},
				},
			},
			example: {
				list: [
					{
						chainId: 1,
						hash: '0xa1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
						proposer: '0x5a57dd9c623e1403af1d810673183d89724a4e0c',
						type: 'AddChain',
						deadline: 1765906800,
						status: 'Pending',
						details: '{"remoteChainSelector":"4051577828743386545","remoteTokenAddress":"0xd4dd9e2f021bb459d5a5f6c24c12fe09c5d45553","outboundRateLimiterConfig":{"isEnabled":true,"capacity":"1000000000000000000000","rate":"100000000000000000"},"inboundRateLimiterConfig":{"isEnabled":true,"capacity":"1000000000000000000000","rate":"100000000000000000"}}',
						created: 1765302000,
					},
				],
			},
		},
	})
	getProposals(@Query('status') status?: string, @Query('type') type?: string) {
		let list = this.bridge.getProposals().list;
		if (status) list = list.filter((p) => p.status === status);
		if (type) list = list.filter((p) => p.type === type);
		return { list };
	}

	@Get('proposals/pending')
	@ApiOperation({
		summary: 'Get pending CCIP Admin proposals',
		description:
			'Returns: list of CCIPAdminProposal with status Pending, proposals that are currently in their veto window and have not yet been denied or enacted. ' +
			'This endpoint is the primary signal for monitoring: any AddChain or RemotePoolUpdate proposal here represents a live governance action ' +
			'that can be vetoed by qualified FPS holders before the deadline.',
	})
	@ApiResponse({
		status: 200,
		description: 'Returns all pending CCIP Admin proposals across all chains',
		schema: {
			properties: {
				list: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							chainId: { type: 'number', description: 'Chain ID of the CCIPAdmin contract' },
							hash: { type: 'string', description: 'Proposal identifier hash' },
							proposer: { type: 'string', nullable: true, description: 'Address of the proposer' },
							type: { type: 'string', nullable: true, description: 'Proposal type' },
							deadline: { type: 'number', description: 'Unix timestamp of the veto deadline' },
							status: { type: 'string', description: 'Always Pending for this endpoint' },
							details: { type: 'string', nullable: true, description: 'JSON-encoded proposal-specific data' },
							created: { type: 'number', description: 'Unix timestamp when the proposal was submitted' },
						},
					},
				},
			},
			example: {
				list: [],
			},
		},
	})
	getPendingProposals() {
		return { list: this.bridge.getPendingProposals() };
	}

	@Get('chains')
	@ApiOperation({
		summary: 'Get remote chain configurations',
		description:
			'Returns: list of CCIPAdminChain, the current state of all remote chain configurations registered in each CCIPAdmin contract across all indexed chains. ' +
			'Each entry represents a remote chain that the local CCIPAdmin token pool can send to and receive from. ' +
			'Includes the current rate limiter settings (capacity and rate in wei per second) for both inbound and outbound token flows. ' +
			'Can be filtered by chainId (the local chain) or active status.',
	})
	@ApiQuery({ name: 'chainId', required: false, description: 'Filter by local chain ID (e.g. 1 for mainnet, 137 for polygon)' })
	@ApiQuery({ name: 'active', required: false, description: 'Filter by active status: true | false' })
	@ApiResponse({
		status: 200,
		description: 'Returns remote chain configurations per CCIPAdmin contract',
		schema: {
			properties: {
				list: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							chainId: { type: 'number', description: 'Local chain ID where this CCIPAdmin is deployed' },
							remoteChainSelector: { type: 'string', description: 'Chainlink CCIP chain selector of the remote chain' },
							active: { type: 'boolean', description: 'Whether this remote chain is currently active' },
							remoteTokenAddress: { type: 'string', nullable: true, description: 'ABI-encoded address of the token contract on the remote chain' },
							outboundEnabled: { type: 'boolean', description: 'Whether outbound rate limiting is enabled' },
							outboundCapacity: { type: 'string', description: 'Maximum outbound token bucket capacity in wei' },
							outboundRate: { type: 'string', description: 'Outbound token refill rate in wei per second' },
							inboundEnabled: { type: 'boolean', description: 'Whether inbound rate limiting is enabled' },
							inboundCapacity: { type: 'string', description: 'Maximum inbound token bucket capacity in wei' },
							inboundRate: { type: 'string', description: 'Inbound token refill rate in wei per second' },
						},
					},
				},
			},
			example: {
				list: [
					{
						chainId: 1,
						remoteChainSelector: '4051577828743386545',
						active: true,
						remoteTokenAddress: '0x000000000000000000000000d4dd9e2f021bb459d5a5f6c24c12fe09c5d45553',
						outboundEnabled: true,
						outboundCapacity: '1000000000000000000000',
						outboundRate: '100000000000000000',
						inboundEnabled: true,
						inboundCapacity: '1000000000000000000000',
						inboundRate: '100000000000000000',
					},
				],
			},
		},
	})
	getChains(@Query('chainId') chainId?: string, @Query('active') active?: string) {
		let list = this.bridge.getChains().list;
		if (chainId) list = list.filter((c) => c.chainId === parseInt(chainId));
		if (active !== undefined) list = list.filter((c) => c.active === (active === 'true'));
		return { list };
	}
}
