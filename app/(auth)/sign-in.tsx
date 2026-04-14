import { useSignIn } from '@clerk/expo';
import { Link } from 'expo-router';
import { styled } from 'nativewind';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';

const SafeAreaView = styled(RNSafeAreaView);

const SignIn = () => {
  const { signIn, errors, fetchStatus } = useSignIn();

  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [mfaMethod, setMfaMethod] = useState<
    'phone_code' | 'totp' | 'backup_code' | null
  >(null);
  const [mfaError, setMfaError] = useState<string | null>(null);

  // Validation states
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  // Client-side validation
  const emailValid =
    emailAddress.length === 0 ||
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress);
  const passwordValid = password.length > 0;
  const formValid =
    emailAddress.length > 0 && password.length > 0 && emailValid;

  const handleSubmit = async () => {
    if (!formValid) return;

    const { error } = await signIn.password({
      emailAddress,
      password,
    });

    if (error) {
      console.error(JSON.stringify(error, null, 2));
      return;
    }

    if (signIn.status === 'complete') {
      await signIn.finalize();
    } else if (signIn.status === 'needs_second_factor') {
      // Detect available MFA methods and set the first available one
      const availableMethods = signIn.supportedSecondFactors;
      const phoneCodeFactor = availableMethods.find(
        (factor) => factor.strategy === 'phone_code',
      );
      const totpFactor = availableMethods.find(
        (factor) => factor.strategy === 'totp',
      );
      const backupCodeFactor = availableMethods.find(
        (factor) => factor.strategy === 'backup_code',
      );

      // Default to phone code if available, otherwise TOTP, otherwise backup code
      if (phoneCodeFactor) {
        setMfaMethod('phone_code');
        await signIn.mfa.sendPhoneCode();
      } else if (totpFactor) {
        setMfaMethod('totp');
      } else if (backupCodeFactor) {
        setMfaMethod('backup_code');
      }
    } else if (signIn.status === 'needs_client_trust') {
      // Send email code for client trust verification
      const emailCodeFactor = signIn.supportedSecondFactors.find(
        (factor) => factor.strategy === 'email_code',
      );

      if (emailCodeFactor) {
        await signIn.mfa.sendEmailCode();
      }
    } else {
      console.error('Sign-in attempt not complete:', signIn);
    }
  };

  const handleVerify = async () => {
    await signIn.mfa.verifyEmailCode({ code });

    if (signIn.status === 'complete') {
      await signIn.finalize();
    } else {
      console.error('Sign-in attempt not complete:', signIn);
    }
  };

  const handleMFAVerify = async () => {
    if (!code || !mfaMethod) return;

    try {
      setMfaError(null);

      if (mfaMethod === 'phone_code') {
        const { error } = await signIn.mfa.verifyPhoneCode({ code });
        if (error) {
          setMfaError(error.message || 'Invalid verification code');
          return;
        }
      } else if (mfaMethod === 'totp') {
        const { error } = await signIn.mfa.verifyTOTP({ code });
        if (error) {
          setMfaError(error.message || 'Invalid authentication code');
          return;
        }
      } else if (mfaMethod === 'backup_code') {
        const { error } = await signIn.mfa.verifyBackupCode({ code });
        if (error) {
          setMfaError(error.message || 'Invalid backup code');
          return;
        }
      }

      if (signIn.status === 'complete') {
        await signIn.finalize();
      } else {
        setMfaError('Verification failed. Please try again.');
      }
    } catch (err) {
      const error = err as any;
      setMfaError(error?.message || 'An error occurred during verification');
    }
  };

  // Show verification screen if client trust is needed
  if (signIn.status === 'needs_client_trust') {
    return (
      <SafeAreaView className="auth-safe-area">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="auth-screen"
        >
          <ScrollView
            className="auth-scroll"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View className="auth-content">
              {/* Branding */}
              <View className="auth-brand-block">
                <View className="auth-logo-wrap">
                  <View className="auth-logo-mark">
                    <Text className="auth-logo-mark-text">R</Text>
                  </View>
                  <View>
                    <Text className="auth-wordmark">Recurrly</Text>
                    <Text className="auth-wordmark-sub">SUBSCRIPTIONS</Text>
                  </View>
                </View>
                <Text className="auth-title">Verify your identity</Text>
                <Text className="auth-subtitle">
                  We sent a verification code to your email
                </Text>
              </View>

              {/* Verification Form */}
              <View className="auth-card">
                <View className="auth-form">
                  <View className="auth-field">
                    <Text className="auth-label">Verification Code</Text>
                    <TextInput
                      className="auth-input"
                      value={code}
                      placeholder="Enter 6-digit code"
                      placeholderTextColor="rgba(0, 0, 0, 0.4)"
                      onChangeText={setCode}
                      keyboardType="number-pad"
                      autoComplete="one-time-code"
                      maxLength={6}
                    />
                    {errors.fields.code && (
                      <Text className="auth-error">
                        {errors.fields.code.message}
                      </Text>
                    )}
                  </View>

                  <Pressable
                    className={`auth-button ${(!code || fetchStatus === 'fetching') && 'auth-button-disabled'}`}
                    onPress={handleVerify}
                    disabled={!code || fetchStatus === 'fetching'}
                  >
                    <Text className="auth-button-text">
                      {fetchStatus === 'fetching' ? 'Verifying...' : 'Verify'}
                    </Text>
                  </Pressable>

                  <Pressable
                    className="auth-secondary-button"
                    onPress={() => signIn.mfa.sendEmailCode()}
                    disabled={fetchStatus === 'fetching'}
                  >
                    <Text className="auth-secondary-button-text">
                      Resend Code
                    </Text>
                  </Pressable>

                  <Pressable
                    className="auth-secondary-button"
                    onPress={() => signIn.reset()}
                    disabled={fetchStatus === 'fetching'}
                  >
                    <Text className="auth-secondary-button-text">
                      Start Over
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // Show MFA verification screen if second factor is needed
  if (signIn.status === 'needs_second_factor') {
    const getMFATitle = () => {
      switch (mfaMethod) {
        case 'phone_code':
          return 'Verify with SMS';
        case 'totp':
          return 'Verify with Authenticator App';
        case 'backup_code':
          return 'Verify with Backup Code';
        default:
          return 'Two-Factor Authentication';
      }
    };

    const getMFAPlaceholder = () => {
      switch (mfaMethod) {
        case 'phone_code':
          return 'Enter 6-digit SMS code';
        case 'totp':
          return 'Enter 6-digit authenticator code';
        case 'backup_code':
          return 'Enter backup code';
        default:
          return 'Enter code';
      }
    };

    return (
      <SafeAreaView className="auth-safe-area">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="auth-screen"
        >
          <ScrollView
            className="auth-scroll"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View className="auth-content">
              {/* Branding */}
              <View className="auth-brand-block">
                <View className="auth-logo-wrap">
                  <View className="auth-logo-mark">
                    <Text className="auth-logo-mark-text">R</Text>
                  </View>
                  <View>
                    <Text className="auth-wordmark">Recurrly</Text>
                    <Text className="auth-wordmark-sub">SUBSCRIPTIONS</Text>
                  </View>
                </View>
                <Text className="auth-title">{getMFATitle()}</Text>
                <Text className="auth-subtitle">
                  {mfaMethod === 'phone_code'
                    ? 'Enter the code sent to your phone'
                    : mfaMethod === 'totp'
                      ? 'Enter the code from your authenticator app'
                      : 'Enter one of your backup codes'}
                </Text>
              </View>

              {/* MFA Verification Form */}
              <View className="auth-card">
                <View className="auth-form">
                  <View className="auth-field">
                    <Text className="auth-label">
                      {mfaMethod === 'phone_code' && 'SMS Code'}
                      {mfaMethod === 'totp' && 'Authenticator Code'}
                      {mfaMethod === 'backup_code' && 'Backup Code'}
                    </Text>
                    <TextInput
                      className="auth-input"
                      value={code}
                      placeholder={getMFAPlaceholder()}
                      placeholderTextColor="rgba(0, 0, 0, 0.4)"
                      onChangeText={setCode}
                      keyboardType="number-pad"
                      autoComplete="one-time-code"
                      maxLength={mfaMethod === 'backup_code' ? 20 : 6}
                    />
                    {mfaError && <Text className="auth-error">{mfaError}</Text>}
                  </View>

                  <Pressable
                    className={`auth-button ${(!code || fetchStatus === 'fetching') && 'auth-button-disabled'}`}
                    onPress={handleMFAVerify}
                    disabled={!code || fetchStatus === 'fetching'}
                  >
                    <Text className="auth-button-text">
                      {fetchStatus === 'fetching' ? 'Verifying...' : 'Verify'}
                    </Text>
                  </Pressable>

                  {mfaMethod === 'phone_code' && (
                    <Pressable
                      className="auth-secondary-button"
                      onPress={() => {
                        setCode('');
                        setMfaError(null);
                        signIn.mfa.sendPhoneCode();
                      }}
                      disabled={fetchStatus === 'fetching'}
                    >
                      <Text className="auth-secondary-button-text">
                        Resend Code
                      </Text>
                    </Pressable>
                  )}

                  {signIn.supportedSecondFactors.length > 1 && (
                    <Pressable
                      className="auth-secondary-button"
                      onPress={() => {
                        setCode('');
                        setMfaError(null);
                        // Cycle through available methods
                        const availableMethods = signIn.supportedSecondFactors;
                        const currentIndex = availableMethods.findIndex(
                          (f) => f.strategy === mfaMethod,
                        );
                        const nextIndex =
                          (currentIndex + 1) % availableMethods.length;
                        const nextMethod = availableMethods[nextIndex]
                          .strategy as 'phone_code' | 'totp' | 'backup_code';
                        setMfaMethod(nextMethod);

                        if (nextMethod === 'phone_code') {
                          signIn.mfa.sendPhoneCode();
                        }
                      }}
                      disabled={fetchStatus === 'fetching'}
                    >
                      <Text className="auth-secondary-button-text">
                        Use Different Method
                      </Text>
                    </Pressable>
                  )}

                  <Pressable
                    className="auth-secondary-button"
                    onPress={() => signIn.reset()}
                    disabled={fetchStatus === 'fetching'}
                  >
                    <Text className="auth-secondary-button-text">
                      Start Over
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // Main sign-in form
  return (
    <SafeAreaView className="auth-safe-area">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="auth-screen"
      >
        <ScrollView
          className="auth-scroll"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="auth-content">
            {/* Branding */}
            <View className="auth-brand-block">
              <View className="auth-logo-wrap">
                <View className="auth-logo-mark">
                  <Text className="auth-logo-mark-text">R</Text>
                </View>
                <View>
                  <Text className="auth-wordmark">Recurrly</Text>
                  <Text className="auth-wordmark-sub">SUBSCRIPTIONS</Text>
                </View>
              </View>
              <Text className="auth-title">Welcome back</Text>
              <Text className="auth-subtitle">
                Sign in to continue managing your subscriptions
              </Text>
            </View>

            {/* Sign-In Form */}
            <View className="auth-card">
              <View className="auth-form">
                <View className="auth-field">
                  <Text className="auth-label">Email Address</Text>
                  <TextInput
                    className={`auth-input ${emailTouched && !emailValid && 'auth-input-error'}`}
                    autoCapitalize="none"
                    value={emailAddress}
                    placeholder="name@example.com"
                    placeholderTextColor="rgba(0, 0, 0, 0.4)"
                    onChangeText={setEmailAddress}
                    onBlur={() => setEmailTouched(true)}
                    keyboardType="email-address"
                    autoComplete="email"
                  />
                  {emailTouched && !emailValid && (
                    <Text className="auth-error">
                      Please enter a valid email address
                    </Text>
                  )}
                  {errors.fields.identifier && (
                    <Text className="auth-error">
                      {errors.fields.identifier.message}
                    </Text>
                  )}
                </View>

                <View className="auth-field">
                  <Text className="auth-label">Password</Text>
                  <TextInput
                    className={`auth-input ${passwordTouched && !passwordValid && 'auth-input-error'}`}
                    value={password}
                    placeholder="Enter your password"
                    placeholderTextColor="rgba(0, 0, 0, 0.4)"
                    secureTextEntry
                    onChangeText={setPassword}
                    onBlur={() => setPasswordTouched(true)}
                    autoComplete="password"
                  />
                  {passwordTouched && !passwordValid && (
                    <Text className="auth-error">Password is required</Text>
                  )}
                  {errors.fields.password && (
                    <Text className="auth-error">
                      {errors.fields.password.message}
                    </Text>
                  )}
                </View>

                <Pressable
                  className={`auth-button ${(!formValid || fetchStatus === 'fetching') && 'auth-button-disabled'}`}
                  onPress={handleSubmit}
                  disabled={!formValid || fetchStatus === 'fetching'}
                >
                  <Text className="auth-button-text">
                    {fetchStatus === 'fetching' ? 'Signing In...' : 'Sign In'}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Sign-Up Link */}
            <View className="auth-link-row">
              <Text className="auth-link-copy">Don't have an account?</Text>
              <Link href="/(auth)/sign-up" asChild>
                <Pressable>
                  <Text className="auth-link">Create Account</Text>
                </Pressable>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default SignIn;
