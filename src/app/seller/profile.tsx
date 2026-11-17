// src/app/seller/profile.tsx
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useRouter } from "expo-router";
import {
  Building2,
  Camera,
  LogOut,
  Mail,
  Pencil,
  Phone,
  ShieldCheck,
} from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Colors } from "../../constants/theme";
import { getCurrentUser } from "../../lib/authHelpers";
import { supabase } from "../../lib/supabase";
import { uploadImageToSupabase } from "../../lib/uploadImageToSupabase";

export default function SellerProfileScreen() {
  const [profile, setProfile] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const router = useRouter();

  const loadProfile = useCallback(async () => {
    const currentUser = await getCurrentUser();
    if (!currentUser) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", currentUser.id)
      .maybeSingle();
    if (error) throw error;
    if (data) setProfile({ id: data.id, ...data });
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadProfile().catch((error: unknown) =>
        console.error("Could not load seller profile.", error),
      );
    }, [loadProfile]),
  );

  async function handleUploadAvatar() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (res.canceled || !profile) return;

    setUploading(true);
    try {
      const url = await uploadImageToSupabase(
        res.assets[0].uri,
        "avatars",
        `${profile.id}/${Date.now()}.jpg`,
      );
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: url })
        .eq("id", profile.id);
      if (error) throw error;
      setProfile({ ...profile, avatar_url: url });
      Alert.alert("Updated", "Profile picture saved!");
    } catch (error: unknown) {
      Alert.alert(
        "Upload Failed",
        error instanceof Error
          ? error.message
          : "Could not save your profile picture.",
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert("Sign Out Failed", error.message);
      return;
    }
    router.replace("/auth/login");
  }

  const initials = (profile?.full_name || "SU").slice(0, 2).toUpperCase();

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.pageTitle}>Seller Unit Profile</Text>
          <TouchableOpacity
            style={styles.editButton}
            accessibilityRole="button"
            accessibilityLabel="Edit seller profile"
            onPress={() => router.push("/profile/edit")}
          >
            <Pencil size={16} color="#FFF" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.avatarWrap}
          onPress={handleUploadAvatar}
          disabled={uploading}
        >
          {profile?.avatar_url ? (
            <Image
              source={{ uri: profile.avatar_url }}
              style={styles.avatarImg}
            />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
          <View style={styles.camBadge}>
            <Camera size={14} color="#FFF" />
          </View>
        </TouchableOpacity>
        <Text style={styles.tapHint}>
          {uploading ? "Uploading..." : "Tap photo to change profile picture"}
        </Text>

        <Text style={styles.name}>
          {profile?.full_name || "Agri Dept Unit"}
        </Text>
        <View style={styles.rolePill}>
          <Text style={styles.rolePillText}>STUDENT SELLER / DEPT UNIT</Text>
        </View>
      </View>

      <Text style={styles.sectionLabel}>UNIT DETAILS</Text>
      <View style={styles.card}>
        <View style={styles.detailRow}>
          <Mail size={18} color={Colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.detailLbl}>Institutional Email</Text>
            <Text style={styles.detailVal}>
              {profile?.institutional_email || "—"}
            </Text>
          </View>
        </View>
        <View style={styles.detailRow}>
          <Building2 size={18} color={Colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.detailLbl}>Department / Farm Plot</Text>
            <Text style={styles.detailVal}>
              {profile?.department || "Agriculture Department"}
            </Text>
          </View>
        </View>
        <View style={styles.detailRow}>
          <Phone size={18} color={Colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.detailLbl}>Contact Number</Text>
            <Text style={styles.detailVal}>{profile?.phone_number || "—"}</Text>
          </View>
        </View>
        <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
          <ShieldCheck size={18} color={Colors.success} />
          <View style={{ flex: 1 }}>
            <Text style={styles.detailLbl}>Verification Status</Text>
            <Text style={[styles.detailVal, { color: Colors.success }]}>
              {(profile?.verification_status || "pending").toUpperCase()}
            </Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <LogOut size={18} color={Colors.danger} />
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    backgroundColor: Colors.primary,
    paddingTop: 54,
    paddingBottom: 26,
    alignItems: "center",
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  pageTitle: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 14,
  },
  headerTitleRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  editButton: {
    position: "absolute",
    right: 18,
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarWrap: { position: "relative" },
  avatarImg: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 3,
    borderColor: "#FFF",
  },
  avatarFallback: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: Colors.accent,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { fontSize: 28, fontWeight: "800", color: "#111827" },
  camBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: Colors.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFF",
  },
  tapHint: { color: "#D8F3DC", fontSize: 11, marginTop: 6 },
  name: { color: "#FFF", fontSize: 20, fontWeight: "800", marginTop: 8 },
  rolePill: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 6,
  },
  rolePillText: { color: "#FDE68A", fontSize: 11, fontWeight: "800" },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: Colors.textMuted,
    marginTop: 18,
    marginBottom: 8,
    paddingHorizontal: 18,
  },
  card: {
    backgroundColor: "#FFF",
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  detailLbl: { fontSize: 11, color: Colors.textMuted },
  detailVal: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.text,
    marginTop: 1,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FFF",
    margin: 16,
    padding: 15,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FECACA",
    marginBottom: 32,
  },
  logoutText: { color: Colors.danger, fontWeight: "700", fontSize: 15 },
});
