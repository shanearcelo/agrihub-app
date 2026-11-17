// src/app/auth/register.tsx
import * as Google from "expo-auth-session/providers/google";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { User as SupabaseUser } from "@supabase/supabase-js";
import {
  ArrowLeft,
  Building2,
  Check,
  ChevronDown,
  Lock,
  Mail,
  ShoppingBag,
  Sprout,
  User,
} from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { GOOGLE_AUTH_REDIRECT_OPTIONS } from "../../lib/googleAuth";
import { supabase } from "../../lib/supabase";

WebBrowser.maybeCompleteAuthSession();

const DEPARTMENTS = [
  "CCIS - Computing & Information Sciences",
  "CA - College of Agriculture",
  "CAS - College of Arts & Sciences",
  "CTE - College of Teacher Education",
  "CEIS - Engineering & Industrial Technology",
  "Admin / Campus Staff",
];

const ADMIN_EMAIL = "admin@adssu.edu.ph";

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || "";
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || "";
const GOOGLE_ANDROID_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || "";

export default function RegisterScreen() {
  const [role, setRole] = useState<"buyer" | "seller">("buyer");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState(DEPARTMENTS[0]);
  const [showDeptList, setShowDeptList] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreedTerms, setAgreedTerms] = useState(true);
  const [loading, setLoading] = useState(false);
  const pendingGooglePress = useRef(false);
  const router = useRouter();

  const hasCapital = /[A-Z]/.test(password);
  const hasSmall = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  const hasMinLen = password.length >= 8;
  const isPasswordValid =
    hasCapital && hasSmall && hasNumber && hasSpecial && hasMinLen;

  function showMessage(title: string, message: string) {
    if (Platform.OS === "web") {
      window.alert(`${title}: ${message}`);
    } else {
      Alert.alert(title, message);
    }
  }

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest(
    {
      webClientId: GOOGLE_WEB_CLIENT_ID,
      iosClientId: GOOGLE_IOS_CLIENT_ID || GOOGLE_WEB_CLIENT_ID,
      androidClientId: GOOGLE_ANDROID_CLIENT_ID || GOOGLE_WEB_CLIENT_ID,
    },
    GOOGLE_AUTH_REDIRECT_OPTIONS,
  );

  const completeGoogleRegistration = useCallback(
    async (supabaseUser: SupabaseUser) => {
      const userEmail = (supabaseUser.email || "").trim().toLowerCase();

      if (userEmail === ADMIN_EMAIL) {
        await supabase.auth.signOut();
        showMessage(
          "Restricted Account",
          "Admin accounts cannot be registered via Sign Up. Please log in directly.",
        );
        router.replace("/auth/login");
        return;
      }

      const { data: existingProfile, error } = await supabase
        .from("profiles")
        .select("id, role, department, valid_id_url, id_document_url")
        .eq("id", supabaseUser.id)
        .maybeSingle();
      if (error) throw error;

      const accountCreatedRecently =
        Date.now() - new Date(supabaseUser.created_at).getTime() < 60_000;
      if (
        existingProfile &&
        (!accountCreatedRecently || existingProfile.department)
      ) {
        const existingRole = existingProfile.role || "buyer";
        showMessage(
          "Account Already Exists",
          "You already have a registered AgriHub account. Signing you in now.",
        );
        if (
          existingRole === "seller" &&
          !(existingProfile.valid_id_url || existingProfile.id_document_url)
        ) {
          router.replace("/auth/verify-id");
        } else if (existingRole === "seller") {
          router.replace("/seller");
        } else {
          router.replace("/buyer");
        }
        return;
      }

      const { error: registrationError } = await supabase.rpc(
        "set_registration_profile",
        {
          p_role: role,
          p_full_name:
            fullName.trim() ||
            String(supabaseUser.user_metadata.full_name || "AgriHub Member"),
          p_department: department.trim(),
        },
      );
      if (registrationError) throw registrationError;

      router.replace("/auth/verify-id");
    },
    [department, fullName, role, router],
  );

  useEffect(() => {
    if (response?.type === "success") {
      const { id_token } = response.params;
      if (!id_token) {
        showMessage("Google Sign-Up Failed", "No ID token returned by Google.");
        return;
      }
      if (!request?.nonce) {
        showMessage(
          "Google Sign-Up Failed",
          "Google did not return the authentication nonce. Please try again.",
        );
        return;
      }

      supabase.auth
        .signInWithIdToken({
          provider: "google",
          token: id_token,
          access_token: response.params.access_token,
          nonce: request.nonce,
        })
        .then(({ data, error }) => {
          if (error) throw error;
          if (!data.user) throw new Error("Google did not return an account.");
          return completeGoogleRegistration(data.user);
        })
        .catch((err) =>
          showMessage(
            "Google Sign-Up Failed",
            err instanceof Error ? err.message : "Could not create your account.",
          ),
        )
        .finally(() => setLoading(false));
    } else if (response?.type === "error") {
      showMessage(
        "Google Sign-Up Error",
        response.error?.message || "Authorization was blocked or cancelled.",
      );
    }
  }, [response, request, completeGoogleRegistration]);

  useEffect(() => {
    if (request && pendingGooglePress.current) {
      pendingGooglePress.current = false;
      promptAsync()
        .catch((error: unknown) =>
          showMessage(
            "Google Sign-Up Failed",
            error instanceof Error
              ? error.message
              : "Could not open Google Sign-In.",
          ),
        )
        .finally(() => setLoading(false));
    }
  }, [request, promptAsync]);

  async function handleGoogleRegister() {
    if (!agreedTerms) {
      return showMessage(
        "Terms Required",
        "Please agree to the Terms & Conditions and ADSSU Data Privacy Policy first.",
      );
    }

    if (Platform.OS === "android" && !GOOGLE_ANDROID_CLIENT_ID) {
      showMessage(
        "Android Google Client Needed",
        "Add EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID to .env.local first.",
      );
      return;
    }

    if (Platform.OS === "ios" && !GOOGLE_IOS_CLIENT_ID) {
      showMessage(
        "iOS Google Client Needed",
        "Add EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID to .env.local first.",
      );
      return;
    }

    if (Platform.OS === "web" && !GOOGLE_WEB_CLIENT_ID) {
      showMessage(
        "Web Google Client Needed",
        "Add EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID to .env.local before using Google Sign-Up on web.",
      );
      return;
    }

    setLoading(true);
    if (!request) {
      pendingGooglePress.current = true;
      return;
    }
    promptAsync()
      .catch((error: unknown) => {
        const message =
          error instanceof Error
            ? error.message
            : "An unexpected error occurred.";
        showMessage("Google Sign-Up Failed", message);
      })
      .finally(() => setLoading(false));
  }

  async function handleRegister() {
    const cleanEmail = email.trim().toLowerCase();

    if (!fullName.trim() || !cleanEmail || !password) {
      return showMessage(
        "Missing Fields",
        "Please complete all required fields.",
      );
    }
    if (cleanEmail === ADMIN_EMAIL) {
      return showMessage(
        "Restricted Account",
        "Admin accounts cannot be registered via Sign Up. Please log in directly.",
      );
    }
    if (!isPasswordValid) {
      return showMessage(
        "Weak Password",
        "Password must be at least 8 characters with a capital letter, small letter, number, and special character.",
      );
    }
    if (password !== confirmPassword) {
      return showMessage("Password Mismatch", "Your passwords do not match.");
    }
    if (!agreedTerms) {
      return showMessage(
        "Terms Required",
        "Please agree to the Terms & Conditions and ADSSU Data Privacy Policy.",
      );
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            role,
            department: department.trim(),
          },
        },
      });
      if (error) throw error;
      if (!data.session) {
        showMessage(
          "Confirm Your Email",
          "Your account was created. Confirm the email link, then sign in to continue ID verification.",
        );
        router.replace("/auth/login");
      } else {
        router.replace("/auth/verify-id");
      }
    } catch (error: unknown) {
      showMessage(
        "Registration Failed",
        error instanceof Error ? error.message : "Something went wrong.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 20, paddingTop: 52, paddingBottom: 42 }}
    >
      {/* Top Header */}
      <View style={styles.topRow}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={20} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Account</Text>
        <Text style={styles.stepPill}>Step 1 of 2</Text>
      </View>

      {/* Role Choice (Buyer or Seller Only) */}
      <Text style={styles.label}>1. I am registering as a</Text>
      <View style={styles.roleRow}>
        <TouchableOpacity
          style={[styles.roleCard, role === "buyer" && styles.roleCardActive]}
          onPress={() => setRole("buyer")}
        >
          <View
            style={[
              styles.roleIconBox,
              role === "buyer" && { backgroundColor: Colors.primary },
            ]}
          >
            <ShoppingBag
              size={18}
              color={role === "buyer" ? "#FFF" : Colors.primary}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.roleCardTitle}>Campus Buyer</Text>
            <Text style={styles.roleCardSub}>Students, Faculty & Staff</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.roleCard, role === "seller" && styles.roleCardActive]}
          onPress={() => setRole("seller")}
        >
          <View
            style={[
              styles.roleIconBox,
              role === "seller" && { backgroundColor: Colors.primary },
            ]}
          >
            <Sprout
              size={18}
              color={role === "seller" ? "#FFF" : Colors.primary}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.roleCardTitle}>Student Seller</Text>
            <Text style={styles.roleCardSub}>Farm / Dept Unit</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Department Selector */}
      <Text style={styles.label}>
        {role === "seller" ? "2. Department / Farm Unit" : "2. Department"}
      </Text>
      <TouchableOpacity
        style={styles.deptSelector}
        onPress={() => setShowDeptList(!showDeptList)}
      >
        <Building2 size={16} color={Colors.primary} />
        <Text style={styles.deptText} numberOfLines={1}>
          {department}
        </Text>
        <ChevronDown size={16} color={Colors.textMuted} />
      </TouchableOpacity>

      {showDeptList && (
        <View style={styles.deptDropdown}>
          {DEPARTMENTS.map((dept) => (
            <TouchableOpacity
              key={dept}
              style={styles.deptOption}
              onPress={() => {
                setDepartment(dept);
                setShowDeptList(false);
              }}
            >
              <Text
                style={[
                  styles.deptOptionText,
                  department === dept && {
                    color: Colors.primary,
                    fontWeight: "800",
                  },
                ]}
              >
                {dept}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Terms & Data Privacy Checkbox */}
      <TouchableOpacity
        style={styles.termsRow}
        onPress={() => setAgreedTerms(!agreedTerms)}
      >
        <View style={[styles.checkbox, agreedTerms && styles.checkboxActive]}>
          {agreedTerms && <Check size={12} color="#FFF" strokeWidth={3} />}
        </View>
        <Text style={styles.termsText}>
          I agree to the{" "}
          <Text style={styles.termsLink}>Terms & Conditions</Text> and the{" "}
          <Text style={styles.termsLink}>ADSSU Data Privacy Policy</Text>.
        </Text>
      </TouchableOpacity>

      {/* Quick Sign Up with Google */}
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Sign up with Google"
        style={[styles.googleBtn, loading && { opacity: 0.7 }]}
        disabled={loading || (Platform.OS !== "web" && !request)}
        onPress={handleGoogleRegister}
      >
        <Text style={styles.googleG}>G</Text>
        <Text style={styles.googleText}>
          Continue with Google as{" "}
          {role === "seller" ? "Student Seller" : "Campus Buyer"}
        </Text>
      </TouchableOpacity>

      <View style={styles.dividerRow}>
        <View style={styles.line} />
        <Text style={styles.orText}>or register manually</Text>
        <View style={styles.line} />
      </View>

      {/* Full Name */}
      <Text style={styles.label}>Full Name</Text>
      <View style={styles.inputBox}>
        <User size={16} color={Colors.textMuted} />
        <TextInput
          style={styles.input}
          placeholder="e.g. James Abasula"
          value={fullName}
          onChangeText={setFullName}
        />
      </View>

      {/* Institutional Email */}
      <Text style={styles.label}>Institutional Email</Text>
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
      </View>

      {/* Create Password */}
      <Text style={styles.label}>Create Password</Text>
      <View style={styles.inputBox}>
        <Lock size={16} color={Colors.textMuted} />
        <TextInput
          style={styles.input}
          secureTextEntry
          placeholder="••••••••"
          value={password}
          onChangeText={setPassword}
        />
      </View>

      {/* Password Strength Meter & Rules */}
      <View style={styles.strengthRow}>
        <View style={styles.strengthBars}>
          <View
            style={[
              styles.bar,
              password.length > 0 && { backgroundColor: Colors.success },
            ]}
          />
          <View
            style={[
              styles.bar,
              hasCapital && hasSmall && { backgroundColor: Colors.success },
            ]}
          />
          <View
            style={[
              styles.bar,
              hasNumber && hasMinLen && { backgroundColor: Colors.success },
            ]}
          />
          <View
            style={[
              styles.bar,
              isPasswordValid && { backgroundColor: Colors.success },
            ]}
          />
        </View>
        <Text style={styles.strengthLabel}>
          {isPasswordValid ? "Strong password" : "Password rules"}
        </Text>
      </View>

      <View style={styles.rulesBox}>
        <Text style={[styles.ruleText, hasMinLen && styles.ruleValid]}>
          {hasMinLen ? "✓" : "○"} At least 8 characters
        </Text>
        <Text style={[styles.ruleText, hasCapital && styles.ruleValid]}>
          {hasCapital ? "✓" : "○"} 1 Capital letter (A–Z)
        </Text>
        <Text style={[styles.ruleText, hasSmall && styles.ruleValid]}>
          {hasSmall ? "✓" : "○"} 1 Small letter (a–z)
        </Text>
        <Text style={[styles.ruleText, hasNumber && styles.ruleValid]}>
          {hasNumber ? "✓" : "○"} 1 Number (0–9)
        </Text>
        <Text style={[styles.ruleText, hasSpecial && styles.ruleValid]}>
          {hasSpecial ? "✓" : "○"} 1 Special character (!@#$%^&*)
        </Text>
      </View>

      {/* Confirm Password */}
      <Text style={styles.label}>Confirm Password</Text>
      <View style={styles.inputBox}>
        <Lock size={16} color={Colors.textMuted} />
        <TextInput
          style={styles.input}
          secureTextEntry
          placeholder="••••••••"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />
      </View>

      {/* Submit Register Button */}
      <TouchableOpacity
        style={[styles.submitBtn, loading && { opacity: 0.7 }]}
        onPress={handleRegister}
        disabled={loading}
      >
        <Text style={styles.submitText}>
          {loading
            ? "Creating Account..."
            : `Continue to Step 2 (ID Verification) →`}
        </Text>
      </TouchableOpacity>

      <Text style={styles.footerHint}>
        Next step: Upload your ADSSU Student / Employee ID.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF" },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { fontSize: 20, fontWeight: "800", color: Colors.text },
  stepPill: {
    fontSize: 11,
    fontWeight: "800",
    color: Colors.primary,
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },

  label: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.text,
    marginTop: 12,
    marginBottom: 6,
  },
  roleRow: { flexDirection: "row", gap: 10 },
  roleCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  roleCardActive: {
    borderColor: Colors.primary,
    backgroundColor: "#F0FDF4",
  },
  roleIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#DCFCE7",
    justifyContent: "center",
    alignItems: "center",
  },
  roleCardTitle: { fontSize: 12, fontWeight: "800", color: Colors.text },
  roleCardSub: { fontSize: 10, color: Colors.textMuted, marginTop: 1 },

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
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.text,
  },

  deptSelector: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 13,
    backgroundColor: Colors.background,
  },
  deptText: { flex: 1, fontSize: 13, fontWeight: "700", color: Colors.text },
  deptDropdown: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 6,
    overflow: "hidden",
  },
  deptOption: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  deptOptionText: { fontSize: 13, color: Colors.text },

  termsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 16,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxActive: { backgroundColor: Colors.primary },
  termsText: {
    flex: 1,
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 17,
  },
  termsLink: { color: Colors.primary, fontWeight: "700" },

  googleBtn: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: "#F0FDF4",
    marginTop: 16,
  },
  googleG: { fontSize: 18, fontWeight: "900", color: "#4285F4" },
  googleText: { fontSize: 13, fontWeight: "800", color: Colors.primary },

  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 18,
    gap: 10,
  },
  line: { flex: 1, height: 1, backgroundColor: Colors.border },
  orText: { fontSize: 12, color: Colors.textMuted },

  strengthRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    gap: 10,
  },
  strengthBars: { flex: 1, flexDirection: "row", gap: 5 },
  bar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
  },
  strengthLabel: { fontSize: 11, fontWeight: "700", color: Colors.textMuted },
  rulesBox: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  ruleText: { fontSize: 11, color: Colors.textMuted },
  ruleValid: { color: Colors.success, fontWeight: "700" },

  submitBtn: {
    backgroundColor: Colors.primary,
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 20,
  },
  submitText: { color: "#FFF", fontSize: 15, fontWeight: "800" },
  footerHint: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: "center",
    marginTop: 10,
  },
});
