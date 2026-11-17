import { makeRedirectUri } from "expo-auth-session";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Colors } from "../../constants/theme";
import { supabase } from "../../lib/supabase";

export default function ResetPasswordScreen() {
  const [email, setEmail] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPass, setShowNewPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { token_hash: tokenHash, type } = useLocalSearchParams<{
    token_hash?: string;
    type?: string;
  }>();

  useEffect(() => {
    if (!tokenHash || type !== "recovery") return;
    let active = true;
    void supabase.auth
      .verifyOtp({ token_hash: tokenHash, type: "recovery" })
      .then(({ error }) => {
        if (error) throw error;
        if (active) setRecoveryReady(true);
      })
      .catch((error: unknown) => {
        showMessage(
          "Recovery Link Invalid",
          error instanceof Error ? error.message : "Request a new password link.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [tokenHash, type]);

  function showMessage(title: string, msg: string) {
    if (Platform.OS === "web") {
      window.alert(`${title}: ${msg}`);
    } else {
      Alert.alert(title, msg);
    }
  }

  const hasMinLen = newPassword.length >= 8;
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword);

  async function handleSendRecovery() {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      return showMessage(
        "Email Required",
        "Enter your ADSSU institutional email first.",
      );
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: makeRedirectUri({
          scheme: "agrihubapp",
          path: "auth/reset-password",
        }),
      });
      if (error) throw error;
      setOtpSent(true);
      showMessage(
        "Verification Sent",
        `We sent a password recovery link to ${cleanEmail}. Open it on this device to continue.`,
      );
    } catch (error: unknown) {
      showMessage(
        "Error",
        error instanceof Error ? error.message : "Could not send the recovery email.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmReset() {
    if (!recoveryReady) {
      return showMessage(
        "Recovery Link Required",
        "Open the recovery link sent to your email first.",
      );
    }
    if (!hasMinLen || !hasNumber || !hasSymbol) {
      return showMessage(
        "Weak Password",
        "New password must have 8+ characters, at least 1 number, and 1 symbol.",
      );
    }
    if (newPassword !== confirmPassword) {
      return showMessage(
        "Mismatch",
        "New password and confirmation do not match.",
      );
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
      await supabase.auth.signOut();
      showMessage(
        "Password Recovery Complete",
        "Your password was updated. Please log in with the new password.",
      );
      router.replace("/auth/login");
    } catch (error: unknown) {
      showMessage(
        "Error",
        error instanceof Error ? error.message : "Could not update your password.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 22, paddingTop: 52, paddingBottom: 36 }}
    >
      {/* Top Row */}
      <View style={styles.topRow}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={20} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reset Password</Text>
        <View style={{ width: 38 }} />
      </View>

      {/* Shield Crest */}
      <View style={styles.iconCircle}>
        <ShieldCheck size={34} color={Colors.primary} />
        <View style={styles.lockTag}>
          <Lock size={10} color="#FFF" />
        </View>
      </View>

      <Text style={styles.title}>
        {recoveryReady ? "Choose a new password" : "Reset your password"}
      </Text>
      <Text style={styles.sub}>
        {recoveryReady
          ? "Your recovery link is verified. Set a new password below."
          : "Enter your institutional email and open the recovery link on this device."}
      </Text>

      {/* Email / Phone Field */}
      <Text style={styles.label}>Email / Institutional ID</Text>
      <View style={styles.inputBox}>
        <Mail size={16} color={Colors.textMuted} />
        <TextInput
          style={styles.input}
          placeholder="name@adssu.edu.ph"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TouchableOpacity
          style={styles.sendCodePill}
          onPress={handleSendRecovery}
          disabled={loading}
        >
          <Text style={styles.sendCodeText}>
            {otpSent ? "Resend Link" : "Send Link"}
          </Text>
        </TouchableOpacity>
      </View>

      {recoveryReady && (
        <>
      <Text style={styles.label}>New Password</Text>
      <View style={styles.inputBox}>
        <Lock size={16} color={Colors.textMuted} />
        <TextInput
          style={styles.input}
          secureTextEntry={!showNewPass}
          placeholder="••••••••"
          value={newPassword}
          onChangeText={setNewPassword}
        />
        <TouchableOpacity onPress={() => setShowNewPass(!showNewPass)}>
          {showNewPass ? (
            <EyeOff size={16} color={Colors.textMuted} />
          ) : (
            <Eye size={16} color={Colors.textMuted} />
          )}
        </TouchableOpacity>
      </View>

      {/* Confirm Password */}
      <Text style={styles.label}>Confirm Password</Text>
      <View style={styles.inputBox}>
        <Lock size={16} color={Colors.textMuted} />
        <TextInput
          style={styles.input}
          secureTextEntry={!showNewPass}
          placeholder="••••••••"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />
      </View>

      {/* Inline Validation Rules */}
      <View style={styles.inlineRules}>
        <Text style={[styles.ruleChip, hasMinLen && styles.ruleChipOk]}>
          {hasMinLen ? "✓" : "○"} 8+ characters
        </Text>
        <Text style={[styles.ruleChip, hasNumber && styles.ruleChipOk]}>
          {hasNumber ? "✓" : "○"} 1 number
        </Text>
        <Text style={[styles.ruleChip, hasSymbol && styles.ruleChipOk]}>
          {hasSymbol ? "✓" : "○"} 1 symbol
        </Text>
      </View>

      {/* Confirm CTA */}
      <TouchableOpacity
        style={[styles.btn, loading && { opacity: 0.7 }]}
        onPress={handleConfirmReset}
        disabled={loading}
      >
        <Check size={17} color="#FFF" strokeWidth={3} />
        <Text style={styles.btnText}>
          {loading ? "Processing..." : "Confirm New Password"}
        </Text>
      </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF" },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "800", color: Colors.text },

  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#DCFCE7",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 12,
    position: "relative",
  },
  lockTag: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.accent,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: Colors.text,
    textAlign: "center",
  },
  sub: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: "center",
    lineHeight: 18,
    marginTop: 4,
    marginBottom: 18,
    paddingHorizontal: 10,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.text,
    marginTop: 12,
    marginBottom: 6,
  },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 13,
    backgroundColor: Colors.background,
  },
  input: { flex: 1, paddingVertical: 12, fontSize: 14, color: Colors.text },
  sendCodePill: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  sendCodeText: { fontSize: 11, fontWeight: "800", color: Colors.primary },

  otpRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  otpBox: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "800",
    color: Colors.text,
  },
  otpBoxFilled: {
    borderColor: Colors.primary,
    backgroundColor: "#F0FDF4",
  },
  resendRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  resendHint: { fontSize: 11, color: Colors.textMuted },
  resendTimer: { fontSize: 11, fontWeight: "700", color: Colors.primary },

  inlineRules: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 10,
  },
  ruleChip: { fontSize: 11, fontWeight: "600", color: Colors.textMuted },
  ruleChipOk: { color: Colors.success, fontWeight: "700" },

  btn: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    padding: 15,
    borderRadius: 14,
    marginTop: 22,
  },
  btnText: { color: "#FFF", fontSize: 15, fontWeight: "800" },
});
