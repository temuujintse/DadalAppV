import { zodResolver } from '@hookform/resolvers/zod';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { Camera } from 'lucide-react-native';
import { z } from 'zod';
import { AppText } from '@/components/ui/AppText';
import { Avatar } from '@/components/ui/Avatar';
import { AvatarPicker } from '@/components/ui/AvatarPicker';
import { BackHeader } from '@/components/ui/BackHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PressableScale } from '@/components/ui/PressableScale';
import { FormError } from '@/components/ui/FormError';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { useLogout, useMe } from '@/features/auth/api';
import { displayNameSchema } from '@/features/auth/schemas';
import { ROLE_LABELS } from '@/features/family/roles';
import { useRemovePhoto, useUpdateProfile, useUploadPhoto } from '@/features/profile/api';
import { pickProfilePhoto, PhotoSource } from '@/features/profile/pick-photo';
import { MotionCard } from '@/features/profile/components/MotionCard';
import { NotificationsCard } from '@/features/notifications/components/NotificationsCard';
import { SyncCard } from '@/features/sync/components/SyncCard';
import { errorMessage } from '@/services/api/errors';
import { selectPendingCount, useOutboxStore } from '@/services/offline/outbox';
import { colors, spacing } from '@/theme';
import { deviceTimeZone } from '@/utils/device';

const profileSchema = z.object({ displayName: displayNameSchema, avatarKey: z.string() });
type ProfileForm = z.infer<typeof profileSchema>;

export default function ProfileScreen() {
  const me = useMe();
  const update = useUpdateProfile();
  const upload = useUploadPhoto();
  const removePhoto = useRemovePhoto();
  const logout = useLogout();
  const pendingSync = useOutboxStore(selectPendingCount);

  const { control, handleSubmit, formState } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    values: me.data
      ? { displayName: me.data.profile.displayName, avatarKey: me.data.profile.avatarKey }
      : undefined,
  });
  const selectedAvatar = useWatch({ control, name: 'avatarKey' });

  if (!me.data) return null;
  const { profile, family, email } = me.data;
  const deviceTz = deviceTimeZone();

  const onSave = handleSubmit((values) =>
    update.mutate(values, {
      onSuccess: () => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.back();
      },
    }),
  );

  const photoBusy = upload.isPending || removePhoto.isPending;
  const fromSource = async (source: PhotoSource) => {
    try {
      const image = await pickProfilePhoto(source);
      if (image) {
        upload.mutate(image, {
          onSuccess: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
          onError: (err) => Alert.alert('Зураг хадгалж чадсангүй', errorMessage(err)),
        });
      }
    } catch (err) {
      Alert.alert('Зураг', err instanceof Error ? err.message : 'Зураг сонгож чадсангүй.');
    }
  };
  const choosePhoto = () =>
    Alert.alert('Профайлын зураг', 'Зургийг зөвхөн та болон гэр бүлийн гишүүд харна.', [
      { text: 'Зургийн сангаас сонгох', onPress: () => void fromSource('library') },
      { text: 'Зураг авах', onPress: () => void fromSource('camera') },
      ...(profile.photoUrl
        ? [
            {
              text: 'Зураг устгах',
              style: 'destructive' as const,
              onPress: () =>
                removePhoto.mutate(undefined, {
                  onError: (err) => Alert.alert('Устгаж чадсангүй', errorMessage(err)),
                }),
            },
          ]
        : []),
      { text: 'Болих', style: 'cancel' as const },
    ]);

  const confirmLogout = () =>
    Alert.alert(
      'Гарах уу?',
      pendingSync
        ? `Синк хийгдээгүй ${pendingSync} үйлдэл байна. Төхөөрөмж дээр хадгалагдаж, дахин нэвтрэхэд синк хийгдэнэ.`
        : 'Энэ төхөөрөмж дээрх нэвтрэлт хаагдана.',
      [
      { text: 'Болих', style: 'cancel' },
        { text: 'Гарах', style: 'destructive', onPress: () => logout.mutate() },
      ],
    );

  return (
    <Screen
      edges={['top', 'bottom', 'left', 'right']}
      footer={
        <Button
          title="Хадгалах"
          onPress={onSave}
          loading={update.isPending}
          disabled={!formState.isDirty}
        />
      }
    >
      <BackHeader title="Профайл" variant="close" />

      <View style={styles.hero}>
        <PressableScale
          onPress={choosePhoto}
          accessibilityRole="button"
          accessibilityLabel="Профайлын зураг солих"
          style={styles.photo}
        >
          <Avatar avatarKey={selectedAvatar ?? profile.avatarKey} photoUrl={profile.photoUrl} size={88} />
          <View style={styles.camera}>
            {photoBusy ? <ActivityIndicator size="small" color={colors.white} /> : <Camera size={16} color={colors.white} />}
          </View>
        </PressableScale>
        <AppText variant="caption" color={colors.secondary}>
          {email}
          {family ? ` · ${family.name} (${ROLE_LABELS[family.role]})` : ''}
        </AppText>
      </View>

      <FormError message={update.isError ? errorMessage(update.error) : null} />

      <Controller
        control={control}
        name="displayName"
        render={({ field }) => (
          <TextField
            label="Нэр"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={formState.errors.displayName?.message}
            maxLength={50}
          />
        )}
      />

      <View style={styles.section}>
        <AppText variant="label">Аватар</AppText>
        <Controller
          control={control}
          name="avatarKey"
          render={({ field }) => (
            <AvatarPicker kind="user" value={field.value} onChange={field.onChange} />
          )}
        />
      </View>

      <Card>
        <AppText variant="label">Цагийн бүс</AppText>
        <AppText color={colors.secondary}>
          {profile.timezone}. Дадлын өдөр, streak энэ бүсийн огноогоор тооцогдоно.
        </AppText>
        {deviceTz !== profile.timezone ? (
          <Button
            title={`Төхөөрөмжийн бүсээр солих (${deviceTz})`}
            variant="secondary"
            loading={update.isPending && update.variables?.timezone === deviceTz}
            onPress={() => update.mutate({ timezone: deviceTz })}
          />
        ) : null}
      </Card>

      <NotificationsCard />

      <MotionCard />

      <SyncCard />

      <Button title="Гарах" variant="danger" loading={logout.isPending} onPress={confirmLogout} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: spacing.xs },
  photo: { width: 88, height: 88 },
  camera: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: { gap: spacing.sm },
});
