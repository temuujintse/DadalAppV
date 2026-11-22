-- CreateEnum
CREATE TYPE "AIFeature" AS ENUM ('COACH_RECOMMEND', 'COACH_CHAT', 'PLANNER', 'PET', 'ANALYTICS');

-- CreateEnum
CREATE TYPE "AIUsageStatus" AS ENUM ('SUCCESS', 'ERROR');

-- CreateEnum
CREATE TYPE "AIRecommendationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AIMessageRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateTable
CREATE TABLE "AIUserPreference" (
    "userId" UUID NOT NULL,
    "aiEnabled" BOOLEAN NOT NULL DEFAULT true,
    "goals" VARCHAR(500),
    "availableMinutesPerDay" INTEGER,
    "preferredDifficulty" "HabitDifficulty",
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AIUserPreference_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "AIConversation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "feature" "AIFeature" NOT NULL DEFAULT 'COACH_CHAT',
    "title" VARCHAR(80) NOT NULL,
    "lastMessageAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIMessage" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conversationId" UUID NOT NULL,
    "role" "AIMessageRole" NOT NULL,
    "content" VARCHAR(4000) NOT NULL,
    "structured" JSONB,
    "clientKey" VARCHAR(80),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIRecommendation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "requestKey" VARCHAR(80) NOT NULL,
    "position" INTEGER NOT NULL,
    "status" "AIRecommendationStatus" NOT NULL DEFAULT 'PENDING',
    "goal" VARCHAR(500) NOT NULL,
    "payload" JSONB NOT NULL,
    "createdHabitId" UUID,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "decidedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIRecommendationFeedback" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "recommendationId" UUID NOT NULL,
    "reason" VARCHAR(300),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIRecommendationFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIUsageLog" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "provider" VARCHAR(30) NOT NULL,
    "model" VARCHAR(80) NOT NULL,
    "feature" "AIFeature" NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCost" DOUBLE PRECISION,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "status" "AIUsageStatus" NOT NULL,
    "errorCode" VARCHAR(40),
    "requestId" VARCHAR(120),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIUsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AIConversation_userId_lastMessageAt_idx" ON "AIConversation"("userId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "AIMessage_conversationId_createdAt_idx" ON "AIMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AIMessage_conversationId_clientKey_key" ON "AIMessage"("conversationId", "clientKey");

-- CreateIndex
CREATE INDEX "AIRecommendation_userId_status_createdAt_idx" ON "AIRecommendation"("userId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AIRecommendation_userId_requestKey_position_key" ON "AIRecommendation"("userId", "requestKey", "position");

-- CreateIndex
CREATE UNIQUE INDEX "AIRecommendationFeedback_recommendationId_key" ON "AIRecommendationFeedback"("recommendationId");

-- CreateIndex
CREATE INDEX "AIUsageLog_userId_createdAt_idx" ON "AIUsageLog"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "AIUserPreference" ADD CONSTRAINT "AIUserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIConversation" ADD CONSTRAINT "AIConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIMessage" ADD CONSTRAINT "AIMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AIConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIRecommendation" ADD CONSTRAINT "AIRecommendation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIRecommendation" ADD CONSTRAINT "AIRecommendation_createdHabitId_fkey" FOREIGN KEY ("createdHabitId") REFERENCES "Habit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIRecommendationFeedback" ADD CONSTRAINT "AIRecommendationFeedback_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "AIRecommendation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIUsageLog" ADD CONSTRAINT "AIUsageLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
