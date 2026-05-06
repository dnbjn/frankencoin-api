-- CreateTable
CREATE TABLE "telegram_groups" (
    "chatId" TEXT NOT NULL,
    "subscriptions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_groups_pkey" PRIMARY KEY ("chatId")
);

-- CreateTable
CREATE TABLE "price_cache" (
    "address" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_cache_pkey" PRIMARY KEY ("address")
);

-- CreateTable
CREATE TABLE "price_history" (
    "timestamp" BIGINT NOT NULL,
    "prices" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_history_pkey" PRIMARY KEY ("timestamp")
);

-- CreateTable
CREATE TABLE "price_history_ratio" (
    "timestamp" BIGINT NOT NULL,
    "collateralRatioByFreeFloat" DOUBLE PRECISION NOT NULL,
    "collateralRatioBySupply" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_history_ratio_pkey" PRIMARY KEY ("timestamp")
);

-- CreateTable
CREATE TABLE "ecosystem_supply" (
    "timestamp" BIGINT NOT NULL,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ecosystem_supply_pkey" PRIMARY KEY ("timestamp")
);
