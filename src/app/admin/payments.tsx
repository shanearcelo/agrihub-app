import { useFocusEffect, useRouter } from "expo-router";
import { ArrowLeft, Check, Image as ImageIcon, X } from "lucide-react-native";
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

type ReviewKind = "gcash" | "semester";
type ReviewRow = {
  id: string;
  seller_id?: string;
  seller_name?: string;
  buyer_name?: string;
  order_code?: string;
  order_status?: string;
  amount: number;
  total_amount?: number;
  semester?: string;
  created_at: string;
  receipt_url: string;
};

export default function AdminPaymentsScreen() {
  const [kind, setKind] = useState<ReviewKind>("gcash");
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      let active = true;
      let channel: ReturnType<typeof supabase.channel> | null = null;
      const loadQueue = async () => {
        if (kind === "gcash") {
          const { data, error } = await supabase
            .from("orders")
            .select(
              "id, order_code, order_status, buyer_name, seller_name, total_amount, gcash_receipt_url, created_at",
            )
            .eq("payment_status", "pending_verification")
            .order("created_at", { ascending: false });
          if (error) throw error;
          const entries = await Promise.all(
            (data || []).map(async (order) => ({
              id: order.id,
              order_code: order.order_code,
              order_status: order.order_status,
              buyer_name: order.buyer_name,
              seller_name: order.seller_name,
              total_amount: Number(order.total_amount || 0),
              amount: Number(order.total_amount || 0),
              created_at: order.created_at,
              receipt_url:
                (await getImageUrl(
                  "payment-receipts",
                  order.gcash_receipt_url,
                )) || "",
            })),
          );
          if (active) setRows(entries);
          return;
        }

        const { data, error } = await supabase
          .from("seller_semester_payments")
          .select("id, seller_id, semester, amount, receipt_path, created_at")
          .eq("status", "pending")
          .order("created_at", { ascending: false });
        if (error) throw error;
        const sellerIds = [
          ...new Set((data || []).map((payment) => payment.seller_id)),
        ];
        const { data: profiles, error: profileError } = sellerIds.length
          ? await supabase
              .from("profiles")
              .select("id, full_name, store_name")
              .in("id", sellerIds)
          : { data: [], error: null };
        if (profileError) throw profileError;
        const profileById = new Map(
          (profiles || []).map((profile) => [
            profile.id,
            profile.store_name || profile.full_name,
          ]),
        );
        const entries = await Promise.all(
          (data || []).map(async (payment) => ({
            id: payment.id,
            seller_id: payment.seller_id,
            seller_name: profileById.get(payment.seller_id) || "Seller",
            amount: Number(payment.amount),
            semester: payment.semester,
            created_at: payment.created_at,
            receipt_url:
              (await getImageUrl("payment-receipts", payment.receipt_path)) ||
              "",
          })),
        );
        if (active) setRows(entries);
      };

      const refreshQueue = () => {
        void loadQueue().catch((error: unknown) => {
          console.error("Could not refresh payment review queue.", error);
          if (active) {
            setLoadError(
              error instanceof Error
                ? error.message
                : "Could not refresh queue.",
            );
          }
        });
      };
      setLoadError("");
      void loadQueue()
        .then(() => {
          if (!active) return;
          channel = supabase
            .channel(`admin-payment-queue:${kind}`)
            .on(
              "postgres_changes",
              { event: "*", schema: "public", table: "orders" },
              refreshQueue,
            )
            .on(
              "postgres_changes",
              {
                event: "*",
                schema: "public",
                table: "seller_semester_payments",
              },
              refreshQueue,
            )
            .subscribe();
        })
        .catch((error: unknown) => {
          console.error("Could not load payment review queue.", error);
          if (active) {
            setLoadError(
              error instanceof Error ? error.message : "Could not load queue.",
            );
          }
        });

      return () => {
        active = false;
        if (channel) void supabase.removeChannel(channel);
      };
    }, [kind]),
  );

  function showMessage(title: string, message: string) {
    if (Platform.OS === "web") window.alert(`${title}: ${message}`);
    else Alert.alert(title, message);
  }

  async function reviewPayment(row: ReviewRow, approved: boolean) {
    setProcessingId(row.id);
    try {
      const { error } =
        kind === "gcash"
          ? await supabase.rpc("review_order_payment", {
              p_order_id: row.id,
              p_approved: approved,
              p_rejection_reason: approved
                ? null
                : "Receipt was rejected by the administrator.",
            })
          : await supabase.rpc("review_semester_payment", {
              p_payment_id: row.id,
              p_approved: approved,
              p_rejection_reason: approved
                ? null
                : "Receipt was rejected by the administrator.",
            });
      if (error) throw error;
      setRows((current) => current.filter((entry) => entry.id !== row.id));
      showMessage(
        approved ? "Payment Approved" : "Payment Rejected",
        approved
          ? kind === "semester"
            ? row.amount === 20
              ? "The remaining ₱20 was approved. The seller's semester fee is now Fully Paid."
              : "The ₱30 initial installment was approved. The seller's ₱20 balance remains due."
            : "The payment record has been approved."
          : "The payment record has been rejected.",
      );
    } catch (error) {
      showMessage(
        "Review Failed",
        error instanceof Error
          ? error.message
          : "Could not update payment status.",
      );
    } finally {
      setProcessingId(null);
    }
  }

  function confirmPaymentReview(row: ReviewRow, approved: boolean) {
    if (approved) {
      if (kind === "gcash" && row.order_status === "cancelled") {
        showMessage(
          "Order Cancelled",
          "A cancelled order cannot have its GCash receipt approved.",
        );
        return;
      }
      void reviewPayment(row, true);
      return;
    }

    const message =
      kind === "gcash"
        ? row.order_status === "cancelled"
          ? `Reject the GCash receipt for already-cancelled order #${row.order_code}? Its stock has already been released.`
          : `Reject the GCash receipt for order #${row.order_code}? The order will be cancelled and its reserved stock released.`
        : "Reject this seller installment receipt?";
    const reject = () => {
      void reviewPayment(row, false);
    };
    if (Platform.OS === "web") {
      if (window.confirm(message)) reject();
      return;
    }
    Alert.alert("Reject Payment", message, [
      { text: "Keep Pending", style: "cancel" },
      { text: "Reject", style: "destructive", onPress: reject },
    ]);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
        >
          <ArrowLeft size={20} color={Colors.text} />
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>Payment Review</Text>
          <Text style={styles.subtitle}>Verify receipts before approval</Text>
        </View>
      </View>

      <View style={styles.tabs}>
        {(
          [
            ["gcash", "GCash Receipts"],
            ["semester", "Seller Installments"],
          ] as const
        ).map(([value, label]) => (
          <TouchableOpacity
            key={value}
            style={[styles.tab, kind === value && styles.activeTab]}
            onPress={() => setKind(value)}
          >
            <Text
              style={[styles.tabText, kind === value && styles.activeTabText]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loadError ? (
        <Text style={styles.error}>Could not load receipts: {loadError}</Text>
      ) : null}
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <ImageIcon size={28} color={Colors.primary} />
            <Text style={styles.emptyTitle}>No pending receipts</Text>
            <Text style={styles.emptyText}>
              New submissions will appear here for review.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isBusy = processingId === item.id;
          const isCancelledGcash =
            kind === "gcash" && item.order_status === "cancelled";
          return (
            <View style={styles.card}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>
                    {kind === "gcash" ? item.buyer_name : item.seller_name}
                  </Text>
                  <Text style={styles.meta}>
                    {kind === "gcash"
                      ? `Order #${item.order_code} • ₱${item.total_amount?.toFixed(2)}`
                      : `₱${item.amount} installment • ${item.semester}`}
                  </Text>
                  <Text style={styles.date}>
                    {new Date(item.created_at).toLocaleString()}
                  </Text>
                </View>
              </View>
              {item.receipt_url ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="View submitted receipt"
                  onPress={() => setSelectedImage(item.receipt_url)}
                >
                  <Image
                    source={{ uri: item.receipt_url }}
                    style={styles.receipt}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              ) : (
                <Text style={styles.error}>Receipt image is missing.</Text>
              )}
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.rejectButton, isBusy && styles.disabled]}
                  disabled={isBusy}
                  onPress={() => confirmPaymentReview(item, false)}
                >
                  <X size={15} color={Colors.danger} />
                  <Text style={styles.rejectText}>Reject</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.approveButton,
                    (isBusy || isCancelledGcash) && styles.disabled,
                  ]}
                  disabled={isBusy || isCancelledGcash}
                  onPress={() => confirmPaymentReview(item, true)}
                >
                  <Check size={15} color="#FFF" />
                  <Text style={styles.approveText}>
                    {isBusy ? "Saving..." : isCancelledGcash ? "Cancelled" : "Approve"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />

      <Modal
        visible={!!selectedImage}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedImage(null)}
      >
        <View style={styles.imageOverlay}>
          <TouchableOpacity
            style={styles.closeImage}
            onPress={() => setSelectedImage(null)}
          >
            <X size={22} color="#FFF" />
          </TouchableOpacity>
          {selectedImage ? (
            <Image
              source={{ uri: selectedImage }}
              style={styles.fullImage}
              resizeMode="contain"
            />
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, paddingTop: 52 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  backButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 19,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  title: { color: Colors.text, fontSize: 20, fontWeight: "800" },
  subtitle: { color: Colors.textMuted, fontSize: 11 },
  tabs: { flexDirection: "row", gap: 8, paddingHorizontal: 16 },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: "#FFF",
  },
  activeTab: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText: { color: Colors.text, fontSize: 11, fontWeight: "700" },
  activeTabText: { color: "#FFF" },
  list: { padding: 16, gap: 12, flexGrow: 1 },
  card: {
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 14,
  },
  row: { flexDirection: "row", alignItems: "center" },
  name: { color: Colors.text, fontSize: 14, fontWeight: "800" },
  meta: { color: Colors.text, fontSize: 12, fontWeight: "600", marginTop: 3 },
  date: { color: Colors.textMuted, fontSize: 10, marginTop: 3 },
  receipt: {
    width: "100%",
    height: 220,
    marginTop: 12,
    backgroundColor: Colors.background,
    borderRadius: 12,
  },
  actions: { flexDirection: "row", gap: 10, marginTop: 12 },
  rejectButton: {
    flex: 1,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.danger,
    borderRadius: 11,
  },
  rejectText: { color: Colors.danger, fontSize: 12, fontWeight: "800" },
  approveButton: {
    flex: 1,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Colors.primary,
    borderRadius: 11,
  },
  approveText: { color: "#FFF", fontSize: 12, fontWeight: "800" },
  disabled: { opacity: 0.6 },
  error: { color: Colors.danger, fontSize: 12, padding: 12 },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    borderRadius: 16,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyTitle: { color: Colors.text, fontWeight: "800", marginTop: 10 },
  emptyText: { color: Colors.textMuted, fontSize: 12, marginTop: 4 },
  imageOverlay: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.9)",
    padding: 16,
  },
  closeImage: {
    position: "absolute",
    top: 54,
    right: 20,
    zIndex: 1,
    padding: 8,
  },
  fullImage: { width: "100%", height: "80%" },
});
