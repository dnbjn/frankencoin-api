import { Address } from 'viem';
import { ChainId, SupportedChain, ChainIdMain } from '@frankencoin/zchf';

type AnalyticsExposureItem = {
    collateral: {
        address: Address;
        chainId: number;
        name: string;
        symbol: string;
    };
    positions: {
        open: number;
        originals: number;
        clones: number;
    };
    mint: {
        totalMinted: number;
        totalContribution: number;
        totalLimit: number;
        totalMintedRatio: number;
        interestAverage: number;
        totalTheta: number;
        thetaPerFpsToken: number;
    };
    reserveRiskWiped: {
        fpsPrice: number;
        riskRatio: number;
    };
};
type AnalyticsProfitLossLog = {
    chainId: number;
    minter: Address;
    created: number;
    count: number;
    kind: string;
    amount: bigint;
    profits: bigint;
    losses: bigint;
    perFPS: bigint;
};
type AnalyticsTransactionLog = {
    chainId: number;
    count: number;
    timestamp: string;
    kind: string;
    amount: bigint;
    txHash: string;
    totalInflow: bigint;
    totalOutflow: bigint;
    totalTradeFee: bigint;
    totalSupply: bigint;
    totalEquity: bigint;
    totalSavings: bigint;
    fpsTotalSupply: bigint;
    fpsPrice: bigint;
    totalMintedV1: bigint;
    totalMintedV2: bigint;
    currentMintLeadRate: bigint;
    currentSaveLeadRate: bigint;
    projectedInterests: bigint;
    annualV1Interests: bigint;
    annualV2Interests: bigint;
    annualV1BorrowRate: bigint;
    annualV2BorrowRate: bigint;
    annualNetEarnings: bigint;
    realizedNetEarnings: bigint;
    earningsPerFPS: bigint;
};
type AnalyticsDailyLog = {
    date: string;
    timestamp: string;
    txHash: string;
    totalInflow: bigint;
    totalOutflow: bigint;
    totalTradeFee: bigint;
    totalSupply: bigint;
    totalEquity: bigint;
    totalSavings: bigint;
    fpsTotalSupply: bigint;
    fpsPrice: bigint;
    totalMintedV1: bigint;
    totalMintedV2: bigint;
    currentMintLeadRate: bigint;
    currentSaveLeadRate: bigint;
    projectedInterests: bigint;
    annualV1Interests: bigint;
    annualV2Interests: bigint;
    annualV1BorrowRate: bigint;
    annualV2BorrowRate: bigint;
    annualNetEarnings: bigint;
    realizedNetEarnings: bigint;
    earningsPerFPS: bigint;
};
type ApiAnalyticsProfitLossLog = {
    num: number;
    logs: AnalyticsProfitLossLog[];
};
type ApiAnalyticsCollateralExposure = {
    general: {
        balanceInReserve: number;
        mintersContribution: number;
        equityInReserve: number;
        fpsPrice: number;
        fpsTotalSupply: number;
        thetaFromPositions: number;
        thetaPerToken: number;
        earningsPerAnnum: number;
        earningsPerToken: number;
        priceToEarnings: number;
        priceToBookValue: number;
    };
    exposures: AnalyticsExposureItem[];
};
type ApiAnalyticsFpsEarnings = {
    investFees: number;
    redeemFees: number;
    minterProposalFees: number;
    positionProposalFees: number;
    otherProfitClaims: number;
    otherContributions: number;
    savingsInterestCosts: number;
    otherLossClaims: number;
};
type ApiTransactionLog = {
    num: number;
    logs: AnalyticsTransactionLog[];
    pageInfo: {
        startCursor: string;
        endCursor: string;
        hasNextPage: boolean;
    };
};
type ApiDailyLog = {
    num: number;
    logs: AnalyticsDailyLog[];
};

