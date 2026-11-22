import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MessageCircle, Send, Sparkles } from 'lucide-react-native';
import { AppText } from '@/components/ui/AppText';
import { BackHeader } from '@/components/ui/BackHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FormError } from '@/components/ui/FormError';
import { PressableScale } from '@/components/ui/PressableScale';
import { Segmented } from '@/components/ui/Segmented';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, InlineError } from '@/components/ui/StateViews';
import { TextField } from '@/components/ui/TextField';
import {
  newRequestKey,
  useAcceptRecommendation,
  useAIStatus,
  useConversation,
  useConversations,
  usePendingRecommendations,
  useRecommend,
  useRejectRecommendation,
  useSendChat,
} from '@/features/ai/api';
import { AIMessageBubble } from '@/features/ai/components/AIMessageBubble';
import { AIRecommendationCard } from '@/features/ai/components/AIRecommendationCard';
import { AIThinkingIndicator } from '@/features/ai/components/AIThinkingIndicator';
import { PlannerTab } from '@/features/ai/components/PlannerTab';
import { describeSchedule } from '@/features/habits/constants';
import { errorMessage } from '@/services/api/errors';
import { colors, radius, spacing } from '@/theme';
import type { AIRecommendation, AIStatus } from '@/types/api';

type Tab = 'ideas' | 'plan' | 'chat';

const DISABLED_TEXT: Record<NonNullable<AIStatus['reason']>, string> = {
  NOT_CONFIGURED: 'AI зөвлөгч одоогоор тохируулагдаагүй байна. Аппын бусад хэсэг хэвийн ажиллана.',
  DISABLED: 'AI зөвлөгч түр унтарсан байна. Дараа дахин үзээрэй.',
  USER_DISABLED: 'Та AI зөвлөгчийг тохиргооноос унтраасан байна.',
};

/** AI Habit Coach: goal → up to 3 proposals (accept = real habit), plus a coach chat. */
export default function AICoachScreen() {
  const status = useAIStatus();
  const [tab, setTab] = useState<Tab>('ideas');

  const s = status.data;
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <BackHeader title="AI зөвлөгч" />
      </View>
      <View style={styles.pad}>
        <Segmented
          value={tab}
          onChange={setTab}
          accessibilityLabel="AI зөвлөгчийн хэсэг"
          options={[
            { value: 'ideas', label: 'Санал' },
            { value: 'plan', label: 'Төлөвлөгөө' },
            { value: 'chat', label: 'Ярилцах' },
          ]}
        />
        {s?.enabled ? (
          <AppText variant="caption" color={colors.secondary} align="center">
            Өнөөдөр {s.remainingToday} / {s.dailyLimit} AI хүсэлт үлдсэн
          </AppText>
        ) : null}
      </View>

      {status.isPending ? (
        <View style={styles.pad}>
          <ListSkeleton rows={2} trailing={false} />
        </View>
      ) : status.isError ? (
        <View style={styles.pad}>
          <InlineError message={errorMessage(status.error)} onRetry={() => void status.refetch()} />
        </View>
      ) : !s?.enabled ? (
        <EmptyState
          icon={<Sparkles size={28} color={colors.purple} />}
          title="AI зөвлөгч идэвхгүй"
          message={DISABLED_TEXT[s?.reason ?? 'DISABLED']}
        />
      ) : tab === 'ideas' ? (
        <IdeasTab />
      ) : tab === 'plan' ? (
        <PlannerTab />
      ) : (
        <ChatTab />
      )}
    </SafeAreaView>
  );
}

