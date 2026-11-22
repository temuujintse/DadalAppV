import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { AppText } from '@/components/ui/AppText';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { DateField } from '@/components/ui/DateField';
import { TimeField } from '@/components/ui/TimeField';
import { FormError } from '@/components/ui/FormError';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen } from '@/components/ui/Screen';
import { Segmented } from '@/components/ui/Segmented';
import { TextField } from '@/components/ui/TextField';
import { BackHeader } from '@/components/ui/BackHeader';
import { colors, radius, spacing } from '@/theme';
import type { FamilyMember } from '@/types/api';
import { COMPLETION_MODE, DIFFICULTY, HABIT_COLORS } from '../constants';
import { HABIT_ICONS } from '../icons';
import { habitFormSchema, HabitFormValues, todayLocal } from '../schemas';
import { WeekdayPicker } from './WeekdayPicker';

export interface HabitFormProps {
  mode: 'create' | 'edit';
  initialValues: HabitFormValues;
  members: FamilyMember[];
  /** OWNER/PARENT may create family habits and change assignees */
  canManageFamily: boolean;
  submitting: boolean;
  serverError: string | null;
  onSubmit: (values: HabitFormValues) => void;
}

/**
 * Shared create/edit form. Dependent fields follow the choices:
 * FAMILY → completion mode + assignees appear; type and mode are fixed once created.
 */
