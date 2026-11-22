import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PeriodTotalsDto {
  scheduled: number;
  completed: number;
  completionRate: number;
}

export class HabitRateDto {
  title: string;
  completionRate: number;
}

export class HabitMetricsDto extends PeriodTotalsDto {
  @ApiProperty({ enum: ['WEEKLY', 'MONTHLY'] })
  periodType: 'WEEKLY' | 'MONTHLY';
  periodKey: string;
  from: string;
  to: string;
  activeHabits: number;
  previous: PeriodTotalsDto;
  rateChange: number;
  @ApiPropertyOptional({ type: HabitRateDto, nullable: true })
  bestHabit: HabitRateDto | null;
  @ApiPropertyOptional({ type: HabitRateDto, nullable: true })
  leastConsistentHabit: HabitRateDto | null;
  averageCurrentStreak: number;
  @ApiProperty({ type: [Number], description: 'Completions per weekday, 0 = Sunday' })
  byWeekday: number[];
}

export class InsightDto {
  summary: string;
  positiveHighlights: string[];
  improvementAreas: string[];
  suggestions: string[];
  periodComparison: string;
}

export class AnalyticsDto {
  metrics: HabitMetricsDto;
  @ApiPropertyOptional({ type: InsightDto, nullable: true })
  insight: InsightDto | null;
  /** READY | NO_DATA (nothing to explain) | DISABLED | UNAVAILABLE (metrics still valid) */
  @ApiProperty({ enum: ['READY', 'NO_DATA', 'DISABLED', 'UNAVAILABLE'] })
  insightStatus: 'READY' | 'NO_DATA' | 'DISABLED' | 'UNAVAILABLE';
  insightMessage: string | null;
}