type ChallengesQueryItem = {
    version: number;
    id: ChallengesId;
    position: Address;
    number: bigint;
    txHash: Address;
    challenger: Address;
    start: bigint;
    created: bigint;
    duration: bigint;
    size: bigint;
    liqPrice: bigint;
    bids: bigint;
    filledSize: bigint;
    acquiredCollateral: bigint;
    status: ChallengesStatus;
};
type BidsQueryItem = {
    version: number;
    id: BidsId;
    position: Address;
    number: bigint;
    numberBid: bigint;
    txHash: Address;
    bidder: Address;
    created: bigint;
    bidType: BidsType;
    bid: bigint;
    price: bigint;
    filledSize: bigint;
    acquiredCollateral: bigint;
    challengeSize: bigint;
};
declare enum ChallengesQueryStatus {
    Active = "Active",
    Success = "Success"
}
type ChallengesStatus = ChallengesQueryStatus;
type ChallengesId = `${Address}-challenge-${bigint}`;
type ChallengesQueryItemMapping = {
    [key: ChallengesId]: ChallengesQueryItem;
};
type ChallengesChallengersMapping = {
    [key: Address]: ChallengesQueryItem[];
};
type ChallengesPositionsMapping = {
    [key: Address]: ChallengesQueryItem[];
};
type ChallengesPricesMapping = {
    [key: ChallengesId]: string;
};
declare enum BidsQueryType {
    Averted = "Averted",
    Succeeded = "Succeeded"
}
type BidsType = BidsQueryType;
type BidsId = `${Address}-challenge-${bigint}-bid-${bigint}`;
type BidsQueryItemMapping = {
    [key: BidsId]: BidsQueryItem;
};
type BidsBidderMapping = {
    [key: Address]: BidsQueryItem[];
};
type BidsChallengesMapping = {
    [key: Address]: BidsQueryItem[];
};
type BidsPositionsMapping = {
    [key: Address]: BidsQueryItem[];
};
type ApiChallengesListing = {
    num: number;
    list: ChallengesQueryItem[];
};
type ApiChallengesMapping = {
    num: number;
    challenges: ChallengesId[];
    map: ChallengesQueryItemMapping;
};
type ApiChallengesChallengers = {
    num: number;
    challengers: Address[];
    map: ChallengesChallengersMapping;
};
type ApiChallengesPositions = {
    num: number;
    positions: Address[];
    map: ChallengesPositionsMapping;
};
type ApiBidsListing = {
    num: number;
    list: BidsQueryItem[];
};
type ApiBidsMapping = {
    num: number;
    bidIds: BidsId[];
    map: BidsQueryItemMapping;
};
type ApiBidsBidders = {
    num: number;
    bidders: Address[];
    map: BidsBidderMapping;
};
type ApiBidsChallenges = {
    num: number;
    challenges: Address[];
    map: BidsChallengesMapping;
};
type ApiBidsPositions = {
    num: number;
    positions: Address[];
    map: BidsPositionsMapping;
};
type ApiChallengesPrices = {
    num: number;
    ids: ChallengesId[];
    map: ChallengesPricesMapping;
};

type MinterQuery = {
    chainId: ChainId;
    txHash: string;
    minter: Address;
    applicationPeriod: number;
    applicationFee: number;
    applyMessage: string;
    applyDate: number;
    suggestor: Address;
    denyMessage: string | null;
    denyDate: number | null;
    denyTxHash: string | null;
    vetor: Address | null;
};
type MinterQueryObjectArray = {
    [key: Address]: MinterQuery;
};
type ApiMinterListing = {
    num: number;
    list: MinterQuery[];
};
type ApiMinterMapping = {
    num: number;
    addresses: Address[];
    map: MinterQueryObjectArray;
};