export function HabitForm({
  mode,
  initialValues,
  members,
  canManageFamily,
  submitting,
  serverError,
  onSubmit,
}: HabitFormProps) {
  const { control, handleSubmit, formState, setValue } = useForm<HabitFormValues>({
    resolver: zodResolver(habitFormSchema),
    defaultValues: initialValues,
  });
  const type = useWatch({ control, name: 'type' });
  const color = useWatch({ control, name: 'color' });
  const startDate = useWatch({ control, name: 'startDate' });
  const isCreate = mode === 'create';
  const errors = formState.errors;

  return (
    <Screen
      edges={['top', 'bottom', 'left', 'right']}
      footer={
        <Button
          title={isCreate ? 'Дадал үүсгэх' : 'Хадгалах'}
          onPress={handleSubmit(onSubmit)}
          loading={submitting}
        />
      }
    >
      <BackHeader title={isCreate ? 'Шинэ дадал' : 'Дадал засах'} variant="close" />
      <FormError message={serverError} />

      <Controller
        control={control}
        name="title"
        render={({ field }) => (
          <TextField
            label="Дадлын нэр"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.title?.message}
            placeholder="Жишээ нь: Өглөө 20 минут алхах"
            maxLength={80}
          />
        )}
      />
      <Controller
        control={control}
        name="description"
        render={({ field }) => (
          <TextField
            label="Тайлбар (заавал биш)"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.description?.message}
            multiline
            maxLength={500}
            style={styles.multiline}
          />
        )}
      />

      <Section title="Дүрс ба өнгө">
        <Controller
          control={control}
          name="icon"
          render={({ field }) => (
            <View style={styles.wrap} accessibilityRole="radiogroup">
              {Object.entries(HABIT_ICONS).map(([key, Icon]) => {
                const selected = field.value === key;
                return (
                  <PressableScale
                    key={key}
                    onPress={() => field.onChange(key)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={key}
                    style={[
                      styles.iconCell,
                      selected && { borderColor: color, backgroundColor: `${color}1A` },
                    ]}
                  >
                    <Icon size={22} color={selected ? color : colors.secondary} />
                  </PressableScale>
                );
              })}
            </View>
          )}
        />
        <Controller
          control={control}
          name="color"
          render={({ field }) => (
            <View style={styles.wrap} accessibilityRole="radiogroup">
              {HABIT_COLORS.map((c) => (
                <PressableScale
                  key={c}
                  onPress={() => field.onChange(c)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: field.value === c }}
                  accessibilityLabel={`Өнгө ${c}`}
                  style={[styles.swatch, { backgroundColor: c }]}
                >
                  {field.value === c ? (
                    <Check size={18} color={colors.white} strokeWidth={3} />
                  ) : null}
                </PressableScale>
              ))}
            </View>
          )}
        />
      </Section>

      {isCreate ? (
        <Section title="Төрөл">
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <Segmented
                accessibilityLabel="Дадлын төрөл"
                value={field.value}
                onChange={(v) => {
                  field.onChange(v);
                  if (v === 'FAMILY')
                    setValue(
                      'assignedUserIds',
                      members.map((m) => m.userId),
                    );
                }}
                options={[
                  { value: 'PERSONAL', label: 'Хувийн' },
                  { value: 'FAMILY', label: 'Гэр бүлийн', disabled: !canManageFamily },
                ]}
              />
            )}
          />
          {!canManageFamily ? (
            <AppText variant="caption" color={colors.secondary}>
              Гэр бүлийн дадлыг эзэмшигч эсвэл эцэг эх үүсгэнэ.
            </AppText>
          ) : null}
        </Section>
      ) : null}

      {type === 'FAMILY' ? (
        <>
          {isCreate ? (
            <Section title="Хэрхэн биелүүлэх вэ?">
              <Controller
                control={control}
                name="completionMode"
                render={({ field }) => (
                  <>
                    <Segmented
                      accessibilityLabel="Биелүүлэх горим"
                      value={field.value}
                      onChange={field.onChange}
                      options={[
                        { value: 'PER_MEMBER', label: COMPLETION_MODE.PER_MEMBER.label },
                        { value: 'SHARED', label: COMPLETION_MODE.SHARED.label },
                      ]}
                    />
                    <AppText variant="caption" color={colors.secondary}>
                      {COMPLETION_MODE[field.value].hint}
                    </AppText>
                  </>
                )}
              />
            </Section>
          ) : null}

          {canManageFamily ? (
            <Section title="Оноох гишүүд">
              <Controller
                control={control}
                name="assignedUserIds"
                render={({ field }) => (
                  <View style={styles.wrap}>
                    {members.map((m) => {
                      const on = field.value.includes(m.userId);
                      return (
                        <PressableScale
                          key={m.userId}
                          onPress={() =>
                            field.onChange(
                              on
                                ? field.value.filter((id) => id !== m.userId)
                                : [...field.value, m.userId],
                            )
                          }
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: on }}
                          accessibilityLabel={m.displayName}
                          style={[styles.memberChip, on && styles.memberChipOn]}
                        >
                          <Avatar avatarKey={m.avatarKey} size={26} />
                          <AppText variant="label" color={on ? colors.primaryText : colors.text}>
                            {m.displayName}
                          </AppText>
                        </PressableScale>
                      );
                    })}
                  </View>
                )}
              />
              {errors.assignedUserIds?.message ? (
                <AppText variant="caption" color={colors.errorText}>
                  {errors.assignedUserIds.message}
                </AppText>
              ) : null}
            </Section>
          ) : null}
        </>
      ) : null}

      <Section title="Хүндрэл">
        <Controller
          control={control}
          name="difficulty"
          render={({ field }) => (
            <Segmented
              accessibilityLabel="Хүндрэл"
              value={field.value}
              onChange={field.onChange}
              options={(['EASY', 'MEDIUM', 'HARD'] as const).map((d) => ({
                value: d,
                label: DIFFICULTY[d].label,
              }))}
            />
          )}
        />
      </Section>

      <Section title="Хуваарь">
        <Controller
          control={control}
          name="scheduleDays"
          render={({ field }) => (
            <WeekdayPicker
              value={field.value}
              onChange={field.onChange}
              error={errors.scheduleDays?.message}
            />
          )}
        />
      </Section>

      {isCreate ? (
        <Controller
          control={control}
          name="startDate"
          render={({ field }) => (
            <DateField
              label="Эхлэх огноо"
              value={field.value}
              minimumDate={todayLocal()}
              onChange={(v) => field.onChange(v ?? todayLocal())}
            />
          )}
        />
      ) : null}
      <Controller
        control={control}
        name="endDate"
        render={({ field }) => (
          <DateField
            label="Дуусах огноо (заавал биш)"
            value={field.value}
            minimumDate={startDate > todayLocal() ? startDate : todayLocal()}
            placeholder="Хугацаагүй"
            clearable
            onChange={field.onChange}
            error={errors.endDate?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="reminderTime"
        render={({ field }) => (
          <TimeField
            label="Сануулга (заавал биш)"
            value={field.value}
            onChange={field.onChange}
            hint="Хуваарьт өдрүүдэд энэ цагт утсан дээр сануулна. Биелүүлсэн өдөр сануулахгүй."
          />
        )}
      />
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="label">{title}</AppText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  section: { gap: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  iconCell: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingLeft: spacing.xxs,
    paddingRight: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  memberChipOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
});
