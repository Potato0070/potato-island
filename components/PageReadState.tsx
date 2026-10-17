import { Ionicons } from '@expo/vector-icons';
import { type Href, useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PencilButton from './PencilButton';
import type { ReadFailure } from './pageReadStatus';

type Props = {
  pageTitle: string;
  subject: string;
  status: 'loading' | ReadFailure;
  fallback: Href;
  backLabel?: string;
  onRetry?: () => void;
};

export default function PageReadState({ pageTitle, subject, status, fallback, backLabel = '返回列表', onRetry }: Props) {
  const router = useRouter();
  const goBack = () => router.canGoBack() ? router.back() : router.replace(fallback);
  const copy = {
    loading: { title: `正在读取${subject}…`, description: '请稍候，也可以返回上一页。' },
    error: { title: `${subject}暂时无法加载`, description: '连接可能暂时中断，请重新加载后再试。' },
    missing: { title: `没有找到${subject}`, description: '内容可能已移除，或当前账号暂时无法查看。' },
    login: { title: '登录后继续查看', description: '请先登录账号，再回来继续操作。' },
    denied: { title: '当前账号暂时无法查看', description: '请确认使用了正确的账号，或返回其他页面。' },
  }[status];
  return <SafeAreaView style={styles.screen}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="返回" onPress={goBack} style={styles.back}><Ionicons name="chevron-back" size={26} color="#493D35" /></Pressable>
      <Text style={styles.pageTitle}>{pageTitle}</Text><View style={styles.back} />
    </View>
    <ScrollView contentContainerStyle={styles.content}>
      {status === 'loading' ? <ActivityIndicator size="large" color="#789DB4" /> : <Ionicons name={status === 'error' ? 'cloud-offline-outline' : status === 'login' || status === 'denied' ? 'lock-closed-outline' : 'albums-outline'} size={38} color="#789DB4" />}
      <Text accessibilityRole="header" style={styles.title}>{copy.title}</Text>
      <Text style={styles.description}>{copy.description}</Text>
      <View style={styles.actions}>
        {status === 'error' && onRetry ? <PencilButton label="重新加载" onPress={onRetry} style={styles.action} /> : null}
        {status === 'login' ? <PencilButton label="去登录" onPress={() => router.push('/login')} style={styles.action} /> : null}
        <PencilButton label={backLabel} variant="secondary" onPress={() => router.replace(fallback)} style={styles.action} />
      </View>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  pageTitle: { flexShrink: 1, fontSize: 20, fontWeight: '700', color: '#493D35' },
  content: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24, paddingBottom: 48 },
  title: { fontSize: 20, lineHeight: 30, fontWeight: '700', color: '#493D35', textAlign: 'center', marginTop: 22 },
  description: { fontSize: 15, lineHeight: 24, color: '#94877C', textAlign: 'center', marginTop: 10, maxWidth: 360 },
  actions: { width: '100%', maxWidth: 300, gap: 12, marginTop: 28 },
  action: { width: '100%' },
});