type ERC20InfoObjectArray = {
    [key: Address]: ERC20Info;
};
type ERC20Info = {
    chainId: ChainId;
    address: Address;
    name: string;
    symbol: string;
    decimals: number;
};
type PriceSource = 'custom' | 'defillama' | 'coingecko' | 'thegraph' | null;
type PriceQueryCurrencies = {
    usd?: number;
    chf?: number;
    eur?: number;
};
type PriceQuery = ERC20Info & {
    source?: PriceSource;
    timestamp: number;
    price: PriceQueryCurrencies;
};
type PriceQueryObjectArray = {
    [key: Address]: PriceQuery;
};
type PriceMarketChartObject = {
    prices: [timestamp: number, value: number][];
    market_caps: [timestamp: number, value: number][];
    total_volumes: [timestamp: number, value: number][];
};
type PriceHistoryQuery = ERC20Info & {
    timestamp: number;
    price: PriceQueryCurrencies;
    history: {
        [key: number]: number;
    };
};
type PriceHistoryQueryObjectArray = {
    [k in PriceHistoryQuery['address']]: PriceHistoryQuery;
};
type PriceHistoryRatio = {
    timestamp: number;
    collateralRatioBySupply: {
        [key: number]: number;
    };
    collateralRatioByFreeFloat: {
        [key: number]: number;
    };
};
type ApiPriceListing = PriceQuery[];
type ApiPriceMapping = PriceQueryObjectArray;
type ApiPriceERC20 = ERC20Info;
type ApiPriceERC20Mapping = ERC20InfoObjectArray;
type ApiOwnerValueLocked = {
    [key: number]: string;
};
type ApiPriceMarketChart = PriceMarketChartObject;

type EcosystemQuery = {
    id: string;
    value: string;
    amount: bigint;
};
type EcosystemERC20StatusQuery = {
    chainId: ChainId;
    updated: number;
    supply: bigint;
    burn: bigint;
    mint: bigint;
    balance: bigint;
    token: Address;
};
type EcosystemERC20TotalSupply = {
    chainId: ChainId;
    created: number;
    token: Address;
    supply: bigint;
};
type EcosystemFrankencoinKeyValues = {
    [key: EcosystemQuery['id']]: EcosystemQuery;
};
type EcosystemFrankencoin = {
    chainId: ChainId;
    updated: number;
    address: Address;
    supply: number;
    counter: {
        balance: number;
        mint: number;
        burn: number;
    };
};
type EcosystemFrankencoinMapping = {
    [K in ChainId]: EcosystemFrankencoin;
};
type EcosystemFrankencoinSupplyListing = {
    [K in SupportedChain['id']]: EcosystemERC20TotalSupply[];
};
type FrankencoinSupplyQuery = {
    supply: number;
    created: number;
    allocation: {
        [K in SupportedChain['id']]?: number;
    };
};
type FrankencoinSupplyQueryObject = {
    [K in FrankencoinSupplyQuery['created']]: FrankencoinSupplyQuery;
};
type ApiEcosystemFrankencoinKeyValues = EcosystemFrankencoinKeyValues;
type ApiEcosystemFrankencoinInfo = {
    erc20: {
        name: string;
        symbol: string;
        decimals: number;
    };
    chains: EcosystemFrankencoinMapping;
    token: {
        usd: number;
        supply: number;
    };
    fps: {
        price: number;
        totalSupply: number;
        marketCap: number;
    };
    tvl: PriceQueryCurrencies;
};
type ApiEcosystemFrankencoinSupply = FrankencoinSupplyQueryObject;

