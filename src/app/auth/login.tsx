// src/app/auth/login.tsx
import * as Google from "expo-auth-session/providers/google";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { User } from "@supabase/supabase-js";
import { Eye, EyeOff, Lock, Mail } from "lucide-react-native";
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
import { BrandLogo } from "../../components/BrandLogo";
import { Colors } from "../../constants/theme";
import { GOOGLE_AUTH_REDIRECT_OPTIONS } from "../../lib/googleAuth";
import { supabase } from "../../lib/supabase";

WebBrowser.maybeCompleteAuthSession();

// Single designated institutional Admin email
const ADMIN_EMAIL = "admin@adssu.edu.ph";

function getAuthErrorMessage(error: unknown): string {
  const authErrorMap: Record<string, string> = {
    invalid_credentials: "Incorrect email or password. Please try again.",
    email_not_confirmed: "Please confirm your email before signing in.",
    too_many_requests: "Too many attempts. Please try again later.",
    user_already_exists: "An account already exists for this email.",
  };

  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code: string }).code;
    if (authErrorMap[code]) return authErrorMap[code];
  }

  if (error instanceof Error) {
    if (/network|fetch/i.test(error.message)) {
      return "Network error. Check your connection and try again.";
    }
  }

  return "Login failed. Please check your credentials.";
}

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || "";
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || "";
const GOOGLE_ANDROID_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || "";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const pendingGooglePress = useRef(false);
  const router = useRouter();

  const routeByRole = useCallback(
    (userRole: string) => {
      if (userRole === "admin") router.replace("/admin");
      else if (userRole === "seller") router.replace("/seller");
      else router.replace("/buyer");
    },
    [router],
  );

  function showMessage(title: string, msg: string) {
    if (Platform.OS === "web") {
      window.alert(`${title}: ${msg}`);
    } else {
      Alert.alert(title, msg);
    }
  }

  const handleSupabaseUser = useCallback(
    async (supabaseUser: User) => {
      const userEmail = (supabaseUser.email || "").toLowerCase();
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role, valid_id_url, id_document_url")
        .eq("id", supabaseUser.id)
        .maybeSingle();
      if (error) throw error;

      // Block unregistered accounts from logging in directly
      if (!profile) {
        await supabase.auth.signOut();
        if (userEmail === ADMIN_EMAIL) {
          showMessage(
            "Admin Account Not Configured",
            `Create or invite ${ADMIN_EMAIL} in Supabase Auth, then run the AgriHub migration so its admin profile is created.`,
          );
          return;
        }
        showMessage(
          "Account Not Found",
          "This account is not registered in AgriHub yet. Please create an account first.",
        );
        router.push("/auth/register");
        return;
      }

      if (userEmail === ADMIN_EMAIL && profile.role !== "admin") {
        await supabase.auth.signOut();
        showMessage(
          "Admin Role Not Configured",
          `The profile for ${ADMIN_EMAIL} does not have the admin role. Have the project owner correct it in the Supabase SQL Editor.`,
        );
        return;
      }

      // If a Student Seller hasn't completed Step 2 (ID Upload), send them there
      if (
        profile.role === "seller" &&
        !(profile.valid_id_url || profile.id_document_url)
      ) {
        router.replace("/auth/verify-id");
        return;
      }

      routeByRole(profile.role || "buyer");
    },
    [routeByRole, router],
  );

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest(
    {
      webClientId: GOOGLE_WEB_CLIENT_ID,
      iosClientId: GOOGLE_IOS_CLIENT_ID || GOOGLE_WEB_CLIENT_ID,
      androidClientId: GOOGLE_ANDROID_CLIENT_ID || GOOGLE_WEB_CLIENT_ID,
    },
    GOOGLE_AUTH_REDIRECT_OPTIONS,
  );

  useEffect(() => {
    if (response?.type === "success") {
      const { id_token } = response.params;
      if (!id_token) {
        showMessage("Google Sign-In Failed", "No ID token returned by Google.");
        return;
      }
      if (!request?.nonce) {
        showMessage(
          "Google Sign-In Failed",
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
          return handleSupabaseUser(data.user);
        })
        .catch((err) =>
          showMessage("Google Sign-In Failed", getAuthErrorMessage(err)),
        )
        .finally(() => setLoading(false));
    } else if (response?.type === "error") {
      showMessage(
        "Google Sign-In Error",
        response.error?.message || "Authorization was blocked or cancelled.",
      );
    }
  }, [response, request, handleSupabaseUser]);

  // Track when the OAuth request object becomes ready on native
  useEffect(() => {
    if (request) {
      // If the user pressed the button before `request` was ready, fire now
      if (pendingGooglePress.current) {
        pendingGooglePress.current = false;
        promptAsync().catch((error: unknown) => {
          showMessage("Google Sign-In Failed", getAuthErrorMessage(error));
        }).finally(() => setLoading(false));
      }
    }
  }, [request, promptAsync]);

  async function handleLogin() {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      return showMessage(
        "Missing Fields",
        "Please enter your Institutional Email and Password.",
      );
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });
      if (error) throw error;
      if (!data.user) throw new Error("No account was returned.");
      await handleSupabaseUser(data.user);
    } catch (error: unknown) {
      showMessage("Login Failed", getAuthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleGooglePress() {
    if (Platform.OS === "web" && !GOOGLE_WEB_CLIENT_ID) {
      showMessage(
        "Web Google Client Needed",
        "Add EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID to .env.local before using Google Sign-In on web.",
      );
      return;
    }

    if (Platform.OS === "android" && !GOOGLE_ANDROID_CLIENT_ID) {
      showMessage(
        "Android Google Client Needed",
        "Create an Android OAuth Client ID in Google Cloud Console (package: com.babyshane.agrihubapp) and add EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID to .env.local.",
      );
      return;
    }

    if (Platform.OS === "ios" && !GOOGLE_IOS_CLIENT_ID) {
      showMessage(
        "iOS Google Client Needed",
        "Create an iOS OAuth Client ID in Google Cloud Console (bundle ID: com.babyshane.agrihubapp) and add EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID to .env.local.",
      );
      return;
    }

    setLoading(true);
    if (!request) {
      pendingGooglePress.current = true;
      return;
    }
    promptAsync()
      .catch((error: unknown) =>
        showMessage("Google Sign-In Failed", getAuthErrorMessage(error)),
      )
      .finally(() => setLoading(false));
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 32 }}
      bounces={false}
    >
      {/* Green Header Banner */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <BrandLogo size={42} />
          <View>
            <Text style={styles.brandName}>AgriHub</Text>
            <Text style={styles.brandSub}>Presko, Barato, Tatak ADSSU</Text>
          </View>
        </View>
        <Text style={styles.welcome}>Welcome back!</Text>
        <Text style={styles.welcomeSub}>
          Log in with your registered institutional account.
        </Text>
      </View>

      {/* Form Container */}
      <View style={styles.formCard}>
        <Text style={styles.label}>Email / Institutional Email</Text>
        <View style={styles.inputBox}>
          <Mail size={18} color={Colors.textMuted} />
          <TextInput
            style={styles.input}
            placeholder="name@adssu.edu.ph"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        <Text style={styles.label}>Password</Text>
        <View style={styles.inputBox}>
          <Lock size={18} color={Colors.textMuted} />
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            secureTextEntry={!showPass}
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity onPress={() => setShowPass(!showPass)}>
            {showPass ? (
              <EyeOff size={18} color={Colors.textMuted} />
            ) : (
              <Eye size={18} color={Colors.textMuted} />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.optionsRow}>
          <TouchableOpacity
            style={styles.rememberRow}
            onPress={() => setRememberMe(!rememberMe)}
          >
            <View
              style={[styles.checkbox, rememberMe && styles.checkboxActive]}
            >
              {rememberMe && (
                <Text
                  style={{ color: "#FFF", fontSize: 11, fontWeight: "800" }}
                >
                  ✓
                </Text>
              )}
            </View>
            <Text style={styles.rememberText}>Remember me</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push("/auth/reset-password")}>
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.loginBtn}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.loginText}>
            {loading ? "Logging in..." : "Log in"}
          </Text>
        </TouchableOpacity>

        <View style={styles.dividerRow}>
          <View style={styles.line} />
          <Text style={styles.orText}>or log in with</Text>
          <View style={styles.line} />
        </View>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Continue with Google"
          style={styles.googleBtn}
          disabled={loading || (Platform.OS !== "web" && !request)}
          onPress={handleGooglePress}
        >
          <Text style={styles.googleG}>G</Text>
          <Text style={styles.googleText}>Continue with Google</Text>
        </TouchableOpacity>

        {/* Sign Up Section */}
        <View style={styles.signupBox}>
          <Text style={styles.noAccountText}>{"Don't have an account?"}</Text>
          <TouchableOpacity
            style={styles.signupBtn}
            onPress={() => router.push("/auth/register")}
          >
            <Text style={styles.signupBtnText}>Sign Up</Text>
          </TouchableOpacity>
          <Text style={styles.termsHint}>
            By signing in, you agree to the Campus Marketplace Terms.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF" },
  header: {
    backgroundColor: Colors.primary,
    paddingTop: 56,
    paddingBottom: 32,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 20,
  },
  brandName: { color: "#FFF", fontSize: 18, fontWeight: "800" },
  brandSub: { color: "#FDE68A", fontSize: 11, fontWeight: "600" },
  welcome: { color: "#FFF", fontSize: 26, fontWeight: "800" },
  welcomeSub: { color: "#D8F3DC", fontSize: 13, marginTop: 4 },
  formCard: { padding: 24 },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.text,
    marginTop: 12,
    marginBottom: 6,
  },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: Colors.background,
    gap: 10,
  },
  input: { flex: 1, paddingVertical: 13, fontSize: 14, color: Colors.text },
  optionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
  },
  rememberRow: { flexDirection: "row", alignItems: "center", gap: 8 },
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
  rememberText: { fontSize: 12, color: Colors.textMuted, fontWeight: "600" },
  forgotText: { fontSize: 12, color: Colors.primary, fontWeight: "700" },
  loginBtn: {
    backgroundColor: Colors.primary,
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 20,
  },
  loginText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 18,
    gap: 10,
  },
  line: { flex: 1, height: 1, backgroundColor: Colors.border },
  orText: { fontSize: 12, color: Colors.textMuted },
  googleBtn: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: "#FFF",
  },
  googleG: { fontSize: 18, fontWeight: "900", color: "#4285F4" },
  googleText: { fontSize: 14, fontWeight: "700", color: Colors.text },
  signupBox: {
    marginTop: 24,
    alignItems: "center",
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  noAccountText: { fontSize: 12, color: Colors.textMuted, marginBottom: 10 },
  signupBtn: {
    width: "100%",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    alignItems: "center",
  },
  signupBtnText: { fontSize: 15, fontWeight: "800", color: Colors.primary },
  termsHint: {
    fontSize: 10,
    color: Colors.textMuted,
    textAlign: "center",
    marginTop: 10,
  },
});
