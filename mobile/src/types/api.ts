/** Mirrors the backend DTOs (backend/src/<module>/dto). Keep in sync with Swagger at /api/v1/docs. */

export type FamilyRole = 'OWNER' | 'PARENT' | 'MEMBER' | 'CHILD';

export interface TokenPair {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

export interface Me {
  id: string;
  email: string;
  createdAt: string;
  profile: {
    displayName: string;
    avatarKey: string;
    timezone: string;
    locale: string;
    onboardingCompletedAt: string | null;
  };
  family: {
    id: string;
    name: string;
    avatarKey: string;
    memberId: string;
    role: FamilyRole;
  } | null;
  gamification: {
    level: number;
    lifetimeXP: number;
    balanceXP: number;
  };
}

export interface AuthResult {
  user: Me;
  tokens: TokenPair;
}

export interface Family {
  id: string;
  name: string;
  avatarKey: string;
  timezone: string;
  plan: 'FREE' | 'PREMIUM';
  createdAt: string;
  memberCount: number;
  myMemberId: string;
  myRole: FamilyRole;
  leaderboardEnabled: boolean;
  gamification: { lifetimeXP: number; level: number };
}

export interface FamilyMember {
  id: string;
  userId: string;
  displayName: string;
  avatarKey: string;
  role: FamilyRole;
  joinedAt: string;
  isMe: boolean;
}

export interface Invite {
  id: string;
  role: FamilyRole;
  maxUses: number;
  usedCount: number;
  expiresAt: string;
  createdAt: string;
  createdByName: string;
}

export interface CreatedInvite extends Invite {
  code: string;
}

export interface SuccessEnvelope<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
    details?: { field: string; errors: string[] }[];
    requestId?: string;
  };
}

// ─── Habits ───

export type HabitType = 'PERSONAL' | 'FAMILY';
export type HabitCompletionMode = 'PER_MEMBER' | 'SHARED';
export type HabitDifficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type HabitStatus = 'ACTIVE' | 'PAUSED' | 'ARCHIVED';

export interface PersonRef {
  userId: string;
  displayName: string;
  avatarKey: string;
}

export interface Habit {
  id: string;
  type: HabitType;
  completionMode: HabitCompletionMode | null;
  title: string;
  description: string | null;
  icon: string;
  color: string;
  difficulty: HabitDifficulty;
  xpReward: number;
  status: HabitStatus;
  startDate: string;
  endDate: string | null;
  timezone: string;
  scheduleDays: number[];
  /** Local "HH:mm" reminder time, or null */
  reminderTime: string | null;
  familyId: string | null;
  creatorId: string;
  assignees: PersonRef[];
  canManage: boolean;
  canComplete: boolean;
  today: {
    date: string;
    isScheduled: boolean;
    isCompleted: boolean;
    completionId: string | null;
    completedBy: PersonRef | null;
    canUndo: boolean;
  };
  streak: { current: number; longest: number };
  /** Client-only: today's state includes an action still waiting in the offline queue. */
  pendingSync?: boolean;
}

export interface HabitDetail extends Habit {
  todayByMember: (PersonRef & { completed: boolean })[] | null;
}

export interface HabitCalendar {
  month: string;
  today: string;
  days: { date: string; isScheduled: boolean; isCompleted: boolean; isFuture: boolean }[];
  scheduledCount: number;
  completedCount: number;
}

export interface Completion {
  id: string;
  habitId: string;
  localDate: string;
  completedBy: PersonRef;
  note: string | null;
  source: string;
  createdAt: string;
}

export interface LevelState {
  level: number;
  lifetimeXP: number;
  balanceXP: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  leveledUp: boolean;
}

export interface Rewards {
  personalXP: number;
  familyXP: number;
  petXP: number;
}

export interface AchievementUnlock {
  id: string;
  key: string;
  title: string;
  description: string;
  icon: string;
  xpReward: number;
}

export interface PetProgress {
  level: number;
  lifetimeXP: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  happiness: number;
  leveledUp: boolean;
}

export interface CompletionResult {
  completion: Completion;
  streak: { current: number; longest: number };
  replayed: boolean;
  rewards: Rewards;
  gamification: LevelState;
  family: LevelState | null;
  pet: PetProgress | null;
  achievementsUnlocked: AchievementUnlock[];
  accessoriesUnlocked: AccessoryUnlock[];
  questsCompleted: QuestCompleted[];
}

export interface UndoResult {
  habitId: string;
  streak: { current: number; longest: number };
  rewards: Rewards;
  gamification: LevelState;
}

// ─── Gamification ───

export interface MyGamification {
  level: number;
  lifetimeXP: number;
  balanceXP: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  totalCompletions: number;
  completionDays: number;
  bestStreak: number;
  achievementsUnlocked: number;
  achievementsTotal: number;
}

export interface FamilyGamification {
  familyId: string;
  name: string;
  avatarKey: string;
  level: number;
  lifetimeXP: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  questsCompleted: number;
  weekXP: number;
  leaderboardEnabled: boolean;
}