type PositionQueryV1 = {
    version: 1;
    position: Address;
    owner: Address;
    zchf: Address;
    collateral: Address;
    price: string;
    created: number;
    isOriginal: boolean;
    isClone: boolean;
    denied: boolean;
    denyDate: number;
    closed: boolean;
    original: Address;
    minimumCollateral: string;
    annualInterestPPM: number;
    reserveContribution: number;
    start: number;
    cooldown: number;
    expiration: number;
    challengePeriod: number;
    zchfName: string;
    zchfSymbol: string;
    zchfDecimals: number;
    collateralName: string;
    collateralSymbol: string;
    collateralDecimals: number;
    collateralBalance: string;
    limitForPosition: string;
    limitForClones: string;
    availableForPosition: string;
    availableForClones: string;
    minted: string;
};
type PositionQueryV2 = {
    version: 2;
    position: Address;
    owner: Address;
    zchf: Address;
    collateral: Address;
    price: string;
    created: number;
    isOriginal: boolean;
    isClone: boolean;
    denied: boolean;
    denyDate: number;
    closed: boolean;
    original: Address;
    parent: Address;
    minimumCollateral: string;
    annualInterestPPM: number;
    riskPremiumPPM: number;
    reserveContribution: number;
    start: number;
    cooldown: number;
    expiration: number;
    challengePeriod: number;
    zchfName: string;
    zchfSymbol: string;
    zchfDecimals: number;
    collateralName: string;
    collateralSymbol: string;
    collateralDecimals: number;
    collateralBalance: string;
    limitForPosition: string;
    limitForClones: string;
    availableForClones: string;
    availableForMinting: string;
    availableForPosition: string;
    minted: string;
};
type PositionQuery = PositionQueryV1 | PositionQueryV2;
type OwnerTransferQuery = {
    version: number;
    count: number;
    txHash: string;
    created: number;
    position: Address;
    previousOwner: Address;
    newOwner: Address;
};
type MintingUpdateQueryId = `${Address}-${number}`;
type MintingUpdateQueryV1 = {
    version: 1;
    id: MintingUpdateQueryId;
    count: number;
    txHash: string;
    created: number;
    position: Address;
    owner: Address;
    isClone: boolean;
    collateral: Address;
    collateralName: string;
    collateralSymbol: string;
    collateralDecimals: number;
    size: string;
    price: string;
    minted: string;
    sizeAdjusted: string;
    priceAdjusted: string;
    mintedAdjusted: string;
    annualInterestPPM: number;
    reserveContribution: number;
    feeTimeframe: number;
    feePPM: number;
    feePaid: string;
};
type MintingUpdateQueryV2 = {
    version: 2;
    id: MintingUpdateQueryId;
    count: number;
    txHash: string;
    created: number;
    position: Address;
    owner: Address;
    isClone: boolean;
    collateral: Address;
    collateralName: string;
    collateralSymbol: string;
    collateralDecimals: number;
    size: string;
    price: string;
    minted: string;
    sizeAdjusted: string;
    priceAdjusted: string;
    mintedAdjusted: string;
    annualInterestPPM: number;
    basePremiumPPM: number;
    riskPremiumPPM: number;
    reserveContribution: number;
    feeTimeframe: number;
    feePPM: number;
    feePaid: string;
};
type MintingUpdateQuery = MintingUpdateQueryV1 | MintingUpdateQueryV2;
type PositionsQueryObjectArray = {
    [key: Address]: PositionQuery;
};
type OwnersPositionsObjectArray = {
    [key: Address]: PositionQuery[];
};
type MintingUpdateQueryObjectArray = {
    [key: Address]: MintingUpdateQuery[];
};
type ApiPositionsListing = {
    num: number;
    list: PositionQuery[];
};
type ApiPositionsMapping = {
    num: number;
    addresses: Address[];
    map: PositionsQueryObjectArray;
};
type ApiPositionsOwners = {
    num: number;
    owners: Address[];
    map: OwnersPositionsObjectArray;
};
type ApiMintingUpdateListing = {
    num: number;
    list: MintingUpdateQuery[];
};
type ApiMintingUpdateMapping = {
    num: number;
    positions: Address[];
    map: MintingUpdateQueryObjectArray;
};
type ApiOwnerFees = {
    t: number;
    f: string;
}[];
type ApiOwnerDebt = {
    [key: number]: string;
};
type ApiOwnerHistory = {
    [key: number]: `0x${string}`[];
};
type ApiOwnerTransfersListing = {
    num: number;
    list: OwnerTransferQuery[];
};

