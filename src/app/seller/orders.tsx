// src/app/seller/orders.tsx
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import {
  Bell,
  CheckCircle2,
  CheckSquare,
  MessageSquare,
  QrCode,
  Square,
} from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Colors } from "../../constants/theme";
import OrderDetailsModal from "../../components/OrderDetailsModal";
import { getCurrentUser } from "../../lib/authHelpers";
import { supabase } from "../../lib/supabase";
import { getImageUrl } from "../../lib/uploadImageToSupabase";

type OrderTab = "pending" | "ready_for_pickup" | "completed";

function showMessage(title: string, msg: string) {
  if (Platform.OS === "web") {
    window.alert(`${title}: ${msg}`);
  } else {
    Alert.alert(title, msg);
  }
}

export default function SellerOrdersScreen() {
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  const [tab, setTab] = useState<OrderTab>("ready_for_pickup");
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [scanOpen, setScanOpen] = useState(false);
  const [qrInput, setQrInput] = useState("");
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanFeedback, setScanFeedback] = useState<string | null>(null);
  const [scanPaused, setScanPaused] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [detailsOrder, setDetailsOrder] = useState<any | null>(null);
  const openedOrderParam = useRef<string | null>(null);
  const permissionRequested = useRef(false);
  const scannerPaused = useRef(false);
  const verificationInProgress = useRef(false);
  const router = useRouter();

  const loadOrders = useCallback(async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("seller_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const list = await Promise.all(
        (data || []).map(async (order) => {
          const receipts = Array.isArray(order.payment_receipts)
            ? await Promise.all(
                order.payment_receipts.map(async (receipt: any) => ({
                  ...receipt,
                  receipt_image_url:
                    (await getImageUrl(
                      "payment-receipts",
                      receipt.receipt_image_url,
                    )) || "",
                })),
              )
            : [];
          return {
            ...order,
            receipt_image_url:
              (await getImageUrl(
                "payment-receipts",
                order.gcash_receipt_url,
              )) || null,
            payment_receipts: receipts,
          };
        }),
      );
      setOrders(list);
      setSelectedIds([]);
      if (orderId && openedOrderParam.current !== orderId) {
        const target = list.find((order) => order.id === orderId);
        if (target) {
          openedOrderParam.current = orderId;
          setDetailsOrder(target);
          if (target.order_status === "pending") setTab("pending");
          else if (target.order_status === "completed") setTab("completed");
          else setTab("ready_for_pickup");
        }
      }
    } catch (error) {
      console.error("Failed to load seller orders:", error);
      showMessage(
        "Orders Unavailable",
        error instanceof Error ? error.message : "Could not load your orders.",
      );
    }
  }, [orderId]);

  useFocusEffect(
    useCallback(() => {
      void loadOrders();
    }, [loadOrders]),
  );

  useEffect(() => {
    if (
      !scanOpen ||
      !cameraPermission ||
      cameraPermission.granted ||
      !cameraPermission.canAskAgain ||
      permissionRequested.current
    ) {
      return;
    }

    permissionRequested.current = true;
    requestCameraPermission().catch((error: unknown) => {
      console.error("Failed to request pickup scanner camera permission:", error);
      setCameraError(
        error instanceof Error
          ? error.message
          : "Could not request camera permission.",
      );
    });
  }, [cameraPermission, requestCameraPermission, scanOpen]);

  function openScanner() {
    permissionRequested.current = false;
    scannerPaused.current = false;
    setCameraError(null);
    setScanFeedback(null);
    setScanPaused(false);
    setScanOpen(true);
  }

  function closeScanner() {
    setScanOpen(false);
    scannerPaused.current = false;
    setScanPaused(false);
    setScanFeedback(null);
    setQrInput("");
  }

  async function retryCameraPermission() {
    permissionRequested.current = true;
    setCameraError(null);
    try {
      await requestCameraPermission();
    } catch (error) {
      console.error("Failed to request pickup scanner camera permission:", error);
      setCameraError(
        error instanceof Error
          ? error.message
          : "Could not request camera permission.",
      );
    }
  }

  async function verifyOrderCode(
    orderCode = qrInput,
    scannedByCamera = false,
  ) {
    const fail = (message: string) => {
      if (scannedByCamera) setScanFeedback(message);
      else showMessage("Unable to Verify Order", message);
    };
    if (verificationInProgress.current) return;
    const clean = orderCode.trim().replace("#", "").toUpperCase();
    if (!clean) {
      fail("Enter the order reference from the buyer's QR pass.");
      return;
    }
    const match = orders.find((o) => o.order_code?.toUpperCase() === clean);
    if (!match) {
      fail("No order from your seller account matches that QR reference.");
      return;
    }
    if (
      !["approved", "confirmed", "ready_for_pickup"].includes(
        match.order_status,
      )
    ) {
      fail("This order is not marked ready for pickup yet.");
      return;
    }
    if (
      match.payment_method === "gcash" &&
      match.payment_status !== "paid"
    ) {
      fail("The GCash receipt must be approved before pickup can be completed.");
      return;
    }

    verificationInProgress.current = true;
    setIsVerifying(true);
    try {
      await updateOrderStatus(match.id, "completed");
      showMessage(
        "Verified & Completed!",
        `Order #${match.order_code} has been handed over.`,
      );
      closeScanner();
    } catch (error) {
      fail(
        error instanceof Error
          ? error.message
          : "Could not complete the order.",
      );
    } finally {
      verificationInProgress.current = false;
      setIsVerifying(false);
    }
  }

  function handleBarcodeScanned({ data }: { data: string }) {
    if (scannerPaused.current) return;
    scannerPaused.current = true;
    setScanPaused(true);
    setScanFeedback(null);
    setQrInput(data);
    void verifyOrderCode(data, true);
  }

  async function updateOrderStatus(
    orderId: string,
    nextStatus: "ready_for_pickup" | "completed",
  ) {
    const { error } = await supabase.rpc("set_order_status", {
      p_order_id: orderId,
      p_status: nextStatus,
    });
    if (error) throw error;
    await loadOrders();
  }

  const pendingOrders = orders.filter((o) => o.order_status === "pending");
  const readyOrders = orders.filter((o) =>
    ["approved", "confirmed", "ready_for_pickup"].includes(o.order_status),
  );
  const completedOrders = orders.filter((o) => o.order_status === "completed");

  const filtered =
    tab === "pending"
      ? pendingOrders
      : tab === "ready_for_pickup"
        ? readyOrders
        : completedOrders;

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  function toggleSelectAll() {
    if (selectedIds.length === filtered.length && filtered.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map((o) => o.id));
    }
  }

  async function handleBulkNotify() {
    const targets =
      selectedIds.length > 0 ? selectedIds : filtered.map((o) => o.id);
    if (targets.length === 0) {
      return showMessage(
        "No Orders",
        "No active orders in this tab to notify.",
      );
    }
    if (
      tab === "pending" &&
      targets.some((id) => {
        const order = orders.find((entry) => entry.id === id);
        return (
          order?.payment_method === "gcash" && order.payment_status !== "paid"
        );
      })
    ) {
      return showMessage(
        "Payment Review Required",
        "GCash orders must be approved by Admin before they can be marked ready.",
      );
    }

    try {
      for (const id of targets) {
        if (tab === "pending") {
          const { error } = await supabase.rpc("set_order_status", {
            p_order_id: id,
            p_status: "ready_for_pickup",
          });
          if (error) throw error;
        }
      }
      showMessage(
        "Buyers Notified!",
        `Pick-up notification sent to ${targets.length} campus ${targets.length === 1 ? "buyer" : "buyers"}.`,
      );
      loadOrders();
    } catch (error) {
      showMessage(
        "Error",
        error instanceof Error ? error.message : "Could not notify buyers.",
      );
    }
  }

  async function openOrderChat(orderId: string) {
    try {
      const { data: chatId, error } = await supabase.rpc("get_or_create_chat", {
        p_order_id: orderId,
        p_product_id: null,
        p_seller_id: null,
      });
      if (error) throw error;
      router.push({
        pathname: "/chat/[orderId]",
        params: { orderId: chatId },
      });
    } catch (error) {
      showMessage(
        "Chat Unavailable",
        error instanceof Error ? error.message : "Could not open this chat.",
      );
    }
  }

  function getInitials(name?: string) {
    if (!name) return "CB";
    return name
      .split(" ")
      .slice(0, 2)
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.topHeader}>
        <View>
          <Text style={styles.header}>Orders</Text>
          <Text style={styles.subHeader}>
            {orders.length} total campus orders today
          </Text>
        </View>
        <TouchableOpacity
          style={styles.qrHeaderBtn}
          onPress={openScanner}
        >
          <QrCode size={18} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* 3 Status Tabs */}
      <View style={styles.tabRow}>
        {[
          { key: "pending", label: `Pending (${pendingOrders.length})` },
          {
            key: "ready_for_pickup",
            label: `Ready for Pick-Up (${readyOrders.length})`,
          },
          { key: "completed", label: `Completed (${completedOrders.length})` },
        ].map(({ key, label }) => {
          const active = tab === key;
          return (
            <TouchableOpacity
              key={key}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => {
                setTab(key as OrderTab);
                setSelectedIds([]);
              }}
            >
              <Text
                style={[styles.tabText, active && { color: "#FFF" }]}
                numberOfLines={1}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Scan Buyer QR Pass Banner */}
      <TouchableOpacity
        style={styles.scanBanner}
        onPress={openScanner}
      >
        <View style={styles.qrIconWrap}>
          <QrCode size={22} color="#FDE68A" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.scanTitle}>Scan Buyer QR Pass</Text>
          <Text style={styles.scanSub}>
            Verify & complete orders at the stall
          </Text>
        </View>
        <View style={styles.scanPill}>
          <Text style={styles.scanPillText}>Verify</Text>
        </View>
      </TouchableOpacity>

      {/* Orders List */}
      <FlatList
        data={filtered}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 90,
          gap: 10,
        }}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>No Orders in This Tab</Text>
            <Text style={styles.emptySub}>
              Orders placed by students & faculty will appear here in real time.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isSelected = selectedIds.includes(item.id);
          const paymentStatus = item.payment_status || "unpaid";
          const paymentStatusLabel = paymentStatus
            .replace("_", " ")
            .toUpperCase();
          const itemSummary = Array.isArray(item.items)
            ? item.items
                .map((i: any) => `${i.quantity} ${i.unit || ""} ${i.title}`)
                .join(", ")
            : item.crop_title || `Order #${item.order_code || "AGH"}`;

          return (
            <View style={styles.card}>
              <View style={styles.cardTopRow}>
                {tab !== "completed" && (
                  <TouchableOpacity
                    onPress={() => toggleSelect(item.id)}
                    style={{ marginRight: 4 }}
                  >
                    {isSelected ? (
                      <CheckSquare size={18} color={Colors.primary} />
                    ) : (
                      <Square size={18} color={Colors.textMuted} />
                    )}
                  </TouchableOpacity>
                )}

                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {getInitials(item.buyer_name)}
                  </Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.buyerName}>
                    {item.buyer_name || "Campus Buyer"}
                  </Text>
                  <Text style={styles.buyerMeta}>
                    #{item.order_code || item.id.slice(0, 6).toUpperCase()} •{" "}
                    {item.pickup_point || "Main Gate Stall"}
                  </Text>
                </View>

                <View
                  style={[
                    styles.statusTag,
                    tab === "completed" && { backgroundColor: "#DCFCE7" },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusTagText,
                      tab === "completed" && { color: Colors.success },
                    ]}
                  >
                    {tab === "pending"
                      ? "PENDING"
                      : tab === "ready_for_pickup"
                        ? "READY"
                        : "CLAIMED"}
                  </Text>
                </View>
              </View>

              <View style={styles.itemBox}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemSummary} numberOfLines={2}>
                    {itemSummary}
                  </Text>
                  <Text style={styles.pickupWindow}>
                    Pick-up: {item.pickup_time_window || "11:30 AM – 1:00 PM"}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.amount}>
                    ₱{Number(item.total_amount || 0).toFixed(2)}
                  </Text>
                  <Text
                    style={[
                      styles.payBadge,
                      paymentStatus !== "paid" && styles.unpaidBadge,
                    ]}
                  >
                    {item.payment_method === "cash"
                      ? "Cash on Pick-up"
                      : "GCash"}{" "}
                    • {paymentStatusLabel}
                  </Text>
                </View>
              </View>

              <View style={styles.btnRow}>
                <TouchableOpacity
                  style={styles.paymentDetailsBtn}
                  onPress={() => setDetailsOrder(item)}
                >
                  <Text style={styles.paymentDetailsText}>Payment Details</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.chatBtn}
                  onPress={() => openOrderChat(item.id)}
                >
                  <MessageSquare size={14} color={Colors.primary} />
                  <Text style={styles.chatText}>Chat</Text>
                </TouchableOpacity>

                {tab === "pending" &&
                (item.payment_method !== "gcash" ||
                  paymentStatus === "paid") ? (
                  <TouchableOpacity
                    style={styles.completeBtn}
                    onPress={() =>
                      updateOrderStatus(item.id, "ready_for_pickup")
                    }
                  >
                    <Bell size={14} color="#FFF" />
                    <Text style={styles.completeText}>Mark Ready</Text>
                  </TouchableOpacity>
                ) : tab === "pending" ? (
                  <Text style={styles.paymentReviewNotice}>
                    Awaiting GCash review
                  </Text>
                ) : null}

                {tab === "ready_for_pickup" &&
                (item.payment_method !== "gcash" ||
                  paymentStatus === "paid") ? (
                  <TouchableOpacity
                    style={styles.completeBtn}
                    onPress={() => updateOrderStatus(item.id, "completed")}
                  >
                    <CheckCircle2 size={14} color="#FFF" />
                    <Text style={styles.completeText}>Mark Claimed</Text>
                  </TouchableOpacity>
                ) : tab === "ready_for_pickup" ? (
                  <Text style={styles.paymentReviewNotice}>
                    Awaiting GCash review
                  </Text>
                ) : null}
              </View>
            </View>
          );
        }}
      />

      {/* Bottom Bulk Notify Bar */}
      {tab !== "completed" && filtered.length > 0 && (
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.selectAllBtn}
            onPress={toggleSelectAll}
          >
            {selectedIds.length === filtered.length ? (
              <CheckSquare size={18} color={Colors.primary} />
            ) : (
              <Square size={18} color={Colors.textMuted} />
            )}
            <Text style={styles.selectAllText}>
              Select all ({selectedIds.length || filtered.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.notifyBtn} onPress={handleBulkNotify}>
            <Bell size={14} color="#FFF" />
            <Text style={styles.notifyText}>Notify Buyers</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* QR Code Verification Modal */}
      <Modal visible={scanOpen} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.modalTitle}>Scan Buyer QR Pass</Text>
              <Text style={styles.modalSub}>
                Scan the pass or enter its order reference below.
              </Text>
              <View style={styles.cameraFrame}>
                {scanOpen && cameraPermission?.granted && !cameraError ? (
                  <CameraView
                    style={styles.cameraPreview}
                    facing="back"
                    barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                    onBarcodeScanned={
                      scanPaused ? undefined : handleBarcodeScanned
                    }
                    onMountError={({ message }) => setCameraError(message)}
                  />
                ) : (
                  <View style={styles.cameraFallback}>
                    <QrCode size={28} color={Colors.primary} />
                    <Text style={styles.cameraFallbackText}>
                      {cameraError
                        ? `Camera unavailable: ${cameraError}`
                        : !cameraPermission
                          ? "Checking camera permission..."
                          : cameraPermission.canAskAgain
                            ? "Allow camera access to scan the buyer's pass."
                            : "Camera access is disabled. Enter the order code below."}
                    </Text>
                    {cameraPermission &&
                      !cameraPermission.granted &&
                      cameraPermission.canAskAgain && (
                        <TouchableOpacity
                          style={styles.permissionBtn}
                          onPress={retryCameraPermission}
                        >
                          <Text style={styles.permissionBtnText}>
                            Enable Camera
                          </Text>
                        </TouchableOpacity>
                      )}
                  </View>
                )}
              </View>
              {scanFeedback && (
                <View style={styles.scanFeedbackBox}>
                  <Text style={styles.scanFeedbackText}>{scanFeedback}</Text>
                  <TouchableOpacity
                    onPress={() => {
                      scannerPaused.current = false;
                      setScanPaused(false);
                      setScanFeedback(null);
                    }}
                    style={styles.scanAgainBtn}
                  >
                    <Text style={styles.scanAgainText}>Scan Again</Text>
                  </TouchableOpacity>
                </View>
              )}
              <Text style={styles.manualCodeLabel}>Order code fallback</Text>
              <TextInput
                style={styles.qrInput}
                placeholder="e.g. AGH-240913"
                autoCapitalize="characters"
                value={qrInput}
                onChangeText={setQrInput}
                editable={!isVerifying}
                accessibilityLabel="Buyer order reference code"
              />
              <TouchableOpacity
                style={[
                  styles.verifyBtn,
                  isVerifying && styles.verifyBtnDisabled,
                ]}
                onPress={() => void verifyOrderCode()}
                disabled={isVerifying}
              >
                <Text style={styles.verifyText}>
                  {isVerifying ? "Completing Order..." : "Confirm Handover"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={closeScanner}
                style={{ marginTop: 12 }}
                disabled={isVerifying}
              >
                <Text style={{ textAlign: "center", color: Colors.textMuted }}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <OrderDetailsModal
        visible={detailsOrder !== null}
        order={detailsOrder}
        onClose={() => setDetailsOrder(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, paddingTop: 52 },
  topHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  header: { fontSize: 22, fontWeight: "800", color: Colors.text },
  subHeader: { fontSize: 11, color: Colors.textMuted, fontWeight: "600" },
  qrHeaderBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#DCFCE7",
    justifyContent: "center",
    alignItems: "center",
  },

  tabRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 6,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 20,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
  },
  tabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText: { fontSize: 10, fontWeight: "800", color: Colors.text },

  scanBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.primary,
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 16,
    marginBottom: 12,
  },
  qrIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.16)",
    justifyContent: "center",
    alignItems: "center",
  },
  scanTitle: { color: "#FFF", fontSize: 14, fontWeight: "800" },
  scanSub: { color: "#D8F3DC", fontSize: 11 },
  scanPill: {
    backgroundColor: "#FDE68A",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  scanPillText: { fontSize: 11, fontWeight: "800", color: "#78350F" },

  card: {
    backgroundColor: "#FFF",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { color: "#FFF", fontSize: 12, fontWeight: "800" },
  buyerName: { fontSize: 14, fontWeight: "800", color: Colors.text },
  buyerMeta: { fontSize: 11, color: Colors.textMuted },
  statusTag: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusTagText: { fontSize: 9, fontWeight: "800", color: "#B45309" },

  itemBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Colors.background,
    padding: 10,
    borderRadius: 10,
    gap: 8,
  },
  itemSummary: { fontSize: 12, fontWeight: "700", color: Colors.text },
  pickupWindow: { fontSize: 10, color: Colors.textMuted, marginTop: 2 },
  amount: { fontSize: 14, fontWeight: "800", color: Colors.primary },
  payBadge: { fontSize: 9, fontWeight: "700", color: Colors.success },
  unpaidBadge: { color: "#B45309" },
  paymentReviewNotice: {
    flex: 1,
    alignSelf: "center",
    color: "#92400E",
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
  },

  btnRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  paymentDetailsBtn: {
    flex: 1.2,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: "#DCFCE7",
  },
  paymentDetailsText: {
    color: Colors.primary,
    fontSize: 10,
    fontWeight: "800",
  },
  chatBtn: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    padding: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  chatText: { fontSize: 12, fontWeight: "700", color: Colors.primary },
  completeBtn: {
    flex: 1.3,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    padding: 9,
    borderRadius: 10,
    backgroundColor: Colors.primary,
  },
  completeText: { fontSize: 12, fontWeight: "700", color: "#FFF" },

  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFF",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  selectAllBtn: { flexDirection: "row", alignItems: "center", gap: 8 },
  selectAllText: { fontSize: 12, fontWeight: "700", color: Colors.text },
  notifyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  notifyText: { color: "#FFF", fontSize: 12, fontWeight: "800" },

  emptyBox: {
    backgroundColor: "#FFF",
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
  },
  emptyTitle: { fontSize: 14, fontWeight: "800", color: Colors.text },
  emptySub: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: "center",
    marginTop: 4,
  },

  modalBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: "#FFF",
    borderRadius: 20,
    maxHeight: "90%",
    overflow: "hidden",
  },
  cameraFrame: {
    height: 210,
    overflow: "hidden",
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
    marginBottom: 12,
  },
  cameraPreview: { flex: 1 },
  cameraFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  cameraFallbackText: {
    color: Colors.textMuted,
    fontSize: 12,
    textAlign: "center",
    marginTop: 8,
  },
  permissionBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginTop: 12,
  },
  permissionBtnText: { color: "#FFF", fontSize: 12, fontWeight: "700" },
  scanFeedbackBox: {
    backgroundColor: "#FEF2F2",
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
  },
  scanFeedbackText: { color: Colors.danger, fontSize: 12, textAlign: "center" },
  scanAgainBtn: { alignSelf: "center", padding: 8 },
  scanAgainText: { color: Colors.primary, fontSize: 12, fontWeight: "700" },
  manualCodeLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 6,
  },
  modalTitle: { fontSize: 18, fontWeight: "800", textAlign: "center" },
  modalSub: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 14,
  },
  qrInput: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 14,
  },
  verifyBtn: {
    backgroundColor: Colors.primary,
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  verifyBtnDisabled: { opacity: 0.65 },
  verifyText: { color: "#FFF", fontWeight: "800" },
});
