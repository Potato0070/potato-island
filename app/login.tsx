import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // 登录逻辑
  const handleLogin = async () => {
    if (!email || !password) return Alert.alert('提示', '请输入邮箱和密码');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    
    if (error) {
      Alert.alert('登录失败', error.message);
    } else {
      router.replace('/(tabs)/profile'); // 登录成功，回金库！
    }
  };

  // 注册逻辑（带初始化空投）
  const handleRegister = async () => {
    if (!email || !password) return Alert.alert('提示', '请输入邮箱和密码');
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email, password });
    
    if (error) {
      setLoading(false);
      return Alert.alert('注册失败', error.message);
    }

    if (data.user) {
      // 🚀 核心：新用户注册成功后，立刻在 profiles 表里给他开户，并空投 5000 体验金！
      await supabase.from('profiles').upsert({
        id: data.user.id,
        username: email.split('@')[0], // 用邮箱前缀当昵称
        potato_coin_balance: 5000
      });
      
      Alert.alert('🎉 注册成功', '身份已核验！系统已向您发放 ¥5000 土豆币新手资金！');
      router.replace('/(tabs)/profile');
    }
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backIcon}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.titleContainer}>
          <Text style={styles.mainTitle}>连接您的</Text>
          <Text style={styles.subTitle}>数字金库</Text>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>通行邮箱</Text>
            <TextInput 
              style={styles.input}
              placeholder="输入邮箱地址 (如 test@qq.com)"
              placeholderTextColor="#999"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>安全密钥</Text>
            <TextInput 
              style={styles.input}
              placeholder="输入 6 位以上密码"
              placeholderTextColor="#999"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          <TouchableOpacity 
            style={[styles.mainBtn, loading && {opacity: 0.7}]} 
            activeOpacity={0.8} 
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.mainBtnText}>登 录</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.registerBtn} onPress={handleRegister} disabled={loading}>
            <Text style={styles.registerBtnText}>首次登岛？点击注册并领取资金</Text>
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  keyboardView: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 30 },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  backIcon: { fontSize: 24, color: '#333', fontWeight: '300' },
  titleContainer: { paddingHorizontal: 30, marginBottom: 50 },
  mainTitle: { fontSize: 32, fontWeight: '300', color: '#111', marginBottom: 8 },
  subTitle: { fontSize: 36, fontWeight: '900', color: '#111' },
  formContainer: { paddingHorizontal: 30 },
  inputWrapper: { marginBottom: 24 },
  inputLabel: { fontSize: 13, fontWeight: '700', color: '#111', marginBottom: 10, letterSpacing: 1 },
  input: { backgroundColor: '#F5F6F8', height: 56, borderRadius: 12, paddingHorizontal: 16, fontSize: 16, color: '#111' },
  mainBtn: { backgroundColor: '#0066FF', height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginTop: 10, shadowColor: '#0066FF', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 15, elevation: 8 },
  mainBtnText: { color: '#FFF', fontSize: 18, fontWeight: '800', letterSpacing: 2 },
  registerBtn: { marginTop: 24, alignItems: 'center' },
  registerBtnText: { color: '#666', fontSize: 14, fontWeight: '600' }
});