type EcosystemCollateralPositionsItem = ERC20Info & {
    num: number;
    addresses: Address[];
};
type EcosystemCollateralPositionsDetailsItem = ERC20Info & {
    num: number;
    addresses: Address[];
    positions: PositionQuery[];
};
type ApiEcosystemCollateralStatsItem = ERC20Info & {
    positions: {
        total: number;
        open: number;
        requested: number;
        closed: number;
        denied: number;
        originals: number;
        clones: number;
    };
    price: PriceQueryCurrencies;
    totalMinted: number;
    totalLimit: number;
    totalBalanceRaw: string;
    totalValueLocked: PriceQueryCurrencies;
};
type ApiEcosystemCollateralListArray = {
    num: number;
    list: ERC20Info[];
};
type ApiEcosystemCollateralList = {
    num: number;
    addresses: Address[];
    map: ERC20InfoObjectArray;
};
type ApiEcosystemCollateralPositions = {
    [key: Address]: EcosystemCollateralPositionsItem;
};
type ApiEcosystemCollateralPositionsDetails = {
    [key: Address]: EcosystemCollateralPositionsDetailsItem;
};
type ApiEcosystemCollateralStats = {
    num: number;
    addresses: Address[];
    totalValueLocked: PriceQueryCurrencies;
    map: {
        [key: Address]: ApiEcosystemCollateralStatsItem;
    };
};

type ApiEcosystemFpsInfo = {
    erc20: {
        name: string;
        symbol: string;
        decimals: number;
    };
    chains: {
        [K in ChainIdMain]: {
            chainId: ChainId;
            address: Address;
        };
    };
    token: {
        price: number;
        totalSupply: number;
        marketCap: number;
    };
    earnings: {
        profit: number;
        loss: number;
    };
    reserve: {
        balance: number;
        equity: number;
        minter: number;
    };
};

type LeadrateRateQuery = {
    chainId: ChainId;
    created: number;
    count: number;
    blockheight: number;
    module: Address;
    approvedRate: number;
    txHash: string;
};
type LeadrateProposedQuery = {
    chainId: ChainId;
    created: number;
    count: number;
    blockheight: number;
    module: Address;
    txHash: string;
    proposer: Address;
    nextRate: number;
    nextChange: number;
};
type LeadrateRateMapping = {
    [K in ChainId]: {
        [key: LeadrateRateQuery['module']]: LeadrateRateQuery[];
    };
};
type LeadrateProposedMapping = {
    [K in ChainId]: {
        [L in LeadrateProposedQuery['module']]: LeadrateProposedQuery[];
    };
};
type LeadrateProposedOpen = {
    details: LeadrateProposedQuery;
    currentRate: number;
    nextRate: number;
    nextChange: number;
    isProposal: boolean;
    isPending: boolean;
    isSynced: boolean;
};
type ApiLeadrateInfo = {
    rate: ApiLeadrateRate['rate'];
    proposed: ApiLeadrateProposed['proposed'];
    open: {
        [K in ChainId]: {
            [L in LeadrateProposedQuery['module']]: LeadrateProposedOpen;
        };
    };
};
type ApiLeadrateRate = {
    rate: {
        [K in ChainId]: {
            [L in LeadrateRateQuery['module']]: LeadrateRateQuery;
        };
    };
    list: LeadrateRateMapping;
};
type ApiLeadrateProposed = {
    proposed: {
        [K in ChainId]: {
            [L in LeadrateProposedQuery['module']]: LeadrateProposedQuery;
        };
    };
    list: LeadrateProposedMapping;
};

