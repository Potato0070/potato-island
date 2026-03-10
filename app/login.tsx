import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  const handleLogin = async () => {
    if (!email || !password) return showToast('⚠️ 请输入通行证账号和密码！');
    
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
       // 🌟 核心：翻译生涩的英文报错，让玩家看得懂
       let errorMsg = error.message;
       if (errorMsg.includes('Invalid login credentials')) {
          errorMsg = '账号暂未注册或密令错误！';
       } else if (errorMsg.includes('Email not confirmed')) {
          errorMsg = '邮箱尚未验证，请前往邮箱点击确认链接！';
       }
       showToast(`❌ 登岛失败: ${errorMsg}`);
    } else {
       showToast('✅ 验证通过，正在为您接入土豆岛...');
       setTimeout(() => router.replace('/(tabs)'), 1000);
    }
    setLoading(false);
  };

  const handleSignUp = async () => {
    if (!email || !password) return showToast('⚠️ 请输入要注册的账号和密码！');
    if (password.length < 6) return showToast('⚠️ 密令太短啦，至少需要 6 位字符！');

    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    
    if (error) {
       let errorMsg = error.message;
       if (errorMsg.includes('User already registered')) {
          errorMsg = '该通行证已被注册，请直接登岛！';
       }
       showToast(`❌ 注册失败: ${errorMsg}`);
    } else {
       showToast('🎉 注册成功！若后台未开启强制邮箱验证，您现在可直接登岛！');
    }
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 🌟 全局悬浮提示 */}
      {toastMsg ? <View style={styles.toastBox}><Text style={styles.toastText}>{toastMsg}</Text></View> : null}

      <View style={styles.logoBox}>
        <Text style={styles.logoEmoji}>🥔</Text>
        <Text style={styles.title}>土豆岛</Text>
        <Text style={styles.subtitle}>基因突变与财富流转的元宇宙</Text>
      </View>
      
      <View style={styles.form}>
        <TextInput 
           style={styles.input} 
           placeholder="邮箱 (通行证账号)" 
           placeholderTextColor="#999" 
           autoCapitalize="none" 
           value={email} 
           onChangeText={setEmail} 
        />
        <TextInput 
           style={styles.input} 
           placeholder="密码 (密令)" 
           placeholderTextColor="#999" 
           secureTextEntry 
           value={password} 
           onChangeText={setPassword} 
        />
        
        <TouchableOpacity style={styles.loginBtn} onPress={handleLogin} disabled={loading}>
           <Text style={styles.loginText}>{loading ? '网络连接中...' : '登岛'}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.signupBtn} onPress={handleSignUp} disabled={loading}>
           <Text style={styles.signupText}>新岛民注册</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F6F0', justifyContent: 'center', padding: 20 },
  
  toastBox: { position: 'absolute', top: 60, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.8)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20, zIndex: 100 },
  toastText: { color: '#FFF', fontSize: 14, fontWeight: '700', textAlign: 'center' },

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