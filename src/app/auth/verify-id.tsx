// src/app/auth/verify-id.tsx
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import {
    Camera,
    CheckCircle2,
    LogOut,
    RotateCcw,
    ShieldCheck,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { Colors } from "../../constants/theme";
import { getCurrentUser } from "../../lib/authHelpers";
import { supabase } from "../../lib/supabase";
import { uploadPrivateImageToSupabase } from "../../lib/uploadImageToSupabase";

export default function VerifyIdScreen() {
  const [role, setRole] = useState<"buyer" | "seller">("buyer");
  const [fullName, setFullName] = useState("");
  const [idImage, setIdImage] = useState<string | null>(null);
  const [idFileName, setIdFileName] = useState("ID_front_2026.jpg");
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  function showMessage(title: string, message: string) {
    if (Platform.OS === "web") {
      window.alert(`${title}: ${message}`);
    } else {
      Alert.alert(title, message);
    }
  }

  useEffect(() => {
    async function loadUserProfile() {
      try {
        const currentUser = await getCurrentUser();
        if (!currentUser) {
          router.replace("/auth/login");
          return;
        }
        const { data, error } = await supabase
          .from("profiles")
          .select("role, full_name")
          .eq("id", currentUser.id)
          .maybeSingle();
        if (error) throw error;
        setRole(data?.role === "seller" ? "seller" : "buyer");
        setFullName(data?.full_name || "");
      } catch (err) {
        console.error("Failed to load profile:", err);
      } finally {
        setLoadingProfile(false);
      }
    }
    loadUserProfile();
  }, [router]);

  async function pickIdPhoto() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
    });
    if (!res.canceled && res.assets?.length > 0) {
      const asset = res.assets[0];
      setIdImage(asset.uri);
      setIdFileName(asset.fileName || "ID_front_2026.jpg");
    }
  }

  async function handleSubmitId() {
    let currentUser;
    try {
      currentUser = await getCurrentUser();
    } catch (error) {
      showMessage(
        "Account Error",
        error instanceof Error ? error.message : "Could not read your session.",
      );
      return;
    }
    if (!currentUser) {
      router.replace("/auth/login");
      return;
    }

    if (!idImage) {
      return showMessage(
        "ID Required",
        role === "seller"
          ? "Student Sellers / Dept Units must upload their Student or Employee ID for Admin verification."
          : "Please select an ID photo first, or tap 'Skip for Now' below.",
      );
    }

    setSubmitting(true);
    try {
      const validIdPath = await uploadPrivateImageToSupabase(
        idImage,
        "valid-ids",
        `${currentUser.id}/${Date.now()}.jpg`,
      );

      const { error } = await supabase.rpc("submit_valid_id", {
        p_path: validIdPath,
      });
      if (error) throw error;

      showMessage(
        "ID Uploaded!",
        role === "seller"
          ? "Your Student Seller ID has been submitted for Admin verification."
          : "Your Campus ID has been uploaded! Welcome to AgriHub.",
      );

      if (role === "seller") router.replace("/seller");
      else router.replace("/buyer");
    } catch (uploadErr: unknown) {
      showMessage(
        "Image Upload Failed",
        uploadErr instanceof Error
          ? uploadErr.message
          : "Could not upload the selected ID image.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleSkip() {
    showMessage(
      "Welcome to AgriHub!",
      "You can browse and pre-order fresh harvests right away.",
    );
    router.replace("/buyer");
  }

  async function handleSwitchAccount() {
    await supabase.auth.signOut();
    router.replace("/auth/login");
  }

  if (loadingProfile) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 20, paddingTop: 52, paddingBottom: 42 }}
    >
      {/* Top Header */}
      <View style={styles.topRow}>
        <View style={{ width: 38 }} />
        <Text style={styles.headerTitle}>ID Verification</Text>
        <Text style={styles.stepPill}>Step 2 of 2</Text>
      </View>

      {/* Info Banner */}
      <View style={styles.infoCard}>
        <View style={styles.shieldCircle}>
          <ShieldCheck size={24} color={Colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.infoTitle}>
            {fullName ? `Almost done, ${fullName}!` : "Almost done!"}
          </Text>
          <Text style={styles.infoDesc}>
            {role === "seller"
              ? "As a Student Seller, uploading your ADSSU Student or Employee ID is required so the Admin can verify your store."
              : "As a Campus Buyer, uploading your ADSSU ID is optional. You can upload it now or skip straight to the marketplace."}
          </Text>
        </View>
      </View>

      {/* ID Upload Header */}
      <View style={styles.idHeaderRow}>
        <Text style={styles.label}>Student / Employee ID</Text>
        <View
          style={[
            styles.reqBadge,
            role === "buyer" && { backgroundColor: "#F3F4F6" },
          ]}
        >
          <Text
            style={[
              styles.reqBadgeText,
              role === "buyer" && { color: Colors.textMuted },
            ]}
          >
            {role === "seller" ? "Required for Sellers" : "Optional for Buyers"}
          </Text>
        </View>
      </View>

      {/* Upload / Preview Box */}
      {idImage ? (
        <View style={styles.idUploadedCard}>
          <Image source={{ uri: idImage }} style={styles.idThumb} />
          <View style={{ flex: 1 }}>
            <Text style={styles.idFileName} numberOfLines={1}>
              {idFileName}
            </Text>
            <Text style={styles.idUploadedMeta}>Ready to submit</Text>
            <View style={styles.clearRow}>
              <CheckCircle2 size={13} color={Colors.success} />
              <Text style={styles.idClearText}>Looks clear</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.retakeBtn} onPress={pickIdPhoto}>
            <RotateCcw size={13} color={Colors.primary} />
            <Text style={styles.retakeText}>Retake</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.idBox} onPress={pickIdPhoto}>
          <Camera size={28} color={Colors.primary} />
          <Text style={styles.idUploadTitle}>
            Tap to upload Student / Employee ID
          </Text>
          <Text style={styles.idUploadSub}>
            Front side showing your name, photo, and ADSSU ID number
          </Text>
        </TouchableOpacity>
      )}

      {/* Primary Submit Button */}
      <TouchableOpacity
        style={[
          styles.submitBtn,
          (submitting || (role === "seller" && !idImage)) && { opacity: 0.7 },
        ]}
        onPress={handleSubmitId}
        disabled={submitting}
      >
        <Text style={styles.submitText}>
          {submitting
            ? "Uploading ID..."
            : role === "seller"
              ? "Submit ID & Open Seller Dashboard →"
              : "Upload ID & Enter Marketplace →"}
        </Text>
      </TouchableOpacity>

      {/* Optional Skip Button for Buyers */}
      {role === "buyer" && (
        <TouchableOpacity
          style={styles.skipBtn}
          onPress={handleSkip}
          disabled={submitting}
        >
          <Text style={styles.skipText}>Skip for Now</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.footerHint}>
        Admin verification takes 1–2 hours on campus days.
      </Text>

      <TouchableOpacity
        style={styles.logoutLink}
        onPress={handleSwitchAccount}
        disabled={submitting}
      >
        <LogOut size={14} color={Colors.textMuted} />
        <Text style={styles.logoutLinkText}>Sign out / Switch account</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFF",
  },
  container: { flex: 1, backgroundColor: "#FFF" },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
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

  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    borderRadius: 16,
    padding: 14,
    marginBottom: 18,
  },
  shieldCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#DCFCE7",
    justifyContent: "center",
    alignItems: "center",
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.text,
    marginBottom: 4,
  },
  infoDesc: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 18,
  },

  idHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.text,
  },
  reqBadge: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  reqBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#B45309",
  },

  idBox: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: Colors.primary,
    borderRadius: 16,
    backgroundColor: "#F0FDF4",
    paddingVertical: 32,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  idUploadTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.primary,
    marginTop: 4,
  },
  idUploadSub: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: "center",
  },

  idUploadedCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  idThumb: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: "#E5E7EB",
  },
  idFileName: { fontSize: 13, fontWeight: "700", color: Colors.text },
  idUploadedMeta: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  clearRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  idClearText: { fontSize: 11, fontWeight: "700", color: Colors.success },
  retakeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: "#FFF",
  },
  retakeText: { fontSize: 12, fontWeight: "700", color: Colors.primary },

  submitBtn: {
    backgroundColor: Colors.primary,
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 24,
  },
  submitText: { color: "#FFF", fontSize: 15, fontWeight: "800" },

  skipBtn: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: "center",
    marginTop: 12,
    backgroundColor: "#FFF",
  },
  skipText: { fontSize: 14, fontWeight: "700", color: Colors.textMuted },

  footerHint: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: "center",
    marginTop: 14,
  },
  logoutLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 18,
  },
  logoutLinkText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textMuted,
  },
});