export interface XpTransaction {
  id: string;
  kind: 'EARN' | 'SPEND' | 'REVERSAL' | 'ADJUSTMENT';
  amount: number;
  sourceType: string;
  title: string;
  createdAt: string;
}

export type LeaderboardPeriod = 'week' | 'month' | 'all';

export interface Leaderboard {
  period: LeaderboardPeriod;
  enabled: boolean;
  startsAt: string | null;
  entries: {
    rank: number;
    userId: string;
    displayName: string;
    avatarKey: string;
    role: FamilyRole;
    xp: number;
    level: number;
    isMe: boolean;
  }[];
}

export interface Achievement extends AchievementUnlock {
  condition: string;
  threshold: number;
  progress: number;
  unlockedAt: string | null;
}

export interface CreateHabitBody {
  title: string;
  description?: string;
  icon: string;
  color: string;
  type: HabitType;
  completionMode?: HabitCompletionMode;
  difficulty: HabitDifficulty;
  assignedUserIds?: string[];
  scheduleDays: number[];
  startDate?: string;
  endDate?: string;
  reminderTime?: string;
}

export interface UpdateHabitBody {
  title?: string;
  description?: string | null;
  icon?: string;
  color?: string;
  difficulty?: HabitDifficulty;
  scheduleDays?: number[];
  endDate?: string | null;
  reminderTime?: string | null;
  status?: 'ACTIVE' | 'ARCHIVED';
}

// ─── Pet ───

export type PetSpecies = 'FOX' | 'SNOW_FOX' | 'NIGHT_FOX';
export type PetCareType = 'PET' | 'FEED' | 'PLAY' | 'BATH';
export type PetMood = 'HAPPY' | 'CONTENT' | 'LONELY';
export type AccessorySlot = 'HEAD' | 'FACE' | 'NECK' | 'BODY' | 'BACKGROUND';
export type AccessoryRarity = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';

export interface AccessoryUnlock {
  id: string;
  key: string;
  name: string;
  slot: AccessorySlot;
  rarity: AccessoryRarity;
  assetKey: string;
}

export interface Pet {
  id: string;
  name: string;
  species: PetSpecies;
  level: number;
  lifetimeXP: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  happiness: number;
  mood: PetMood;
  lastCaredAt: string | null;
  care: {
    type: PetCareType;
    xp: number;
    happiness: number;
    cooldownMinutes: number;
    availableAt: string | null;
  }[];
  equipped: { id: string; key: string; name: string; slot: AccessorySlot; assetKey: string }[];
  accessoriesUnlocked: number;
  accessoriesTotal: number;
}

export interface Accessory extends AccessoryUnlock {
  unlockType: 'DEFAULT' | 'PET_LEVEL' | 'USER_LEVEL' | 'ACHIEVEMENT';
  requirement: string;
  progress: number;
  unlocked: boolean;
  equipped: boolean;
  unlockedAt: string | null;
}

export interface CareResult {
  type: PetCareType;
  petXP: number;
  happinessDelta: number;
  replayed: boolean;
  leveledUp: boolean;
  pet: Pet;
  accessoriesUnlocked: AccessoryUnlock[];
  achievementsUnlocked: AchievementUnlock[];
  questsCompleted: QuestCompleted[];
}

export interface PetHistoryItem {
  id: string;
  amount: number;
  title: string;
  createdAt: string;
}

// ─── Quests ───

export type QuestStatus = 'IN_PROGRESS' | 'COMPLETED' | 'CLAIMED';

export interface QuestCompleted {
  id: string;
  title: string;
  scope: 'USER' | 'FAMILY';
}

export interface Quest {
  id: string;
  key: string | null;
  title: string;
  description: string;
  icon: string;
  period: 'DAILY' | 'WEEKLY';
  scope: 'USER' | 'FAMILY';
  goalType: string;
  target: number;
  progress: number;
  status: QuestStatus;
  xpReward: number;
  familyXpReward: number;
  periodKey: string;
  resetsAt: string;
  claimedAt: string | null;
  claimedBy: PersonRef | null;
}

export interface ClaimResult {
  quest: Quest;
  rewards: Rewards;
  gamification: LevelState;
  family: LevelState | null;
  achievementsUnlocked: AchievementUnlock[];
}

// ─── Rewards ───

export type RedemptionStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REDEEMED' | 'CANCELLED';

export interface Reward {
  id: string;
  title: string;
  description: string | null;
  icon: string;
  xpCost: number;
  isActive: boolean;
  createdBy: PersonRef;
  createdAt: string;
  availableXP: number;
  canRedeem: boolean;
}

export interface Redemption {
  id: string;
  reward: { id: string; title: string; icon: string };
  xpCost: number;
  status: RedemptionStatus;
  note: string | null;
  decisionNote: string | null;
  requester: PersonRef;
  decidedBy: PersonRef | null;
  createdAt: string;
  decidedAt: string | null;
  redeemedAt: string | null;
  canDecide: boolean;
  canCancel: boolean;
  canComplete: boolean;
}