type SavingsStatusQuery = {
    chainId: ChainId;
    updated: number;
    module: Address;
    balance: string;
    interest: string;
    save: string;
    withdraw: string;
    rate: number;
    counterInterest: number;
    counterRateChanged: number;
    counterRateProposed: number;
    counterSave: number;
    counterWithdraw: number;
};
type SavingsBalanceQuery = {
    chainId: ChainId;
    account: Address;
    module: Address;
    balance: string;
    created: number;
    updated: number;
    interest: string;
    save: string;
    withdraw: string;
    counterInterest: number;
    counterSave: number;
    counterWithdraw: number;
};
type SavingsActivityQuery = {
    chainId: ChainId;
    account: Address;
    module: Address;
    created: number;
    blockheight: number;
    count: number;
    balance: string;
    save: string;
    interest: string;
    withdraw: string;
    kind: string;
    amount: string;
    rate: number;
    txHash: string;
};
type SavingsStatus = {
    chainId: ChainId;
    updated: number;
    module: Address;
    balance: string;
    interest: string;
    save: string;
    withdraw: string;
    rate: number;
    counter: {
        interest: number;
        rateChanged: number;
        rateProposed: number;
        save: number;
        withdraw: number;
    };
};
type SavingsStatusMapping = {
    [K in ChainId]: {
        [key: SavingsStatus['module']]: SavingsStatus;
    };
};
type SavingsBalance = {
    chainId: ChainId;
    account: Address;
    module: Address;
    balance: string;
    created: number;
    updated: number;
    interest: string;
    save: string;
    withdraw: string;
    counter: {
        save: number;
        interest: number;
        withdraw: number;
    };
};
type SavingsBalanceChainIdMapping = {
    [K in ChainId]: {
        [key in SavingsBalance['module'] | SavingsBalanceQuery['module']]: SavingsBalance;
    };
};
type SavingsBalanceAccountMapping = {
    [key in SavingsBalance['account'] | SavingsBalanceQuery['account']]: SavingsBalanceChainIdMapping;
};
type ApiSavingsInfo = {
    status: SavingsStatusMapping;
    totalBalance: number;
    ratioOfSupply: number;
    totalInterest: number;
};
type ApiSavingsBalance = SavingsBalanceChainIdMapping;
type ApiSavingsRanked = SavingsBalance[];
type ApiSavingsActivity = SavingsActivityQuery[];

type SavingsReferrerMappingQuery = {
    chainId: ChainId;
    module: Address;
    account: Address;
    created: number;
    updated: number;
    balance: number;
    referrer: Address;
    referrerFee: number;
};
type SavingsReferrerEarningsQuery = {
    chainId: ChainId;
    module: Address;
    account: Address;
    created: number;
    updated: number;
    referrer: Address;
    earnings: string;
};
type SavingsReferrerAccountItem = {
    created: number;
    updated: number;
    balance: number;
    referrer: Address;
    referrerFee: number;
};
type SavingsReferrerMapping = {
    [K in ChainId]: {
        [key: SavingsReferrerEarningsQuery['module']]: {
            [key: SavingsReferrerEarningsQuery['account']]: SavingsReferrerAccountItem;
        };
    };
};
type SavingsReferrerEarnings = {
    [K in ChainId]: {
        [key: SavingsReferrerEarningsQuery['module']]: {
            [key: SavingsReferrerEarningsQuery['account']]: number;
        };
    };
};
type ApiSavingsReferrerMapping = {
    num: number;
    accounts: Address[];
    map: SavingsReferrerMapping;
};
type ApiSavingsReferrerEarnings = {
    earnings: SavingsReferrerEarnings;
    chains: {
        [K in ChainId]: number;
    };
    total: number;
};

