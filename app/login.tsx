import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) Alert.alert('登岛失败', error.message);
    else router.replace('/(tabs)');
    setLoading(false);
  };

  const handleSignUp = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) Alert.alert('注册失败', error.message);
    else Alert.alert('注册成功', '您的通行证已下发，请查收邮箱验证！');
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.logoBox}>
        <Text style={styles.logoEmoji}>🥔</Text>
        <Text style={styles.title}>土豆岛</Text>
        <Text style={styles.subtitle}>基因突变与财富流转的元宇宙</Text>
      </View>
      <View style={styles.form}>
        <TextInput style={styles.input} placeholder="邮箱 (通行证账号)" placeholderTextColor="#999" autoCapitalize="none" value={email} onChangeText={setEmail} />
        <TextInput style={styles.input} placeholder="密码 (密令)" placeholderTextColor="#999" secureTextEntry value={password} onChangeText={setPassword} />
        <TouchableOpacity style={styles.loginBtn} onPress={handleLogin} disabled={loading}><Text style={styles.loginText}>{loading ? '验证中...' : '登岛'}</Text></TouchableOpacity>
        <TouchableOpacity style={styles.signupBtn} onPress={handleSignUp} disabled={loading}><Text style={styles.signupText}>新岛民注册</Text></TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F6F0', justifyContent: 'center', padding: 20 },
  logoBox: { alignItems: 'center', marginBottom: 50 },
  logoEmoji: { fontSize: 80, marginBottom: 10 },
  title: { fontSize: 36, fontWeight: '900', color: '#4A2E1B', letterSpacing: 4, marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#888', fontWeight: '600' },
  form: { backgroundColor: '#FFF', padding: 24, borderRadius: 24, shadowColor: '#D49A36', shadowOpacity: 0.1, shadowRadius: 20, elevation: 5 },
  input: { backgroundColor: '#F5F5F5', padding: 16, borderRadius: 12, marginBottom: 16, fontSize: 16, color: '#333' },
  loginBtn: { backgroundColor: '#4A2E1B', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  loginText: { color: '#FFF', fontSize: 18, fontWeight: '900' },
  signupBtn: { padding: 16, alignItems: 'center', marginTop: 10 },
  signupText: { color: '#D49A36', fontSize: 16, fontWeight: '700' }
});