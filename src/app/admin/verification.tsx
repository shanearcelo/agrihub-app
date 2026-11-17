// src/app/admin/verification.tsx
import { useFocusEffect, useRouter } from "expo-router";
import {
  ArrowLeft,
  BadgeCheck,
  FileImage,
  X,
  ZoomIn,
} from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Colors } from "../../constants/theme";
import { getImageUrl } from "../../lib/uploadImageToSupabase";
import { supabase } from "../../lib/supabase";

export default function AdminVerificationScreen() {
  const [statusTab, setStatusTab] = useState<
    "pending" | "verified" | "rejected"
  >("pending");
  const [sellers, setSellers] = useState<any[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedIdImage, setSelectedIdImage] = useState<string | null>(null);
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      let active = true;
      let channel: ReturnType<typeof supabase.channel> | null = null;
      const loadSellers = async () => {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("role", "seller")
          .eq("verification_status", statusTab)
          .order("created_at", { ascending: false });
        if (error) throw error;
        const sellersList = await Promise.all(
          (data || []).map(async (seller) => ({
            ...seller,
            id_document_url:
              (await getImageUrl(
                "valid-ids",
                seller.id_document_url || seller.valid_id_url,
              )) || null,
          })),
        );
        if (active) setSellers(sellersList);
      };
      void loadSellers()
        .then(() => {
          if (!active) return;
          channel = supabase
            .channel(`seller-verification:${statusTab}`)
            .on(
              "postgres_changes",
              {
                event: "*",
                schema: "public",
                table: "profiles",
                filter: "role=eq.seller",
              },
              () => {
                void loadSellers().catch((error: unknown) =>
                  console.error("[AdminVerification] Refresh failed:", error),
                );
              },
            )
            .subscribe();
        })
        .catch((error: unknown) =>
          console.error("[AdminVerification] Query failed:", error),
        );
      return () => {
        active = false;
        if (channel) void supabase.removeChannel(channel);
      };
    }, [statusTab]),
  );

  function showMessage(title: string, msg: string) {
    if (Platform.OS === "web") {
      window.alert(`${title}: ${msg}`);
    } else {
      Alert.alert(title, msg);
    }
  }

  async function executeStatusUpdate(
    uid: string,
    sellerName: string,
    nextStatus: "verified" | "rejected",
  ) {
    setProcessingId(uid);
    try {
      const { error } = await supabase.rpc("review_seller_verification", {
        p_seller_id: uid,
        p_status: nextStatus,
        p_rejection_reason: null,
      });
      if (error) throw error;
      showMessage(
        nextStatus === "verified" ? "Seller Approved!" : "Seller Rejected",
        `${sellerName} is now ${nextStatus.toUpperCase()}.`,
      );
    } catch (error: unknown) {
      console.error("[AdminVerification] Error updating status:", error);
      showMessage(
        "Update Failed",
        error instanceof Error
          ? error.message
          : "Failed to update seller status.",
      );
    } finally {
      setProcessingId(null);
    }
  }

  function updateStatus(
    uid: string,
    sellerName: string,
    nextStatus: "verified" | "rejected",
  ) {
    const actionLabel = nextStatus === "verified" ? "APPROVE" : "REJECT";
    const promptMsg = `Are you sure you want to ${actionLabel} ${sellerName}?`;

    if (Platform.OS === "web") {
      if (window.confirm(promptMsg)) {
        executeStatusUpdate(uid, sellerName, nextStatus);
      }
      return;
    }

    Alert.alert(`Confirm ${actionLabel}`, promptMsg, [
      { text: "Cancel", style: "cancel" },
      {
        text: nextStatus === "verified" ? "✓ Approve" : "Reject",
        style: nextStatus === "verified" ? "default" : "destructive",
        onPress: () => executeStatusUpdate(uid, sellerName, nextStatus),
      },
    ]);
  }

  const openIdModal = (imageUrl: string) => {
    setSelectedIdImage(imageUrl);
    setModalVisible(true);
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.topRow}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={20} color={Colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.header}>Seller Verification</Text>
          <Text style={styles.subHeader}>
            Review ADSSU Student / Dept Unit IDs
          </Text>
        </View>
      </View>

      {/* Verification Tabs */}
      <View style={styles.tabRow}>
        {(["pending", "verified", "rejected"] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, statusTab === t && styles.tabActive]}
            onPress={() => setStatusTab(t)}
          >
            <Text
              style={[styles.tabText, statusTab === t && { color: "#FFF" }]}
            >
              {t.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Populated Seller List */}
      <FlatList
        data={sellers}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <BadgeCheck size={32} color={Colors.primary} />
            <Text style={styles.emptyTitle}>No {statusTab} sellers</Text>
            <Text style={styles.emptySub}>
              {statusTab === "pending"
                ? "All seller ID applications have been reviewed."
                : `No seller accounts currently marked as ${statusTab}.`}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isBusy = processingId === item.id;
          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>
                    {item.full_name || "Unnamed Seller"}
                  </Text>
                  <Text style={styles.meta}>
                    {item.institutional_email} |{" "}
                    {item.department || "ADSSU Unit"}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusPill,
                    statusTab === "verified" && { backgroundColor: "#DCFCE7" },
                    statusTab === "rejected" && { backgroundColor: "#FEE2E2" },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      statusTab === "verified" && { color: "#15803D" },
                      statusTab === "rejected" && { color: "#DC2626" },
                    ]}
                  >
                    {statusTab.toUpperCase()}
                  </Text>
                </View>
              </View>

              {/* Tap to View ID Image */}
              {item.id_document_url ? (
                <TouchableOpacity
                  style={styles.idPreviewContainer}
                  onPress={() => openIdModal(item.id_document_url)}
                >
                  <Image
                    source={{ uri: item.id_document_url }}
                    style={styles.idPreview}
                    resizeMode="cover"
                  />
                  <View style={styles.zoomHint}>
                    <ZoomIn size={14} color="#FFF" />
                    <Text style={styles.zoomText}>Tap to Inspect ID</Text>
                  </View>
                </TouchableOpacity>
              ) : (
                <View style={[styles.idPreview, styles.noIdImage]}>
                  <FileImage size={22} color={Colors.textMuted} />
                  <Text style={styles.noIdText}>No ID Image Attached</Text>
                  <Text style={styles.noIdSub}>
                    Registered before ID storage fallback was enabled
                  </Text>
                </View>
              )}

              {/* Action Buttons */}
              {statusTab === "pending" && (
                <View style={styles.btnRow}>
                  <TouchableOpacity
                    style={[styles.rejectBtn, isBusy && { opacity: 0.6 }]}
                    disabled={isBusy}
                    onPress={() =>
                      updateStatus(
                        item.id,
                        item.full_name || "Seller",
                        "rejected",
                      )
                    }
                  >
                    <Text style={styles.rejectText}>
                      {isBusy ? "..." : "Reject"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.approveBtn, isBusy && { opacity: 0.6 }]}
                    disabled={isBusy}
                    onPress={() =>
                      updateStatus(
                        item.id,
                        item.full_name || "Seller",
                        "verified",
                      )
                    }
                  >
                    <Text style={styles.approveText}>
                      {isBusy ? "Updating..." : "✓ Approve"}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        }}
      />

      {/* Fullscreen ID Viewer Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.modalCloseIcon}
              onPress={() => setModalVisible(false)}
            >
              <X size={20} color={Colors.text} />
            </TouchableOpacity>
            {selectedIdImage && (
              <Image
                source={{ uri: selectedIdImage }}
                style={styles.fullScreenIdImage}
                resizeMode="contain"
              />
            )}
            <TouchableOpacity
              style={styles.closeModalBtn}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.closeModalText}>Done Inspecting</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, paddingTop: 52 },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  header: { fontSize: 20, fontWeight: "800", color: Colors.text },
  subHeader: { fontSize: 11, color: Colors.textMuted, fontWeight: "600" },
  tabRow: { flexDirection: "row", paddingHorizontal: 16, gap: 8 },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 24,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText: { fontSize: 11, fontWeight: "800", color: Colors.text },

  emptyCard: {
    backgroundColor: "#FFF",
    padding: 28,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    marginTop: 12,
  },
  emptyTitle: { fontSize: 15, fontWeight: "800", marginTop: 10 },
  emptySub: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: "center",
    marginTop: 4,
  },

  card: {
    backgroundColor: "#FFF",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 12,
  },
  name: { fontSize: 16, fontWeight: "800", color: Colors.text },
  meta: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
    fontWeight: "500",
  },
  statusPill: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusPillText: { fontSize: 10, fontWeight: "800", color: "#B45309" },

  idPreviewContainer: {
    width: "100%",
    height: 170,
    borderRadius: 12,
    marginBottom: 12,
    position: "relative",
    overflow: "hidden",
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  idPreview: {
    width: "100%",
    height: "100%",
  },
  zoomHint: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  zoomText: { fontSize: 10, fontWeight: "700", color: "#FFF" },
  noIdImage: {
    height: 120,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.02)",
    marginBottom: 12,
    borderStyle: "dashed",
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    gap: 4,
  },
  noIdText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: "700",
  },
  noIdSub: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  btnRow: { flexDirection: "row", gap: 10 },
  rejectBtn: {
    flex: 1,
    padding: 13,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.danger,
    alignItems: "center",
  },
  rejectText: { color: Colors.danger, fontWeight: "800", fontSize: 13 },
  approveBtn: {
    flex: 1,
    padding: 13,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: "center",
  },
  approveText: { color: "#FFF", fontWeight: "800", fontSize: 13 },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.82)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalContent: {
    width: "92%",
    maxWidth: 520,
    height: "75%",
    backgroundColor: "#FFF",
    borderRadius: 20,
    padding: 20,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  modalCloseIcon: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.background,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  fullScreenIdImage: {
    width: "100%",
    height: "82%",
  },
  closeModalBtn: {
    marginTop: 16,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  closeModalText: {
    color: "#FFF",
    fontWeight: "800",
  },
});
