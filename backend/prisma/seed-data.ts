/**
 * Reference data shared by the seed script and the e2e tests.
 * Catalogs only — no user accounts.
 */
import type { PrismaClient } from '../src/generated/prisma/client';
import type {
  AccessoryUnlockType,
  AchievementCondition,
  PetAccessoryRarity,
  PetAccessorySlot,
  QuestGoalType,
  QuestPeriod,
  QuestScope,
} from '../src/generated/prisma/enums';

const achievements: Array<{
  key: string;
  title: string;
  description: string;
  icon: string;
  condition: AchievementCondition;
  threshold: number;
  xpReward: number;
  sortOrder: number;
}> = [
  {
    key: 'first_step',
    title: 'Анхны алхам',
    description: 'Анхны дадлаа биелүүллээ.',
    icon: 'footprints',
    condition: 'FIRST_COMPLETION',
    threshold: 1,
    xpReward: 25,
    sortOrder: 10,
  },
  {
    key: 'streak_3',
    title: 'Гурван өдөр',
    description: '3 өдөр дараалан дадлаа биелүүллээ.',
    icon: 'flame',
    condition: 'STREAK_DAYS',
    threshold: 3,
    xpReward: 30,
    sortOrder: 20,
  },
  {
    key: 'streak_7',
    title: '7 хоногийн од',
    description: '7 өдөр дараалан дадлаа биелүүллээ.',
    icon: 'flame',
    condition: 'STREAK_DAYS',
    threshold: 7,
    xpReward: 75,
    sortOrder: 30,
  },
  {
    key: 'streak_30',
    title: 'Сарын аварга',
    description: '30 өдөр дараалан дадлаа биелүүллээ.',
    icon: 'crown',
    condition: 'STREAK_DAYS',
    threshold: 30,
    xpReward: 200,
    sortOrder: 40,
  },
  {
    key: 'habit_builder',
    title: 'Дадал бүтээгч',
    description: '5 идэвхтэй дадалтай боллоо.',
    icon: 'blocks',
    condition: 'ACTIVE_HABITS',
    threshold: 5,
    xpReward: 50,
    sortOrder: 50,
  },
  {
    key: 'family_teamwork',
    title: 'Хамтын хүч',
    description: 'Гэр бүлийн quest-ийг хамтдаа дуусгалаа.',
    icon: 'users',
    condition: 'FAMILY_QUESTS_COMPLETED',
    threshold: 1,
    xpReward: 60,
    sortOrder: 60,
  },
  {
    key: 'consistency_30',
    title: 'Тогтвортой хүн',
    description: 'Нийт 30 өдөр дадал биелүүллээ.',
    icon: 'calendar-check',
    condition: 'TOTAL_COMPLETION_DAYS',
    threshold: 30,
    xpReward: 150,
    sortOrder: 70,
  },
  {
    key: 'pet_level_5',
    title: 'Найзаа өсгөгч',
    description: 'Pet-ээ 5-р түвшинд хүргэлээ.',
    icon: 'paw-print',
    condition: 'PET_LEVEL',
    threshold: 5,
    xpReward: 80,
    sortOrder: 80,
  },
  {
    key: 'level_10',
    title: 'Аравдугаар түвшин',
    description: '10-р түвшинд хүрлээ.',
    icon: 'trophy',
    condition: 'USER_LEVEL',
    threshold: 10,
    xpReward: 120,
    sortOrder: 90,
  },
];

