import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

type SynthesisStatus = 'ongoing' | 'upcoming' | 'ended';
type SynthesisEvent = Record<string, any> & {
  id: string;
  name: string;
  end_time?: string | null;
  start_time?: string | null;
  created_at?: string | null;
  max_count?: number | null;
  current_count?: number | null;
  target_collection?: { name?: string | null; image_url?: string | null } | null;
};

const STATUS_OPTIONS: { key: SynthesisStatus; label: string }[] = [
  { key: 'ongoing', label: '进行中' },
  { key: 'upcoming', label: '未开始' },
  { key: 'ended', label: '已结束' },
];

const getEventStatus = (event: SynthesisEvent, now = Date.now()): SynthesisStatus => {
  const maxCount = Number(event.max_count ?? 0);
  const currentCount = Number(event.current_count ?? 0);
  const endAt = event.end_time ? new Date(event.end_time).getTime() : Number.NaN;

  if ((Number.isFinite(endAt) && endAt <= now) || (maxCount > 0 && currentCount >= maxCount)) {
    return 'ended';
  }

  const startAt = event.start_time || event.created_at;
  const startTimestamp = startAt ? new Date(startAt).getTime() : Number.NaN;
  if (Number.isFinite(startTimestamp) && startTimestamp > now) return 'upcoming';

  return 'ongoing';
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '待公布';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '待公布';

  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${month}.${day} ${hours}:${minutes}`;
};

export default function SynthesisListScreen() {
  const router = useRouter();
  const { width: viewportWidth } = useWindowDimensions();
  const [events, setEvents] = useState<SynthesisEvent[]>([]);
  const [activeStatus, setActiveStatus] = useState<SynthesisStatus>('ongoing');
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('synthesis_events')
        .select('*, target_collection:target_collection_id(name, image_url)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setEvents((data || []) as SynthesisEvent[]);
    } catch (error) {
      console.error('Failed to load synthesis events:', error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void fetchEvents();
  }, [fetchEvents]));

  const statusCounts = useMemo(() => {
    const counts: Record<SynthesisStatus, number> = { ongoing: 0, upcoming: 0, ended: 0 };
    const now = Date.now();
    for (const event of events) counts[getEventStatus(event, now)] += 1;
    return counts;
  }, [events]);

  const visibleEvents = useMemo(() => {
    const now = Date.now();
    return events.filter((event) => getEventStatus(event, now) === activeStatus);
  }, [activeStatus, events]);

  const cardImageSize = Math.max(64, Math.min(78, (viewportWidth - 88) * 0.24));
  const contentMaxWidth = Math.min(viewportWidth, 680);

  const renderEvent = ({ item }: { item: SynthesisEvent }) => {
    const status = getEventStatus(item);
    const isUnlimited = Number(item.max_count ?? 0) === 0;
    const currentCount = Math.max(0, Number(item.current_count ?? 0));
    const maxCount = Math.max(0, Number(item.max_count ?? 0));
    const remaining = isUnlimited ? null : Math.max(0, maxCount - currentCount);
    const progress = isUnlimited || maxCount === 0 ? 0 : Math.min(100, (currentCount / maxCount) * 100);
    const targetName = item.target_collection?.name || item.name || '待公布藏品';
    const startTime = item.start_time || item.created_at;
    const endTime = item.end_time;
    const actionLabel = status === 'upcoming' ? '查看活动' : status === 'ended' ? '查看记录' : '进入合成';

    return (
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`${actionLabel}：${targetName}`}
        style={[styles.eventCard, status === 'ended' && styles.eventCardEnded]}
        activeOpacity={0.88}
        onPress={() => router.push({ pathname: '/synthesis-detail', params: { id: item.id } })}
      >
        <View style={styles.cardMain}>
          {item.target_collection?.image_url ? (
            <Image
              source={{ uri: item.target_collection.image_url }}
              style={[styles.collectionImage, { width: cardImageSize, height: cardImageSize }]}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.imagePlaceholder, { width: cardImageSize, height: cardImageSize }]}>
              <Text style={styles.placeholderEmoji}>🥔</Text>
            </View>
          )}

          <View style={styles.cardCopy}>
            <View style={styles.titleRow}>
              <Text style={styles.collectionName} numberOfLines={1}>{targetName}</Text>
              <View style={[styles.statusPill, status === 'ongoing' && styles.statusPillOngoing, status === 'upcoming' && styles.statusPillUpcoming, status === 'ended' && styles.statusPillEnded]}>
                <Text style={[styles.statusPillText, status === 'ongoing' && styles.statusPillTextOngoing, status === 'upcoming' && styles.statusPillTextUpcoming, status === 'ended' && styles.statusPillTextEnded]}>
                  {STATUS_OPTIONS.find((option) => option.key === status)?.label}
                </Text>
              </View>
            </View>

            {item.name && item.name !== targetName ? (
              <Text style={styles.eventName} numberOfLines={1}>{item.name}</Text>
            ) : null}

            <View style={styles.timeRow}>
              <Ionicons name="time-outline" size={13} color="#8C8178" />
              <Text style={styles.timeText} numberOfLines={1}>
                {formatDateTime(startTime)}  —  {formatDateTime(endTime)}
              </Text>
            </View>

            <Text style={styles.capacityText} numberOfLines={1}>
              {isUnlimited ? `已合成 ${currentCount} 份 · 无限额` : `已合成 ${currentCount} / ${maxCount} 份 · 剩余 ${remaining}`}
            </Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%` }, status === 'ended' && styles.progressFillEnded]} />
          </View>
          <View style={[styles.entryAction, status === 'ended' && styles.entryActionEnded]}>
            <Text style={[styles.entryActionText, status === 'ended' && styles.entryActionTextEnded]}>{actionLabel}</Text>
            <Ionicons name="chevron-forward" size={15} color={status === 'ended' ? '#8B8179' : '#557D9A'} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={[styles.content, { maxWidth: contentMaxWidth }]}>
        <View style={styles.navBar}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="返回" onPress={() => router.back()} style={styles.navButton}>
            <Ionicons name="chevron-back" size={23} color="#493D35" />
          </TouchableOpacity>
          <Text style={styles.navTitle}>藏品合成</Text>
          <View style={styles.navButton} />
        </View>

        <View style={styles.introRow}>
          <View style={styles.introIcon}>
            <Image source={require('../assets/homepage/icons/gene.png')} style={styles.introGeneIcon} resizeMode="contain" />
          </View>
          <View style={styles.introCopy}>
            <Text style={styles.introTitle}>合成任务</Text>
            <Text style={styles.introSubtitle} numberOfLines={1}>查看活动时间与材料进度，准备好后进入合成</Text>
          </View>
        </View>

        <View style={styles.statusTabs} accessibilityRole="tablist">
          {STATUS_OPTIONS.map((option) => {
            const selected = activeStatus === option.key;
            return (
              <TouchableOpacity
                key={option.key}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                style={[styles.statusTab, selected && styles.statusTabSelected]}
                onPress={() => setActiveStatus(option.key)}
                activeOpacity={0.82}
              >
                <Text style={[styles.statusTabLabel, selected && styles.statusTabLabelSelected]}>{option.label}</Text>
                <Text style={[styles.statusCount, selected && styles.statusCountSelected]}>{statusCounts[option.key]}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="small" color="#6E91A8" />
            <Text style={styles.loadingText}>正在读取合成活动</Text>
          </View>
        ) : (
          <FlatList
            data={visibleEvents}
            renderItem={renderEvent}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={(
              <View style={styles.emptyState}>
                <View style={styles.emptyIconWrap}>
                  <Ionicons name="sparkles-outline" size={25} color="#91A9B7" />
                </View>
                <Text style={styles.emptyTitle}>当前没有{STATUS_OPTIONS.find((option) => option.key === activeStatus)?.label}活动</Text>
                <Text style={styles.emptySubtitle}>切换上方状态，查看其他合成活动</Text>
              </View>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { flex: 1, width: '100%', alignSelf: 'center', backgroundColor: '#FFFFFF' },
  navBar: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14 },
  navButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  navTitle: { color: '#493D35', fontSize: 22, lineHeight: 28, fontWeight: '800' },

  introRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginTop: 4, marginBottom: 12, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: '#FCFAF6', borderWidth: 1, borderColor: '#F0E9DF' },
  introIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#F4EEE4' },
  introGeneIcon: { width: 34, height: 34 },
  introCopy: { flex: 1, minWidth: 0 },
  introTitle: { color: '#493D35', fontSize: 15, lineHeight: 20, fontWeight: '800' },
  introSubtitle: { marginTop: 2, color: '#8B8179', fontSize: 11, lineHeight: 14 },

  statusTabs: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginBottom: 12, padding: 4, borderRadius: 16, backgroundColor: '#F8F6F2', borderWidth: 1, borderColor: '#F0ECE6' },
  statusTab: { flex: 1, minWidth: 0, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 4, borderRadius: 12 },
  statusTabSelected: { backgroundColor: '#EAF1F5', borderWidth: 1, borderColor: '#D8E5EC' },
  statusTabLabel: { color: '#7F746B', fontSize: 14, lineHeight: 20, fontWeight: '600' },
  statusTabLabelSelected: { color: '#537895', fontWeight: '800' },
  statusCount: { minWidth: 20, height: 20, overflow: 'hidden', textAlign: 'center', textAlignVertical: 'center', borderRadius: 10, backgroundColor: '#E8E3DC', color: '#766A60', fontSize: 11, lineHeight: 20, fontWeight: '800' },
  statusCountSelected: { backgroundColor: '#6F93AA', color: '#FFFFFF' },

  listContent: { width: '100%', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 28 },
  eventCard: { marginBottom: 12, padding: 12, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EFE9E1', shadowColor: '#493D35', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.045, shadowRadius: 8, elevation: 2 },
  eventCardEnded: { backgroundColor: '#FBFAF8', borderColor: '#E9E5E0' },
  cardMain: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  collectionImage: { borderRadius: 11, backgroundColor: '#F6F2EB', borderWidth: 1, borderColor: '#EFE8DE' },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#F6F2EB' },
  placeholderEmoji: { fontSize: 27 },
  cardCopy: { flex: 1, minWidth: 0, justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  collectionName: { flex: 1, minWidth: 0, color: '#493D35', fontSize: 15, lineHeight: 20, fontWeight: '800' },
  statusPill: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 9, backgroundColor: '#F0ECE6' },
  statusPillOngoing: { backgroundColor: '#EAF1F5' },
  statusPillUpcoming: { backgroundColor: '#F8F1E5' },
  statusPillEnded: { backgroundColor: '#F0EFED' },
  statusPillText: { color: '#776C62', fontSize: 11, lineHeight: 14, fontWeight: '700' },
  statusPillTextOngoing: { color: '#557D9A' },
  statusPillTextUpcoming: { color: '#9A7748' },
  statusPillTextEnded: { color: '#88817A' },
  eventName: { marginTop: 4, color: '#8C8178', fontSize: 11, lineHeight: 14 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  timeText: { flex: 1, minWidth: 0, color: '#746960', fontSize: 11, lineHeight: 14, fontVariant: ['tabular-nums'] },
  capacityText: { marginTop: 4, color: '#8B8179', fontSize: 11, lineHeight: 14 },

  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderColor: '#F2EEE9' },
  progressTrack: { flex: 1, height: 5, overflow: 'hidden', borderRadius: 3, backgroundColor: '#F1EEE9' },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: '#9EB9C9' },
  progressFillEnded: { backgroundColor: '#BDB8B2' },
  entryAction: { minWidth: 105, minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#EEF3F6' },
  entryActionEnded: { backgroundColor: '#F1EFEC' },
  entryActionText: { color: '#537895', fontSize: 14, lineHeight: 20, fontWeight: '700' },
  entryActionTextEnded: { color: '#81786F' },

  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: '#8B8179', fontSize: 11, lineHeight: 14 },
  emptyState: { alignItems: 'center', marginTop: 50, paddingHorizontal: 24 },
  emptyIconWrap: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', marginBottom: 12, borderRadius: 26, backgroundColor: '#F1F5F7' },
  emptyTitle: { color: '#554A41', fontSize: 14, lineHeight: 20, fontWeight: '700' },
  emptySubtitle: { marginTop: 4, color: '#94877C', fontSize: 11, lineHeight: 14, textAlign: 'center' },
});