export interface RedemptionDecisionResult {
  redemption: Redemption;
  requesterWallet: LevelState | null;
}

// ─── Offline sync ───

export type SyncOperationType = 'HABIT_COMPLETION' | 'COMPLETION_UNDO' | 'PET_CARE';
export type SyncOperationStatus = 'PENDING' | 'PROCESSED' | 'REJECTED' | 'CONFLICT' | 'FAILED';

export interface SyncOperationResult {
  operationId: string;
  type: SyncOperationType;
  status: SyncOperationStatus;
  errorCode: string | null;
  message: string | null;
  replayed: boolean;
  data: Record<string, unknown> | null;
}

export interface SyncPushResult {
  serverTime: string;
  results: SyncOperationResult[];
}

export interface SyncPull {
  serverTime: string;
  habits: Habit[];
  gamification: MyGamification;
  family: Family | null;
  members: FamilyMember[];
  pendingOperations: number;
}

export interface SyncStatus {
  serverTime: string;
  offlineWindowDays: number;
  counts: Partial<Record<SyncOperationStatus, number>>;
  lastProcessedAt: string | null;
  recent: {
    operationId: string;
    type: SyncOperationType;
    status: SyncOperationStatus;
    errorCode: string | null;
    createdAt: string;
    processedAt: string | null;
  }[];
}

// ─── Notifications ───

export type NotificationType =
  | 'HABIT_REMINDER'
  | 'DAILY_PROGRESS'
  | 'STREAK_REMINDER'
  | 'QUEST_COMPLETED'
  | 'LEVEL_UP'
  | 'ACHIEVEMENT_UNLOCKED'
  | 'FAMILY_ACTIVITY'
  | 'REWARD_APPROVED'
  | 'REWARD_REQUESTED'
  | 'PET_ACCESSORY_UNLOCKED'
  | 'REWARD_REJECTED';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: { route?: string } & Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

// ─── AI ───

export interface AIStatus {
  enabled: boolean;
  reason: 'NOT_CONFIGURED' | 'DISABLED' | 'USER_DISABLED' | null;
  dailyLimit: number;
  usedToday: number;
  remainingToday: number;
}

export interface AIRecommendation {
  id: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
  goal: string;
  proposal: {
    title: string;
    description: string;
    icon: string;
    difficulty: HabitDifficulty;
    frequency: 'DAILY' | 'WEEKLY' | 'CUSTOM';
    scheduleDays: number[];
    estimatedMinutes: number;
    reason: string;
    expectedBenefit: string;
  };
  createdHabitId: string | null;
  expiresAt: string;
  createdAt: string;
}

export interface AIMessage {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  createdAt: string;
}

export interface AIConversationSummary {
  id: string;
  title: string;
  lastMessageAt: string;
  createdAt: string;
}

export interface AIConversation extends AIConversationSummary {
  messages: AIMessage[];
}

export interface AIChatResult {
  conversationId: string;
  userMessage: AIMessage;
  assistantMessage: AIMessage;
}

export interface AIPlanItem {
  id: string;
  habitId: string;
  title: string;
  startTime: string;
  durationMinutes: number;
  order: number;
  note: string | null;
  completed: boolean;
}

export interface AIPlan {
  id: string;
  date: string;
  status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  summary: string;
  warnings: { code: string; message: string }[];
  items: AIPlanItem[];
  totalMinutes: number;
  confirmedAt: string | null;
  createdAt: string;
}

export interface AIDayPlans {
  date: string;
  active: AIPlan | null;
  draft: AIPlan | null;
}

export interface PetInteraction {
  event: string;
  message: string;
  emotion: string;
  animation: 'IDLE' | 'HAPPY' | 'CARE' | 'SLEEPING' | 'CELEBRATE' | 'LEVEL_UP';
  suggestedAction: 'VIEW_PROGRESS' | 'COMPLETE_HABIT' | 'CARE_PET' | 'VIEW_QUESTS' | 'NONE';
  source: 'TEMPLATE' | 'AI';
}

export interface HabitMetrics {
  periodType: 'WEEKLY' | 'MONTHLY';
  periodKey: string;
  from: string;
  to: string;
  scheduled: number;
  completed: number;
  completionRate: number;
  activeHabits: number;
  previous: { scheduled: number; completed: number; completionRate: number };
  rateChange: number;
  bestHabit: { title: string; completionRate: number } | null;
  leastConsistentHabit: { title: string; completionRate: number } | null;
  averageCurrentStreak: number;
  byWeekday: number[];
}

export interface AIAnalytics {
  metrics: HabitMetrics;
  insight: {
    summary: string;
    positiveHighlights: string[];
    improvementAreas: string[];
    suggestions: string[];
    periodComparison: string;
  } | null;
  insightStatus: 'READY' | 'NO_DATA' | 'DISABLED' | 'UNAVAILABLE';
  insightMessage: string | null;
}