function IdeasTab() {
  const pending = usePendingRecommendations();
  const recommend = useRecommend();
  const accept = useAcceptRecommendation();
  const reject = useRejectRecommendation();
  const [goal, setGoal] = useState('');
  // One key per distinct goal text so a retry does not cost a second AI call.
  const requestKey = useRef<{ goal: string; key: string } | null>(null);

  const ask = () => {
    const text = goal.trim();
    if (!text) return;
    if (requestKey.current?.goal !== text) requestKey.current = { goal: text, key: newRequestKey() };
    recommend.mutate(
      { goal: text, idempotencyKey: requestKey.current.key },
      { onSuccess: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success) },
    );
  };

  const confirmAccept = (rec: AIRecommendation) =>
    Alert.alert(
      'Дадал болгох уу?',
      `«${rec.proposal.title}» — ${describeSchedule(rec.proposal.scheduleDays)}. Дараа нь засах боломжтой.`,
      [
        { text: 'Болих', style: 'cancel' },
        {
          text: 'Нэмэх',
          onPress: () =>
            accept.mutate(
              { id: rec.id },
              {
                onSuccess: ({ habit }) => {
                  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  router.push(`/habit/${habit.id}`);
                },
                onError: (err) => Alert.alert('Нэмж чадсангүй', errorMessage(err)),
              },
            ),
        },
      ],
    );

  const items = pending.data ?? [];
  return (
    <FlatList
      data={items}
      keyExtractor={(r) => r.id}
      contentContainerStyle={styles.list}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={styles.ask}>
          <TextField
            label="Таны зорилго"
            value={goal}
            onChangeText={setGoal}
            placeholder="Жишээ нь: Илүү их ном уншдаг болмоор байна"
            multiline
            maxLength={500}
          />
          <Button
            title="Санал авах"
            variant="quest"
            icon={<Sparkles size={18} color={colors.white} />}
            onPress={ask}
            loading={recommend.isPending}
            disabled={!goal.trim()}
          />
          {recommend.isPending ? <AIThinkingIndicator /> : null}
          <FormError message={recommend.isError ? errorMessage(recommend.error) : null} />
          <AppText variant="caption" color={colors.secondary}>
            AI зөвхөн санал болгоно. Таны зөвшөөрсөн санал л дадал болж нэмэгдэнэ.
          </AppText>
        </View>
      }
      ListEmptyComponent={
        pending.isPending ? (
          <ListSkeleton rows={2} trailing={false} />
        ) : pending.isError ? (
          <InlineError message={errorMessage(pending.error)} onRetry={() => void pending.refetch()} />
        ) : (
          <AppText color={colors.secondary} align="center">
            Зорилгоо бичээд санал аваарай ✨
          </AppText>
        )
      }
      renderItem={({ item }) => (
        <AIRecommendationCard
          rec={item}
          onAccept={() => confirmAccept(item)}
          onReject={() =>
            reject.mutate(item.id, {
              onError: (err) => Alert.alert('Амжилтгүй', errorMessage(err)),
            })
          }
          accepting={accept.isPending && accept.variables?.id === item.id}
          rejecting={reject.isPending && reject.variables === item.id}
        />
      )}
    />
  );
}

function ChatTab() {
  const conversations = useConversations();
  const [selected, setSelected] = useState<string | null | undefined>(undefined);
  // Default to the latest conversation until the user starts a new one.
  const conversationId = selected === undefined ? (conversations.data?.[0]?.id ?? null) : selected;
  const conversation = useConversation(conversationId);
  const send = useSendChat();
  const [text, setText] = useState('');
  const pendingKey = useRef<{ text: string; key: string } | null>(null);

  const submit = () => {
    const message = text.trim();
    if (!message) return;
    if (pendingKey.current?.text !== message) pendingKey.current = { text: message, key: newRequestKey() };
    send.mutate(
      { conversationId: conversationId ?? undefined, message, clientKey: pendingKey.current.key },
      {
        onSuccess: (r) => {
          setText('');
          pendingKey.current = null;
          setSelected(r.conversationId);
        },
      },
    );
  };

  const messages = conversation.data?.messages ?? [];
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={8}
    >
      <FlatList
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.chat}
        renderItem={({ item }) => <AIMessageBubble message={item} />}
        ListHeaderComponent={
          conversationId ? (
            <PressableScale
              onPress={() => setSelected(null)}
              accessibilityRole="button"
              style={styles.newChat}
            >
              <MessageCircle size={16} color={colors.purpleText} />
              <AppText variant="label" color={colors.purpleText}>
                Шинэ яриа эхлүүлэх
              </AppText>
            </PressableScale>
          ) : undefined
        }
        ListEmptyComponent={
          conversation.isPending && conversationId ? (
            <ListSkeleton rows={2} trailing={false} />
          ) : (
            <Card>
              <AppText variant="label">Дадлын тухай асуугаарай</AppText>
              <AppText variant="caption" color={colors.secondary}>
                Жишээ нь: «Яаж эрт босдог болох вэ?», «Миний дадлууд яаж явж байна?»
              </AppText>
            </Card>
          )
        }
        ListFooterComponent={
          <View style={styles.footer}>
            {send.isPending ? <AIThinkingIndicator /> : null}
            <FormError message={send.isError ? errorMessage(send.error) : null} />
          </View>
        }
      />
      <View style={styles.composer}>
        <View style={styles.flex}>
          <TextField
            label=""
            value={text}
            onChangeText={setText}
            placeholder="Мессеж бичих…"
            multiline
            maxLength={1000}
            accessibilityLabel="AI зөвлөгчид мессеж"
          />
        </View>
        <PressableScale
          onPress={submit}
          disabled={!text.trim() || send.isPending}
          accessibilityRole="button"
          accessibilityLabel="Илгээх"
          style={[styles.send, (!text.trim() || send.isPending) && styles.sendDisabled]}
        >
          <Send size={20} color={colors.white} />
        </PressableScale>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  pad: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.xs },
  flex: { flex: 1 },
  list: { padding: spacing.lg, gap: spacing.md },
  ask: { gap: spacing.sm, marginBottom: spacing.sm },
  chat: { padding: spacing.lg, gap: spacing.sm, flexGrow: 1 },
  footer: { gap: spacing.xs },
  newChat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.purpleSoft,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  send: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.purpleText,
  },
  sendDisabled: { opacity: 0.5 },
});
