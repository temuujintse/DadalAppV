-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "FamilyRole" AS ENUM ('OWNER', 'PARENT', 'MEMBER', 'CHILD');

-- CreateEnum
CREATE TYPE "FamilyPlan" AS ENUM ('FREE', 'PREMIUM');

-- CreateEnum
CREATE TYPE "HabitType" AS ENUM ('PERSONAL', 'FAMILY');

-- CreateEnum
CREATE TYPE "HabitCompletionMode" AS ENUM ('PER_MEMBER', 'SHARED');

-- CreateEnum
CREATE TYPE "HabitDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "HabitStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CompletionSource" AS ENUM ('ONLINE', 'OFFLINE_SYNC');

-- CreateEnum
CREATE TYPE "XPWalletType" AS ENUM ('PERSONAL', 'FAMILY', 'PET');

-- CreateEnum
CREATE TYPE "XPTransactionKind" AS ENUM ('EARN', 'SPEND', 'REVERSAL', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "XPSourceType" AS ENUM ('HABIT_COMPLETION', 'COMPLETION_REVERSAL', 'QUEST', 'ACHIEVEMENT', 'PET_CARE', 'REWARD_REDEMPTION', 'ADMIN_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "PetCareType" AS ENUM ('FEED', 'PLAY', 'PET', 'BATH');

-- CreateEnum
CREATE TYPE "PetAccessorySlot" AS ENUM ('HEAD', 'FACE', 'NECK', 'BODY', 'BACKGROUND');

-- CreateEnum
CREATE TYPE "PetAccessoryRarity" AS ENUM ('COMMON', 'RARE', 'EPIC', 'LEGENDARY');

-- CreateEnum
CREATE TYPE "AccessoryUnlockType" AS ENUM ('DEFAULT', 'PET_LEVEL', 'USER_LEVEL', 'ACHIEVEMENT');

-- CreateEnum
CREATE TYPE "QuestPeriod" AS ENUM ('DAILY', 'WEEKLY');

-- CreateEnum
CREATE TYPE "QuestScope" AS ENUM ('USER', 'FAMILY');

-- CreateEnum
CREATE TYPE "QuestGoalType" AS ENUM ('COMPLETE_HABITS', 'COMPLETE_FAMILY_HABITS', 'COMPLETE_ALL_TODAY', 'PET_CARE', 'EARN_XP');

-- CreateEnum
CREATE TYPE "QuestProgressStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'CLAIMED');

-- CreateEnum
CREATE TYPE "AchievementCondition" AS ENUM ('FIRST_COMPLETION', 'STREAK_DAYS', 'ACTIVE_HABITS', 'FAMILY_QUESTS_COMPLETED', 'TOTAL_COMPLETION_DAYS', 'PET_LEVEL', 'USER_LEVEL');

-- CreateEnum
CREATE TYPE "RedemptionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REDEEMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('HABIT_REMINDER', 'DAILY_PROGRESS', 'STREAK_REMINDER', 'QUEST_COMPLETED', 'LEVEL_UP', 'ACHIEVEMENT_UNLOCKED', 'FAMILY_ACTIVITY', 'REWARD_APPROVED', 'REWARD_REQUESTED', 'PET_ACCESSORY_UNLOCKED');

-- CreateEnum
CREATE TYPE "SyncOperationType" AS ENUM ('HABIT_COMPLETION', 'COMPLETION_UNDO', 'PET_CARE');

-- CreateEnum
CREATE TYPE "SyncOperationStatus" AS ENUM ('PENDING', 'PROCESSED', 'REJECTED', 'CONFLICT', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastLoginAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "userId" UUID NOT NULL,
    "displayName" VARCHAR(50) NOT NULL,
    "avatarKey" VARCHAR(40) NOT NULL DEFAULT 'fox',
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'Asia/Ulaanbaatar',
    "locale" VARCHAR(10) NOT NULL DEFAULT 'mn',
    "notificationSettings" JSONB NOT NULL DEFAULT '{}',
    "onboardingCompletedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "refreshTokenHash" VARCHAR(128) NOT NULL,
    "userAgent" VARCHAR(255),
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "lastUsedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMPTZ(3),
    "revokeReason" VARCHAR(40),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Family" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(60) NOT NULL,
    "avatarKey" VARCHAR(40) NOT NULL DEFAULT 'home',
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'Asia/Ulaanbaatar',
    "plan" "FamilyPlan" NOT NULL DEFAULT 'FREE',
    "memberLimit" INTEGER,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Family_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyMember" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "familyId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "FamilyRole" NOT NULL DEFAULT 'MEMBER',
    "invitedById" UUID,
    "joinedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "FamilyMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyInvite" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "familyId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "tokenHash" VARCHAR(128) NOT NULL,
    "role" "FamilyRole" NOT NULL DEFAULT 'MEMBER',
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamilyInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Habit" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "creatorId" UUID NOT NULL,
    "familyId" UUID,
    "title" VARCHAR(80) NOT NULL,
    "description" VARCHAR(500),
    "icon" VARCHAR(40) NOT NULL DEFAULT 'sparkles',
    "color" VARCHAR(9) NOT NULL DEFAULT '#F97316',
    "type" "HabitType" NOT NULL,
    "completionMode" "HabitCompletionMode",
    "difficulty" "HabitDifficulty" NOT NULL DEFAULT 'EASY',
    "status" "HabitStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'Asia/Ulaanbaatar',
    "reminderTime" VARCHAR(5),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Habit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HabitAssignment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "habitId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "assignedById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HabitAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HabitScheduleDay" (
    "habitId" UUID NOT NULL,
    "weekday" SMALLINT NOT NULL,

    CONSTRAINT "HabitScheduleDay_pkey" PRIMARY KEY ("habitId","weekday")
);

-- CreateTable
CREATE TABLE "HabitCompletion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "habitId" UUID NOT NULL,
    "familyId" UUID,
    "userId" UUID,
    "completedById" UUID NOT NULL,
    "localDate" DATE NOT NULL,
    "completionKey" VARCHAR(120) NOT NULL,
    "idempotencyKey" VARCHAR(64) NOT NULL,
    "note" VARCHAR(280),
    "source" "CompletionSource" NOT NULL DEFAULT 'ONLINE',
    "clientCreatedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HabitCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HabitStreak" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "habitId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastCompletedDate" DATE,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "HabitStreak_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyHabitStreak" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "habitId" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastCompletedDate" DATE,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "FamilyHabitStreak_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserGamification" (
    "userId" UUID NOT NULL,
    "lifetimeXP" INTEGER NOT NULL DEFAULT 0,
    "balanceXP" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "totalCompletions" INTEGER NOT NULL DEFAULT 0,
    "completionDays" INTEGER NOT NULL DEFAULT 0,
    "lastCompletionDate" DATE,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "UserGamification_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "FamilyGamification" (
    "familyId" UUID NOT NULL,
    "lifetimeXP" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "questsCompleted" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "FamilyGamification_pkey" PRIMARY KEY ("familyId")
);

-- CreateTable
CREATE TABLE "XPTransaction" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "walletType" "XPWalletType" NOT NULL,
    "kind" "XPTransactionKind" NOT NULL,
    "userId" UUID,
    "familyId" UUID,
    "petId" UUID,
    "amount" INTEGER NOT NULL,
    "sourceType" "XPSourceType" NOT NULL,
    "sourceId" UUID,
    "idempotencyKey" VARCHAR(160) NOT NULL,
    "actorId" UUID,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XPTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" VARCHAR(60) NOT NULL,
    "title" VARCHAR(80) NOT NULL,
    "description" VARCHAR(280) NOT NULL,
    "icon" VARCHAR(40) NOT NULL,
    "condition" "AchievementCondition" NOT NULL,
    "threshold" INTEGER NOT NULL DEFAULT 1,
    "xpReward" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAchievement" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "achievementId" UUID NOT NULL,
    "unlockedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt" TIMESTAMPTZ(3),

    CONSTRAINT "UserAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPet" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "name" VARCHAR(30) NOT NULL DEFAULT 'Бамбаа',
    "species" VARCHAR(30) NOT NULL DEFAULT 'FOX',
    "level" INTEGER NOT NULL DEFAULT 1,
    "lifetimeXP" INTEGER NOT NULL DEFAULT 0,
    "happiness" INTEGER NOT NULL DEFAULT 80,
    "lastCaredAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "UserPet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PetCareAction" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "petId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "PetCareType" NOT NULL,
    "localDate" DATE NOT NULL,
    "xpAwarded" INTEGER NOT NULL,
    "happinessDelta" INTEGER NOT NULL,
    "idempotencyKey" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PetCareAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PetAccessory" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" VARCHAR(60) NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "slot" "PetAccessorySlot" NOT NULL,
    "rarity" "PetAccessoryRarity" NOT NULL DEFAULT 'COMMON',
    "unlockType" "AccessoryUnlockType" NOT NULL,
    "unlockValue" INTEGER,
    "achievementId" UUID,
    "assetKey" VARCHAR(60) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PetAccessory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPetAccessory" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "petId" UUID NOT NULL,
    "accessoryId" UUID NOT NULL,
    "equippedSlot" "PetAccessorySlot",
    "unlockedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "equippedAt" TIMESTAMPTZ(3),

    CONSTRAINT "UserPetAccessory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quest" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" VARCHAR(60),
    "familyId" UUID,
    "createdById" UUID,
    "title" VARCHAR(80) NOT NULL,
    "description" VARCHAR(280) NOT NULL,
    "icon" VARCHAR(40) NOT NULL DEFAULT 'target',
    "period" "QuestPeriod" NOT NULL,
    "scope" "QuestScope" NOT NULL,
    "goalType" "QuestGoalType" NOT NULL,
    "goalTarget" INTEGER NOT NULL,
    "xpReward" INTEGER NOT NULL,
    "familyXpReward" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Quest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestProgress" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "questId" UUID NOT NULL,
    "userId" UUID,
    "familyId" UUID,
    "periodKey" VARCHAR(12) NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "target" INTEGER NOT NULL,
    "status" "QuestProgressStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "completedAt" TIMESTAMPTZ(3),
    "claimedAt" TIMESTAMPTZ(3),
    "claimedById" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "QuestProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reward" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "familyId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "title" VARCHAR(80) NOT NULL,
    "description" VARCHAR(280),
    "icon" VARCHAR(40) NOT NULL DEFAULT 'gift',
    "xpCost" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Reward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardRedemption" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "rewardId" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "xpCost" INTEGER NOT NULL,
    "status" "RedemptionStatus" NOT NULL DEFAULT 'PENDING',
    "note" VARCHAR(280),
    "decisionNote" VARCHAR(280),
    "decidedById" UUID,
    "decidedAt" TIMESTAMPTZ(3),
    "redeemedAt" TIMESTAMPTZ(3),
    "idempotencyKey" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RewardRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "body" VARCHAR(400) NOT NULL,
    "data" JSONB,
    "readAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncOperation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "operationId" UUID NOT NULL,
    "type" "SyncOperationType" NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "SyncOperationStatus" NOT NULL DEFAULT 'PENDING',
    "result" JSONB,
    "errorCode" VARCHAR(60),
    "clientCreatedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMPTZ(3),

    CONSTRAINT "SyncOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actorId" UUID,
    "familyId" UUID,
    "action" VARCHAR(60) NOT NULL,
    "entityType" VARCHAR(40) NOT NULL,
    "entityId" UUID,
    "metadata" JSONB,
    "ip" VARCHAR(64),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "AuthSession_userId_revokedAt_idx" ON "AuthSession"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");

-- CreateIndex
CREATE INDEX "Family_deletedAt_idx" ON "Family"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyMember_userId_key" ON "FamilyMember"("userId");

-- CreateIndex
CREATE INDEX "FamilyMember_familyId_role_idx" ON "FamilyMember"("familyId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyMember_familyId_userId_key" ON "FamilyMember"("familyId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyInvite_tokenHash_key" ON "FamilyInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "FamilyInvite_familyId_revokedAt_expiresAt_idx" ON "FamilyInvite"("familyId", "revokedAt", "expiresAt");

-- CreateIndex
CREATE INDEX "Habit_familyId_status_idx" ON "Habit"("familyId", "status");

-- CreateIndex
CREATE INDEX "Habit_creatorId_status_idx" ON "Habit"("creatorId", "status");

-- CreateIndex
CREATE INDEX "HabitAssignment_userId_idx" ON "HabitAssignment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "HabitAssignment_habitId_userId_key" ON "HabitAssignment"("habitId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "HabitCompletion_completionKey_key" ON "HabitCompletion"("completionKey");

-- CreateIndex
CREATE INDEX "HabitCompletion_habitId_localDate_idx" ON "HabitCompletion"("habitId", "localDate");

-- CreateIndex
CREATE INDEX "HabitCompletion_userId_localDate_idx" ON "HabitCompletion"("userId", "localDate");

-- CreateIndex
CREATE INDEX "HabitCompletion_familyId_localDate_idx" ON "HabitCompletion"("familyId", "localDate");

-- CreateIndex
CREATE UNIQUE INDEX "HabitCompletion_completedById_idempotencyKey_key" ON "HabitCompletion"("completedById", "idempotencyKey");

-- CreateIndex
CREATE INDEX "HabitStreak_userId_idx" ON "HabitStreak"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "HabitStreak_habitId_userId_key" ON "HabitStreak"("habitId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyHabitStreak_habitId_key" ON "FamilyHabitStreak"("habitId");

-- CreateIndex
CREATE INDEX "FamilyHabitStreak_familyId_idx" ON "FamilyHabitStreak"("familyId");

-- CreateIndex
CREATE UNIQUE INDEX "XPTransaction_idempotencyKey_key" ON "XPTransaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "XPTransaction_userId_createdAt_idx" ON "XPTransaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "XPTransaction_familyId_createdAt_idx" ON "XPTransaction"("familyId", "createdAt");

-- CreateIndex
CREATE INDEX "XPTransaction_petId_createdAt_idx" ON "XPTransaction"("petId", "createdAt");

-- CreateIndex
CREATE INDEX "XPTransaction_sourceType_sourceId_idx" ON "XPTransaction"("sourceType", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "Achievement_key_key" ON "Achievement"("key");

-- CreateIndex
CREATE UNIQUE INDEX "UserAchievement_userId_achievementId_key" ON "UserAchievement"("userId", "achievementId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPet_userId_key" ON "UserPet"("userId");

-- CreateIndex
CREATE INDEX "PetCareAction_petId_type_createdAt_idx" ON "PetCareAction"("petId", "type", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PetCareAction_userId_idempotencyKey_key" ON "PetCareAction"("userId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "PetAccessory_key_key" ON "PetAccessory"("key");

-- CreateIndex
CREATE UNIQUE INDEX "UserPetAccessory_petId_accessoryId_key" ON "UserPetAccessory"("petId", "accessoryId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPetAccessory_petId_equippedSlot_key" ON "UserPetAccessory"("petId", "equippedSlot");

-- CreateIndex
CREATE UNIQUE INDEX "Quest_key_key" ON "Quest"("key");

-- CreateIndex
CREATE INDEX "Quest_familyId_isActive_idx" ON "Quest"("familyId", "isActive");

-- CreateIndex
CREATE INDEX "QuestProgress_userId_periodKey_idx" ON "QuestProgress"("userId", "periodKey");

-- CreateIndex
CREATE INDEX "QuestProgress_familyId_periodKey_idx" ON "QuestProgress"("familyId", "periodKey");

-- CreateIndex
CREATE UNIQUE INDEX "QuestProgress_questId_userId_periodKey_key" ON "QuestProgress"("questId", "userId", "periodKey");

-- CreateIndex
CREATE UNIQUE INDEX "QuestProgress_questId_familyId_periodKey_key" ON "QuestProgress"("questId", "familyId", "periodKey");

-- CreateIndex
CREATE INDEX "Reward_familyId_isActive_idx" ON "Reward"("familyId", "isActive");

-- CreateIndex
CREATE INDEX "RewardRedemption_familyId_status_createdAt_idx" ON "RewardRedemption"("familyId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "RewardRedemption_userId_createdAt_idx" ON "RewardRedemption"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RewardRedemption_userId_idempotencyKey_key" ON "RewardRedemption"("userId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "SyncOperation_userId_status_createdAt_idx" ON "SyncOperation"("userId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SyncOperation_userId_operationId_key" ON "SyncOperation"("userId", "operationId");

-- CreateIndex
CREATE INDEX "AuditLog_familyId_createdAt_idx" ON "AuditLog"("familyId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Family" ADD CONSTRAINT "Family_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyMember" ADD CONSTRAINT "FamilyMember_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyMember" ADD CONSTRAINT "FamilyMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyInvite" ADD CONSTRAINT "FamilyInvite_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyInvite" ADD CONSTRAINT "FamilyInvite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Habit" ADD CONSTRAINT "Habit_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Habit" ADD CONSTRAINT "Habit_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HabitAssignment" ADD CONSTRAINT "HabitAssignment_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "Habit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HabitAssignment" ADD CONSTRAINT "HabitAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HabitAssignment" ADD CONSTRAINT "HabitAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HabitScheduleDay" ADD CONSTRAINT "HabitScheduleDay_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "Habit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HabitCompletion" ADD CONSTRAINT "HabitCompletion_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "Habit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HabitCompletion" ADD CONSTRAINT "HabitCompletion_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HabitCompletion" ADD CONSTRAINT "HabitCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HabitCompletion" ADD CONSTRAINT "HabitCompletion_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HabitStreak" ADD CONSTRAINT "HabitStreak_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "Habit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HabitStreak" ADD CONSTRAINT "HabitStreak_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyHabitStreak" ADD CONSTRAINT "FamilyHabitStreak_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "Habit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyHabitStreak" ADD CONSTRAINT "FamilyHabitStreak_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGamification" ADD CONSTRAINT "UserGamification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyGamification" ADD CONSTRAINT "FamilyGamification_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XPTransaction" ADD CONSTRAINT "XPTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XPTransaction" ADD CONSTRAINT "XPTransaction_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XPTransaction" ADD CONSTRAINT "XPTransaction_petId_fkey" FOREIGN KEY ("petId") REFERENCES "UserPet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPet" ADD CONSTRAINT "UserPet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PetCareAction" ADD CONSTRAINT "PetCareAction_petId_fkey" FOREIGN KEY ("petId") REFERENCES "UserPet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PetCareAction" ADD CONSTRAINT "PetCareAction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PetAccessory" ADD CONSTRAINT "PetAccessory_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPetAccessory" ADD CONSTRAINT "UserPetAccessory_petId_fkey" FOREIGN KEY ("petId") REFERENCES "UserPet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPetAccessory" ADD CONSTRAINT "UserPetAccessory_accessoryId_fkey" FOREIGN KEY ("accessoryId") REFERENCES "PetAccessory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quest" ADD CONSTRAINT "Quest_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quest" ADD CONSTRAINT "Quest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestProgress" ADD CONSTRAINT "QuestProgress_questId_fkey" FOREIGN KEY ("questId") REFERENCES "Quest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestProgress" ADD CONSTRAINT "QuestProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestProgress" ADD CONSTRAINT "QuestProgress_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reward" ADD CONSTRAINT "Reward_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reward" ADD CONSTRAINT "Reward_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardRedemption" ADD CONSTRAINT "RewardRedemption_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "Reward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardRedemption" ADD CONSTRAINT "RewardRedemption_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardRedemption" ADD CONSTRAINT "RewardRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardRedemption" ADD CONSTRAINT "RewardRedemption_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncOperation" ADD CONSTRAINT "SyncOperation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ════════════════════════════════════════════════════════════════════
-- Hand-written constraints that Prisma schema cannot express.
-- Prisma Migrate does not introspect CHECK constraints or triggers, so
-- these are preserved across future `prisma migrate dev` runs.
-- ════════════════════════════════════════════════════════════════════

-- Habit: PERSONAL ⇔ no family / no completion mode; FAMILY ⇔ both required.
ALTER TABLE "Habit" ADD CONSTRAINT "Habit_type_shape_check" CHECK (
  ("type" = 'PERSONAL' AND "familyId" IS NULL AND "completionMode" IS NULL)
  OR
  ("type" = 'FAMILY' AND "familyId" IS NOT NULL AND "completionMode" IS NOT NULL)
);
ALTER TABLE "Habit" ADD CONSTRAINT "Habit_date_range_check" CHECK ("endDate" IS NULL OR "endDate" >= "startDate");
ALTER TABLE "Habit" ADD CONSTRAINT "Habit_reminder_format_check" CHECK ("reminderTime" IS NULL OR "reminderTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

ALTER TABLE "HabitScheduleDay" ADD CONSTRAINT "HabitScheduleDay_weekday_check" CHECK ("weekday" BETWEEN 0 AND 6);

-- Completion owner: SHARED completions have no owner, others must have one.
ALTER TABLE "HabitCompletion" ADD CONSTRAINT "HabitCompletion_owner_check" CHECK (
  ("userId" IS NOT NULL) OR ("familyId" IS NOT NULL)
);

-- Streaks / counters are never negative.
ALTER TABLE "HabitStreak" ADD CONSTRAINT "HabitStreak_nonnegative_check" CHECK ("currentStreak" >= 0 AND "longestStreak" >= "currentStreak");
ALTER TABLE "FamilyHabitStreak" ADD CONSTRAINT "FamilyHabitStreak_nonnegative_check" CHECK ("currentStreak" >= 0 AND "longestStreak" >= "currentStreak");
ALTER TABLE "UserGamification" ADD CONSTRAINT "UserGamification_values_check" CHECK ("lifetimeXP" >= 0 AND "balanceXP" >= 0 AND "level" >= 1);
ALTER TABLE "FamilyGamification" ADD CONSTRAINT "FamilyGamification_values_check" CHECK ("lifetimeXP" >= 0 AND "level" >= 1);

-- XP ledger: exactly one owner, matching the wallet type; sign matches kind.
ALTER TABLE "XPTransaction" ADD CONSTRAINT "XPTransaction_wallet_owner_check" CHECK (
  ("walletType" = 'PERSONAL' AND "userId" IS NOT NULL AND "familyId" IS NULL AND "petId" IS NULL)
  OR ("walletType" = 'FAMILY' AND "familyId" IS NOT NULL AND "userId" IS NULL AND "petId" IS NULL)
  OR ("walletType" = 'PET' AND "petId" IS NOT NULL AND "userId" IS NULL AND "familyId" IS NULL)
);
ALTER TABLE "XPTransaction" ADD CONSTRAINT "XPTransaction_amount_sign_check" CHECK (
  ("kind" = 'EARN' AND "amount" > 0)
  OR ("kind" IN ('SPEND', 'REVERSAL') AND "amount" < 0)
  OR ("kind" = 'ADJUSTMENT' AND "amount" <> 0)
);

-- Pet
ALTER TABLE "UserPet" ADD CONSTRAINT "UserPet_values_check" CHECK ("happiness" BETWEEN 0 AND 100 AND "level" >= 1 AND "lifetimeXP" >= 0);

-- Invites: OWNER can never be granted through an invite.
ALTER TABLE "FamilyInvite" ADD CONSTRAINT "FamilyInvite_role_check" CHECK ("role" <> 'OWNER');
ALTER TABLE "FamilyInvite" ADD CONSTRAINT "FamilyInvite_uses_check" CHECK ("maxUses" >= 1 AND "usedCount" >= 0 AND "usedCount" <= "maxUses");

-- Quests
ALTER TABLE "QuestProgress" ADD CONSTRAINT "QuestProgress_subject_check" CHECK (
  ("userId" IS NOT NULL AND "familyId" IS NULL) OR ("userId" IS NULL AND "familyId" IS NOT NULL)
);
ALTER TABLE "Quest" ADD CONSTRAINT "Quest_values_check" CHECK ("goalTarget" >= 1 AND "xpReward" >= 0 AND "familyXpReward" >= 0);

-- Rewards
ALTER TABLE "Reward" ADD CONSTRAINT "Reward_cost_check" CHECK ("xpCost" > 0);
ALTER TABLE "RewardRedemption" ADD CONSTRAINT "RewardRedemption_cost_check" CHECK ("xpCost" > 0);

-- Family subscription readiness
ALTER TABLE "Family" ADD CONSTRAINT "Family_member_limit_check" CHECK ("memberLimit" IS NULL OR "memberLimit" >= 1);

-- ─── Append-only tables ───
CREATE OR REPLACE FUNCTION family_habit_forbid_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only; % is not allowed', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "XPTransaction_append_only"
  BEFORE UPDATE OR DELETE ON "XPTransaction"
  FOR EACH ROW EXECUTE FUNCTION family_habit_forbid_mutation();

CREATE TRIGGER "AuditLog_append_only"
  BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION family_habit_forbid_mutation();
