import { useRouter } from "expo-router";
import { ArrowLeft, Save } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
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
import { getCurrentUser } from "../../lib/authHelpers";
import { supabase } from "../../lib/supabase";

export default function EditProfileScreen() {
  const [fullName, setFullName] = useState("");
  const [department, setDepartment] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [storeName, setStoreName] = useState("");
  const [storeAddress, setStoreAddress] = useState("");
  const [role, setRole] = useState<"buyer" | "seller" | "admin">("buyer");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function loadProfile() {
      const user = await getCurrentUser();
      if (!user) {
        router.replace("/auth/login");
        return;
      }

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("full_name, department, phone_number, store_name, store_address, role")
          .eq("id", user.id)
          .maybeSingle();
        if (error) throw error;
        setFullName(data?.full_name || "");
        setDepartment(data?.department || "");
        setPhoneNumber(data?.phone_number || "");
        setStoreName(data?.store_name || "");
        setStoreAddress(data?.store_address || "");
        setRole(data?.role || "buyer");
      } catch (error) {
        console.error("Failed to load profile for editing:", error);
        showMessage("Load Failed", "Could not load your profile.");
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [router]);

  function showMessage(title: string, message: string) {
    if (Platform.OS === "web") {
      window.alert(`${title}: ${message}`);
    } else {
      Alert.alert(title, message);
    }
  }

  async function saveProfile() {
    const user = await getCurrentUser();
    if (!user) {
      router.replace("/auth/login");
      return;
    }
    if (!fullName.trim()) {
      return showMessage("Required Field", "Enter your full name.");
    }

    setSaving(true);
    try {
      const updates = {
        full_name: fullName.trim(),
        department: department.trim() || null,
        phone_number: phoneNumber.trim() || null,
        ...(role === "seller"
          ? {
              store_name: storeName.trim() || null,
              store_address: storeAddress.trim() || null,
            }
          : {}),
      };
      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", user.id);
      if (error) throw error;
      router.back();
    } catch (error) {
      console.error("Failed to update profile:", error);
      showMessage(
        "Update Failed",
        error instanceof Error ? error.message : "Could not save your profile.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button">
          <ArrowLeft size={21} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Edit Profile</Text>
      </View>

      <Text style={styles.label}>Full Name</Text>
      <TextInput
        style={styles.input}
        value={fullName}
        onChangeText={setFullName}
        autoCapitalize="words"
        maxLength={100}
      />

      <Text style={styles.label}>Department / Unit</Text>
      <TextInput
        style={styles.input}
        value={department}
        onChangeText={setDepartment}
        maxLength={120}
      />

      <Text style={styles.label}>Contact Number</Text>
      <TextInput
        style={styles.input}
        value={phoneNumber}
        onChangeText={setPhoneNumber}
        keyboardType="phone-pad"
        maxLength={24}
        placeholder="Optional"
      />

      {role === "seller" ? (
        <>
          <Text style={styles.label}>Store / Farm Name</Text>
          <TextInput
            style={styles.input}
            value={storeName}
            onChangeText={setStoreName}
            maxLength={120}
            placeholder="Optional"
          />
          <Text style={styles.label}>Store Address</Text>
          <TextInput
            style={styles.input}
            value={storeAddress}
            onChangeText={setStoreAddress}
            maxLength={240}
            placeholder="Optional"
          />
        </>
      ) : null}

      <TouchableOpacity
        style={[styles.saveButton, saving && { opacity: 0.6 }]}
        onPress={saveProfile}
        disabled={saving}
        accessibilityRole="button"
      >
        <Save size={17} color="#FFF" />
        <Text style={styles.saveText}>{saving ? "Saving..." : "Save Changes"}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.background,
  },
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 18, paddingTop: 52, paddingBottom: 36 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 18,
  },
  title: { color: Colors.text, fontSize: 21, fontWeight: "800" },
  label: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 14,
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 13,
    color: Colors.text,
  },
  saveButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 24,
    padding: 15,
    borderRadius: 12,
    backgroundColor: Colors.primary,
  },
  saveText: { color: "#FFF", fontSize: 14, fontWeight: "800" },
});