const accessories: Array<{
  key: string;
  name: string;
  slot: PetAccessorySlot;
  rarity: PetAccessoryRarity;
  unlockType: AccessoryUnlockType;
  unlockValue?: number;
  achievementKey?: string;
  assetKey: string;
  sortOrder: number;
}> = [
  {
    key: 'red_scarf',
    name: 'Улаан ороолт',
    slot: 'NECK',
    rarity: 'COMMON',
    unlockType: 'DEFAULT',
    assetKey: 'neck_red_scarf',
    sortOrder: 10,
  },
  {
    key: 'party_hat',
    name: 'Баярын малгай',
    slot: 'HEAD',
    rarity: 'COMMON',
    unlockType: 'PET_LEVEL',
    unlockValue: 2,
    assetKey: 'head_party_hat',
    sortOrder: 20,
  },
  {
    key: 'sunglasses',
    name: 'Нарны шил',
    slot: 'FACE',
    rarity: 'RARE',
    unlockType: 'PET_LEVEL',
    unlockValue: 4,
    assetKey: 'face_sunglasses',
    sortOrder: 30,
  },
  {
    key: 'deel',
    name: 'Бяцхан дээл',
    slot: 'BODY',
    rarity: 'EPIC',
    unlockType: 'PET_LEVEL',
    unlockValue: 6,
    assetKey: 'body_deel',
    sortOrder: 40,
  },
  {
    key: 'steppe_bg',
    name: 'Тал нутаг',
    slot: 'BACKGROUND',
    rarity: 'RARE',
    unlockType: 'USER_LEVEL',
    unlockValue: 3,
    assetKey: 'bg_steppe',
    sortOrder: 50,
  },
  {
    key: 'flame_badge',
    name: 'Галын тэмдэг',
    slot: 'NECK',
    rarity: 'EPIC',
    unlockType: 'ACHIEVEMENT',
    achievementKey: 'streak_7',
    assetKey: 'neck_flame_badge',
    sortOrder: 60,
  },
  {
    key: 'golden_crown',
    name: 'Алтан титэм',
    slot: 'HEAD',
    rarity: 'LEGENDARY',
    unlockType: 'ACHIEVEMENT',
    achievementKey: 'streak_30',
    assetKey: 'head_golden_crown',
    sortOrder: 70,
  },
];

const quests: Array<{
  key: string;
  title: string;
  description: string;
  icon: string;
  period: QuestPeriod;
  scope: QuestScope;
  goalType: QuestGoalType;
  goalTarget: number;
  xpReward: number;
  familyXpReward: number;
}> = [
  {
    key: 'daily_two_habits',
    title: 'Өдрийн хоёр алхам',
    description: 'Өнөөдөр 2 дадал биелүүлээрэй.',
    icon: 'target',
    period: 'DAILY',
    scope: 'USER',
    goalType: 'COMPLETE_HABITS',
    goalTarget: 2,
    xpReward: 20,
    familyXpReward: 0,
  },
  {
    key: 'daily_all_done',
    title: 'Бүгдийг нь!',
    description: 'Өнөөдрийн бүх дадлаа биелүүлээрэй.',
    icon: 'check-check',
    period: 'DAILY',
    scope: 'USER',
    goalType: 'COMPLETE_ALL_TODAY',
    goalTarget: 1,
    xpReward: 20,
    familyXpReward: 0,
  },
  {
    key: 'daily_pet_care',
    title: 'Найзаа арчил',
    description: 'Pet-дээ өнөөдөр 2 удаа анхаарал тавиарай.',
    icon: 'heart',
    period: 'DAILY',
    scope: 'USER',
    goalType: 'PET_CARE',
    goalTarget: 2,
    xpReward: 20,
    familyXpReward: 0,
  },
  {
    key: 'family_daily_five',
    title: 'Гэр бүлийн 5',
    description: 'Гэр бүлээрээ өнөөдөр 5 дадал биелүүлээрэй.',
    icon: 'users',
    period: 'DAILY',
    scope: 'FAMILY',
    goalType: 'COMPLETE_FAMILY_HABITS',
    goalTarget: 5,
    xpReward: 0,
    familyXpReward: 50,
  },
  {
    key: 'family_weekly_thirty',
    title: 'Хамтын долоо хоног',
    description: 'Энэ долоо хоногт гэр бүлээрээ 30 дадал биелүүлээрэй.',
    icon: 'calendar-range',
    period: 'WEEKLY',
    scope: 'FAMILY',
    goalType: 'COMPLETE_FAMILY_HABITS',
    goalTarget: 30,
    xpReward: 0,
    familyXpReward: 50,
  },
];

/** Idempotent upsert of reference catalogs (achievements, accessories, system quests). */
export async function seedReferenceData(prisma: PrismaClient): Promise<{
  achievements: number;
  accessories: number;
  quests: number;
}> {
  for (const a of achievements) {
    await prisma.achievement.upsert({ where: { key: a.key }, update: a, create: a });
  }

  const achievementIds = new Map(
    (await prisma.achievement.findMany({ select: { id: true, key: true } })).map((a) => [
      a.key,
      a.id,
    ]),
  );
  for (const { achievementKey, ...acc } of accessories) {
    const data = {
      ...acc,
      unlockValue: acc.unlockValue ?? null,
      achievementId: achievementKey ? (achievementIds.get(achievementKey) ?? null) : null,
    };
    await prisma.petAccessory.upsert({ where: { key: acc.key }, update: data, create: data });
  }

  for (const q of quests) {
    await prisma.quest.upsert({ where: { key: q.key }, update: q, create: q });
  }

  return {
    achievements: achievements.length,
    accessories: accessories.length,
    quests: quests.length,
  };
}
