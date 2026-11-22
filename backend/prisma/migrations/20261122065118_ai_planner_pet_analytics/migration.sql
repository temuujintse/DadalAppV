-- CreateEnum
CREATE TYPE "AIPlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AIInsightPeriod" AS ENUM ('WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "AIPetSource" AS ENUM ('TEMPLATE', 'AI');

-- CreateTable
CREATE TABLE "AIPlan" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "planDate" DATE NOT NULL,
    "status" "AIPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "requestKey" VARCHAR(80) NOT NULL,
    "payload" JSONB NOT NULL,
    "confirmedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIPlanItem" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "planId" UUID NOT NULL,
    "habitId" UUID NOT NULL,
    "startTime" VARCHAR(5) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "note" VARCHAR(200),

    CONSTRAINT "AIPlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIInsight" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "periodType" "AIInsightPeriod" NOT NULL,
    "periodKey" VARCHAR(20) NOT NULL,
    "metrics" JSONB NOT NULL,
    "insight" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIPetInteraction" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "petId" UUID NOT NULL,
    "event" VARCHAR(40) NOT NULL,
    "message" VARCHAR(300) NOT NULL,
    "emotion" VARCHAR(20) NOT NULL,
    "animation" VARCHAR(20) NOT NULL,
    "suggestedAction" VARCHAR(30) NOT NULL,
    "source" "AIPetSource" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIPetInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AIPlan_userId_planDate_status_idx" ON "AIPlan"("userId", "planDate", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AIPlan_userId_requestKey_key" ON "AIPlan"("userId", "requestKey");

-- CreateIndex
CREATE INDEX "AIPlanItem_planId_order_idx" ON "AIPlanItem"("planId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "AIInsight_userId_periodType_periodKey_key" ON "AIInsight"("userId", "periodType", "periodKey");

-- CreateIndex
CREATE INDEX "AIPetInteraction_userId_event_createdAt_idx" ON "AIPetInteraction"("userId", "event", "createdAt");

-- AddForeignKey
ALTER TABLE "AIPlan" ADD CONSTRAINT "AIPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIPlanItem" ADD CONSTRAINT "AIPlanItem_planId_fkey" FOREIGN KEY ("planId") REFERENCES "AIPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIPlanItem" ADD CONSTRAINT "AIPlanItem_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "Habit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIInsight" ADD CONSTRAINT "AIInsight_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIPetInteraction" ADD CONSTRAINT "AIPetInteraction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIPetInteraction" ADD CONSTRAINT "AIPetInteraction_petId_fkey" FOREIGN KEY ("petId") REFERENCES "UserPet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