type TelegramState = {
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
type PositionPriceAlertState = {
    warningPrice: number;
    warningTimestamp: number;
    alertPrice: number;
    alertTimestamp: number;
    lowestPrice: number;
    lowestTimestamp: number;
};
type TelegramGroupState = {
    apiVersion: string;
    createdAt: number;
    updatedAt: number;
    groups: string[];
    subscription: {
        [chatId: string]: {
            [handle: string]: boolean;
        };
    };
};

type TransferReferenceQuery = {
    amount: bigint;
    chainId: number;
    count: number;
    created: number;
    from: Address;
    reference: string;
    sender: Address;
    targetChain: string;
    to: Address;
    txHash: string;
};
type TransferReferenceObjectArray = {
    [key: number]: TransferReferenceQuery;
};
type ApiTransferReferenceList = {
    num: number;
    list: TransferReferenceQuery[];
};
type ApiTransferReferenceQuery = TransferReferenceQuery[] | {
    error: string;
};

export { type AnalyticsDailyLog, type AnalyticsExposureItem, type AnalyticsProfitLossLog, type AnalyticsTransactionLog, type ApiAnalyticsCollateralExposure, type ApiAnalyticsFpsEarnings, type ApiAnalyticsProfitLossLog, type ApiBidsBidders, type ApiBidsChallenges, type ApiBidsListing, type ApiBidsMapping, type ApiBidsPositions, type ApiChallengesChallengers, type ApiChallengesListing, type ApiChallengesMapping, type ApiChallengesPositions, type ApiChallengesPrices, type ApiDailyLog, type ApiEcosystemCollateralList, type ApiEcosystemCollateralListArray, type ApiEcosystemCollateralPositions, type ApiEcosystemCollateralPositionsDetails, type ApiEcosystemCollateralStats, type ApiEcosystemCollateralStatsItem, type ApiEcosystemFpsInfo, type ApiEcosystemFrankencoinInfo, type ApiEcosystemFrankencoinKeyValues, type ApiEcosystemFrankencoinSupply, type ApiLeadrateInfo, type ApiLeadrateProposed, type ApiLeadrateRate, type ApiMinterListing, type ApiMinterMapping, type ApiMintingUpdateListing, type ApiMintingUpdateMapping, type ApiOwnerDebt, type ApiOwnerFees, type ApiOwnerHistory, type ApiOwnerTransfersListing, type ApiOwnerValueLocked, type ApiPositionsListing, type ApiPositionsMapping, type ApiPositionsOwners, type ApiPriceERC20, type ApiPriceERC20Mapping, type ApiPriceListing, type ApiPriceMapping, type ApiPriceMarketChart, type ApiSavingsActivity, type ApiSavingsBalance, type ApiSavingsInfo, type ApiSavingsRanked, type ApiSavingsReferrerEarnings, type ApiSavingsReferrerMapping, type ApiTransactionLog, type ApiTransferReferenceList, type ApiTransferReferenceQuery, type BidsBidderMapping, type BidsChallengesMapping, type BidsId, type BidsPositionsMapping, type BidsQueryItem, type BidsQueryItemMapping, BidsQueryType, type BidsType, type ChallengesChallengersMapping, type ChallengesId, type ChallengesPositionsMapping, type ChallengesPricesMapping, type ChallengesQueryItem, type ChallengesQueryItemMapping, ChallengesQueryStatus, type ChallengesStatus, type ERC20Info, type ERC20InfoObjectArray, type EcosystemCollateralPositionsDetailsItem, type EcosystemCollateralPositionsItem, type EcosystemERC20StatusQuery, type EcosystemERC20TotalSupply, type EcosystemFrankencoin, type EcosystemFrankencoinKeyValues, type EcosystemFrankencoinMapping, type EcosystemFrankencoinSupplyListing, type EcosystemQuery, type FrankencoinSupplyQuery, type FrankencoinSupplyQueryObject, type LeadrateProposedMapping, type LeadrateProposedOpen, type LeadrateProposedQuery, type LeadrateRateMapping, type LeadrateRateQuery, type MinterQuery, type MinterQueryObjectArray, type MintingUpdateQuery, type MintingUpdateQueryId, type MintingUpdateQueryObjectArray, type MintingUpdateQueryV1, type MintingUpdateQueryV2, type OwnerTransferQuery, type OwnersPositionsObjectArray, type PositionPriceAlertState, type PositionQuery, type PositionQueryV1, type PositionQueryV2, type PositionsQueryObjectArray, type PriceHistoryQuery, type PriceHistoryQueryObjectArray, type PriceHistoryRatio, type PriceMarketChartObject, type PriceQuery, type PriceQueryCurrencies, type PriceQueryObjectArray, type PriceSource, type SavingsActivityQuery, type SavingsBalance, type SavingsBalanceAccountMapping, type SavingsBalanceChainIdMapping, type SavingsBalanceQuery, type SavingsReferrerAccountItem, type SavingsReferrerEarnings, type SavingsReferrerEarningsQuery, type SavingsReferrerMapping, type SavingsReferrerMappingQuery, type SavingsStatus, type SavingsStatusMapping, type SavingsStatusQuery, type TelegramGroupState, type TelegramState, type TransferReferenceObjectArray, type TransferReferenceQuery };
