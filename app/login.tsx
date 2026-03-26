import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
// 🌟 修复报错：在这里引入了 ActivityIndicator
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  // 🌟 痛点修复：密码可见性切换
  const [showPassword, setShowPassword] = useState(false);
  
  // 🌟 痛点修复：实时校验错误提示
  const [emailError, setEmailError] = useState('');
  const [pwdError, setPwdError] = useState('');

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  // 🌟 核心：邮箱失焦校验 (防呆)
  const validateEmail = () => {
     if (!email) {
        setEmailError('通行证账号不能为空');
        return false;
     }
     const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
     if (!emailRegex.test(email)) {
        setEmailError('通行证账号格式不正确 (需为邮箱格式)');
        return false;
     }
     setEmailError('');
     return true;
  };

  // 🌟 核心：密码失焦校验 (防呆)
  const validatePassword = () => {
     if (!password) {
        setPwdError('密令不能为空');
        return false;
     }
     if (password.length < 6) {
        setPwdError('密令太短啦，至少需要 6 位字符');
        return false;
     }
     setPwdError('');
     return true;
  };

  const handleLogin = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const isEmailValid = validateEmail();
    const isPwdValid = validatePassword();
    if (!isEmailValid || !isPwdValid) return;
    
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
       Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
       let errorMsg = error.message;
       if (errorMsg.includes('Invalid login credentials')) {
          errorMsg = '账号暂未注册或密令错误！';
       } else if (errorMsg.includes('Email not confirmed')) {
          errorMsg = '邮箱尚未验证，请前往邮箱点击确认链接！';
       }
       showToast(`❌ 登岛失败: ${errorMsg}`);
    } else {
       Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
       showToast('✅ 验证通过，正在为您接入土豆岛...');
       setTimeout(() => router.replace('/(tabs)'), 1000);
    }
    setLoading(false);
  };

  const handleSignUp = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const isEmailValid = validateEmail();
    const isPwdValid = validatePassword();
    if (!isEmailValid || !isPwdValid) return;

    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    
    if (error) {
       Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
       let errorMsg = error.message;
       if (errorMsg.includes('User already registered')) {
          errorMsg = '该通行证已被注册，请直接登岛！';
       }
       showToast(`❌ 注册失败: ${errorMsg}`);
    } else {
       Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
       showToast('🎉 注册成功！若后台未开启强制验证，您现在可直接登岛！');
    }
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      {toastMsg ? <View style={styles.toastBox}><Text style={styles.toastText}>{toastMsg}</Text></View> : null}

      <View style={styles.logoBox}>
        <Text style={styles.logoEmoji}>🥔</Text>
        <Text style={styles.title}>土豆岛</Text>
        <Text style={styles.subtitle}>基因突变与财富流转的元宇宙</Text>
      </View>
      
      <View style={styles.form}>
        {/* 🌟 邮箱输入与失焦校验 */}
        <View style={styles.inputWrapper}>
           <TextInput 
              style={[styles.input, emailError ? styles.inputError : null]} 
              placeholder="邮箱 (通行证账号)" 
              placeholderTextColor="#A1887F" 
              autoCapitalize="none" 
              keyboardType="email-address"
              value={email} 
              onChangeText={(text) => { setEmail(text); if (emailError) setEmailError(''); }} 
              onBlur={validateEmail}
           />
        </View>
        {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}

        {/* 🌟 密码输入与小眼睛切换 */}
        <View style={styles.inputWrapper}>
           <TextInput 
              style={[styles.input, pwdError ? styles.inputError : null, {paddingRight: 50}]} 
              placeholder="密码 (密令)" 
              placeholderTextColor="#A1887F" 
              secureTextEntry={!showPassword} 
              value={password} 
              onChangeText={(text) => { setPassword(text); if (pwdError) setPwdError(''); }} 
              onBlur={validatePassword}
           />
           <TouchableOpacity 
              style={styles.eyeBtn} 
              onPress={() => { Haptics.selectionAsync(); setShowPassword(!showPassword); }}
           >
              <Text style={{fontSize: 20}}>{showPassword ? '🫣' : '👁️'}</Text>
           </TouchableOpacity>
        </View>
        {pwdError ? <Text style={styles.errorText}>{pwdError}</Text> : null}
        
        <TouchableOpacity style={styles.loginBtn} onPress={handleLogin} disabled={loading}>
           {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.loginText}>登岛</Text>}
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.signupBtn} onPress={handleSignUp} disabled={loading}>
           <Text style={styles.signupText}>新岛民注册</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDF8F0', justifyContent: 'center', padding: 20 },
  
  toastBox: { position: 'absolute', top: 60, alignSelf: 'center', backgroundColor: 'rgba(78,52,46,0.9)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20, zIndex: 100 },
  toastText: { color: '#FFF', fontSize: 14, fontWeight: '700', textAlign: 'center' },

  logoBox: { alignItems: 'center', marginBottom: 50 },
  logoEmoji: { fontSize: 80, marginBottom: 10 },
  title: { fontSize: 36, fontWeight: '900', color: '#4E342E', letterSpacing: 4, marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#8D6E63', fontWeight: '700' },
  
  form: { backgroundColor: '#FFF', padding: 24, borderRadius: 24, shadowColor: '#4E342E', shadowOpacity: 0.05, shadowRadius: 20, elevation: 5, borderWidth: 1, borderColor: '#EAE0D5' },
  
  inputWrapper: { position: 'relative', marginBottom: 8 },
  input: { backgroundColor: '#FDF8F0', padding: 16, borderRadius: 12, fontSize: 16, color: '#4E342E', borderWidth: 1, borderColor: '#EAE0D5', fontWeight: '700' },
  inputError: { borderColor: '#FF3B30', backgroundColor: '#FFF0F0' },
  errorText: { color: '#FF3B30', fontSize: 12, fontWeight: '700', marginBottom: 12, marginLeft: 4, marginTop: -4 },
  
  eyeBtn: { position: 'absolute', right: 16, top: 16, zIndex: 10 },

  loginBtn: { backgroundColor: '#D49A36', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 16, shadowColor: '#D49A36', shadowOpacity: 0.3, shadowRadius: 8, elevation: 2 },
  loginText: { color: '#FFF', fontSize: 18, fontWeight: '900', letterSpacing: 2 },
  signupBtn: { padding: 16, alignItems: 'center', marginTop: 10 },
  signupText: { color: '#D49A36', fontSize: 15, fontWeight: '800' }
});