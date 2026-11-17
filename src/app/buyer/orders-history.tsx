// src/app/buyer/orders-history.tsx
import * as ImagePicker from "expo-image-picker";
import * as Print from "expo-print";
import { useFocusEffect, useRouter } from "expo-router";
import {
  ArrowLeft,
  Camera,
  Download,
  MessageSquare,
  QrCode,
  RefreshCw,
  Search,
  Sprout,
  Star,
  X,
} from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as Sharing from "expo-sharing";
import { Colors } from "../../constants/theme";
import { getCurrentUser } from "../../lib/authHelpers";
import { supabase } from "../../lib/supabase";
import {
  uploadBase64ImageToSupabase,
  uploadImageToSupabase,
} from "../../lib/uploadImageToSupabase";

const REVIEW_TAGS = [
  "Fresh & clean",
  "Fair price",
  "On-time pick-up",
  "Friendly seller",
  "Well packed",
];

const RATING_LABELS: Record<number, string> = {
  5: "Very Fresh!",
  4: "Fresh & Good!",
  3: "Satisfactory",
  2: "Needs Improvement",
  1: "Not Fresh",
};

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export default function OrdersHistoryScreen() {
  const [filter, setFilter] = useState<
    "all" | "active" | "completed" | "cancelled"
  >("all");
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [orders, setOrders] = useState<any[]>([]);
  const [reviewOrder, setReviewOrder] = useState<any>(null);
  const [rating, setRating] = useState(5);
  const [selectedTags, setSelectedTags] = useState<string[]>([
    "Fresh & clean",
    "On-time pick-up",
  ]);
  const [comment, setComment] = useState("");
  const [attachedPhotos, setAttachedPhotos] = useState<string[]>([]);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(
    null,
  );
  const [receiptExportingId, setReceiptExportingId] = useState<string | null>(
    null,
  );
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      let active = true;
      let channel: ReturnType<typeof supabase.channel> | null = null;
      const loadOrders = async (buyerId: string) => {
        const { data, error } = await supabase
          .from("orders")
          .select("*")
          .eq("buyer_id", buyerId)
          .order("created_at", { ascending: false });
        if (error) throw error;
        if (active) setOrders(data || []);
      };

      void (async () => {
        try {
          const currentUser = await getCurrentUser();
          if (!active) return;
          if (!currentUser) {
            router.replace("/auth/login");
            return;
          }
          await loadOrders(currentUser.id);
          if (!active) return;
          channel = supabase
            .channel(`buyer-orders:${currentUser.id}`)
            .on(
              "postgres_changes",
              {
                event: "*",
                schema: "public",
                table: "orders",
                filter: `buyer_id=eq.${currentUser.id}`,
              },
              () => {
                void loadOrders(currentUser.id).catch((error: unknown) =>
                  console.error("Could not refresh buyer orders.", error),
                );
              },
            )
            .subscribe();
        } catch (error) {
          console.error("Could not load buyer orders.", error);
          showMessage(
            "Orders Unavailable",
            error instanceof Error ? error.message : "Could not load your orders.",
          );
        }
      })();

      return () => {
        active = false;
        if (channel) void supabase.removeChannel(channel);
      };
    }, [router]),
  );

  function showMessage(title: string, msg: string) {
    if (Platform.OS === "web") {
      window.alert(`${title}: ${msg}`);
    } else {
      Alert.alert(title, msg);
    }
  }

  async function cancelOrder(item: any) {
    setCancellingOrderId(item.id);
    try {
      const { error } = await supabase.rpc("set_order_status", {
        p_order_id: item.id,
        p_status: "cancelled",
      });
      if (error) throw error;
      setOrders((current) =>
        current.map((order) =>
          order.id === item.id
            ? { ...order, order_status: "cancelled", status: "cancelled" }
            : order,
        ),
      );
      showMessage("Order Cancelled", `Order #${item.order_code} was cancelled.`);
    } catch (error) {
      showMessage(
        "Cancellation Failed",
        error instanceof Error ? error.message : "Could not cancel this order.",
      );
    } finally {
      setCancellingOrderId(null);
    }
  }

  function confirmCancelOrder(item: any) {
    const confirm = () => {
      void cancelOrder(item);
    };
    const message = `Cancel order #${item.order_code}? Its reserved stock will be released.`;
    if (Platform.OS === "web") {
      if (window.confirm(message)) confirm();
      return;
    }
    Alert.alert("Cancel Order", message, [
      { text: "Keep Order", style: "cancel" },
      { text: "Cancel Order", style: "destructive", onPress: confirm },
    ]);
  }

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  async function pickReviewPhoto() {
    if (attachedPhotos.length >= 3) {
      return showMessage("Limit Reached", "Maximum of 3 photos allowed.");
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.35,
      base64: true,
    });
    if (!res.canceled && res.assets?.length > 0) {
      const asset = res.assets[0];
      const uri = asset.base64
        ? `data:image/jpeg;base64,${asset.base64}`
        : asset.uri;
      setAttachedPhotos((prev) => [...prev, uri]);
    }
  }

  async function submitReview() {
    if (!reviewOrder) return;

    setSubmittingReview(true);
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        router.replace("/auth/login");
        return;
      }
      const photoUrls = await Promise.all(
        attachedPhotos.map(async (photo, index) => {
          const filePath = `${currentUser.id}/${reviewOrder.id}/${Date.now()}-${index}.jpg`;
          if (photo.startsWith("data:image/")) {
            return uploadBase64ImageToSupabase(
              photo.split(",")[1],
              "review-photos",
              filePath,
            );
          }
          return uploadImageToSupabase(photo, "review-photos", filePath);
        }),
      );
      const { error: reviewError } = await supabase.from("reviews").insert({
        order_id: reviewOrder.id,
        order_code: reviewOrder.order_code || "",
        buyer_id: currentUser.id,
        seller_id: reviewOrder.seller_id || "",
        seller_name: reviewOrder.seller_name || "Agri Unit",
        rating,
        tags: selectedTags,
        comment: comment.trim(),
        photos: photoUrls,
      });
      if (reviewError) throw reviewError;

      const { error: orderError } = await supabase
        .from("orders")
        .update({ reviewed: true, buyer_rating: rating })
        .eq("id", reviewOrder.id);
      if (orderError) throw orderError;

      showMessage("Thank You!", "Your harvest review has been submitted.");
      setReviewOrder(null);
      setComment("");
      setAttachedPhotos([]);
    } catch (error: unknown) {
      showMessage(
        "Submission Failed",
        error instanceof Error ? error.message : "Could not submit your review.",
      );
    } finally {
      setSubmittingReview(false);
    }
  }

  async function handleDownloadReceipt(item: any) {
    setReceiptExportingId(item.id);
    try {
      const orderCode = String(item.order_code || item.id);
      const items = Array.isArray(item.items) ? item.items : [];
      const itemRows = items
        .map((orderItem: any) => {
          const title = escapeHtml(
            orderItem.crop_name || orderItem.title || "Fresh Harvest",
          );
          const quantity = Number(orderItem.quantity || 0);
          const unitPrice = Number(
            orderItem.price_per_unit ?? orderItem.pricePerUnit ?? 0,
          );
          const unit = escapeHtml(orderItem.unit || "kg");
          const lineTotal = quantity * unitPrice;
          return `<tr>
            <td>${title}</td>
            <td class="numeric">${quantity.toLocaleString("en-PH")} ${unit}</td>
            <td class="numeric">₱${unitPrice.toFixed(2)}</td>
            <td class="numeric">₱${lineTotal.toFixed(2)}</td>
          </tr>`;
        })
        .join("");
      const pickupDate = item.pickup_date
        ? new Date(`${item.pickup_date}T00:00:00`).toLocaleDateString("en-PH")
        : "Not specified";
      const paymentMethod =
        item.payment_method === "cash" ? "Cash on pickup" : "GCash";
      const paymentStatus =
        item.payment_method === "gcash"
          ? item.payment_status === "paid"
            ? "Paid"
            : "Payment submitted"
          : "Collected at pickup";
      const html = `<!doctype html>
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>AgriHub_Receipt_${escapeHtml(orderCode)}</title>
            <style>
              * { box-sizing: border-box; }
              body { margin: 0; padding: 32px; color: #17211b; font-family: Arial, sans-serif; font-size: 13px; }
              .receipt { max-width: 680px; margin: 0 auto; border: 1px solid #d9e3dc; border-radius: 14px; padding: 28px; }
              .brand { color: #166534; font-size: 12px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; }
              h1 { margin: 8px 0 4px; font-size: 24px; }
              .muted { color: #64746a; }
              .order-code { margin: 0 0 22px; color: #166534; font-size: 15px; font-weight: 700; }
              .details { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 20px; margin: 20px 0; }
              .detail-label { display: block; margin-bottom: 4px; color: #64746a; font-size: 10px; text-transform: uppercase; }
              .detail-value { font-weight: 600; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { padding: 10px 6px; border-bottom: 1px solid #e5ebe6; text-align: left; }
              th { color: #64746a; font-size: 10px; text-transform: uppercase; }
              .numeric { text-align: right; white-space: nowrap; }
              .total { display: flex; justify-content: space-between; margin-top: 18px; padding-top: 14px; border-top: 2px solid #166534; font-size: 17px; font-weight: 700; }
              .footer { margin-top: 28px; color: #64746a; font-size: 10px; text-align: center; }
              @media print { body { padding: 0; } .receipt { border: 0; } }
            </style>
          </head>
          <body>
            <main class="receipt">
              <div class="brand">AgriHub Marketplace</div>
              <h1>Order Receipt</h1>
              <p class="order-code">#${escapeHtml(orderCode)}</p>
              <div class="details">
                <div><span class="detail-label">Seller</span><span class="detail-value">${escapeHtml(item.seller_name || "AgriHub Seller")}</span></div>
                <div><span class="detail-label">Buyer</span><span class="detail-value">${escapeHtml(item.buyer_name || "Buyer")}</span></div>
                <div><span class="detail-label">Order date</span><span class="detail-value">${escapeHtml(new Date(item.created_at).toLocaleString("en-PH"))}</span></div>
                <div><span class="detail-label">Order status</span><span class="detail-value">Completed</span></div>
                <div><span class="detail-label">Pickup date and time</span><span class="detail-value">${escapeHtml(pickupDate)}${item.pickup_time ? ` • ${escapeHtml(item.pickup_time)}` : ""}</span></div>
                <div><span class="detail-label">Pickup venue</span><span class="detail-value">${escapeHtml(item.pickup_venue || item.pickup_point || "Not specified")}</span></div>
                <div><span class="detail-label">Payment method</span><span class="detail-value">${paymentMethod}</span></div>
                <div><span class="detail-label">Payment status</span><span class="detail-value">${paymentStatus}</span></div>
              </div>
              <table>
                <thead><tr><th>Item</th><th class="numeric">Quantity</th><th class="numeric">Unit price</th><th class="numeric">Amount</th></tr></thead>
                <tbody>${itemRows || `<tr><td colspan="4">Order details unavailable</td></tr>`}</tbody>
              </table>
              <div class="total"><span>Total</span><span>₱${Number(item.total_amount || 0).toFixed(2)}</span></div>
              <p class="footer">Thank you for supporting local campus growers.</p>
            </main>
          </body>
        </html>`;

      const { uri } = await Print.printToFileAsync({ html });
      if (Platform.OS !== "web") {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            dialogTitle: `Share AgriHub receipt ${orderCode}`,
            mimeType: "application/pdf",
            UTI: ".pdf",
          });
        } else {
          await Print.printAsync({ uri });
        }
      }
    } catch (error) {
      console.error("Could not export order receipt:", error);
      showMessage(
        "Receipt Export Failed",
        error instanceof Error ? error.message : "Could not create the receipt PDF.",
      );
    } finally {
      setReceiptExportingId(null);
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

  const filtered = orders.filter((o) => {
    const st = String(o.status || "pending").toLowerCase();
    if (filter === "active" && (st === "completed" || st === "cancelled"))
      return false;
    if (filter === "completed" && st !== "completed") return false;
    if (filter === "cancelled" && st !== "cancelled") return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const firstCrop = (o.items?.[0]?.crop_name || "").toLowerCase();
      const code = (o.order_code || "").toLowerCase();
      const seller = (o.seller_name || "").toLowerCase();
      return firstCrop.includes(q) || code.includes(q) || seller.includes(q);
    }
    return true;
  });

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.topRow}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
          <ArrowLeft size={20} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.header}>My Orders</Text>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => setShowSearch(!showSearch)}
        >
          <Search size={19} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {showSearch && (
        <View style={styles.searchWrap}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search crop, stall, or #AGH code..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      )}

      {/* 4 Filter Pills (All, Active, Completed, Cancelled) */}
      <View style={styles.tabRow}>
        {(["all", "active", "completed", "cancelled"] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, filter === t && styles.tabActive]}
            onPress={() => setFilter(t)}
          >
            <Text style={[styles.tabText, filter === t && { color: "#FFF" }]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 34 }}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Sprout size={34} color={Colors.primary} />
            <Text style={styles.emptyTitle}>No orders found</Text>
            <Text style={styles.emptySub}>
              Your active pre-orders and completed campus pick-ups appear here.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const st = String(item.status || "confirmed").toLowerCase();
          const isCompleted = st === "completed";
          const isCancelled = st === "cancelled";
          const isPreOrder = item.order_type === "pre_order";
          const firstItem = item.items?.[0];
          const extraCount =
            Array.isArray(item.items) && item.items.length > 1
              ? ` +${item.items.length - 1}`
              : firstItem?.quantity
                ? ` • ${firstItem.quantity} ${firstItem.unit || "kg"}`
                : "";

          const badgeLabel = isCompleted
            ? "COMPLETED"
            : isCancelled
              ? "CANCELLED"
              : isPreOrder
                ? "PRE-ORDER • GROWING"
                : st === "ready" || st === "ready_for_pickup"
                  ? "READY FOR PICK-UP"
                  : "CONFIRMED";

          return (
            <View style={styles.card}>
              <View style={styles.cardTopRow}>
                {firstItem?.image_url ? (
                  <Image
                    source={{ uri: firstItem.image_url }}
                    style={styles.thumbImg}
                  />
                ) : (
                  <View style={styles.thumbFallback}>
                    <Sprout size={22} color={Colors.primary} />
                  </View>
                )}

                <View style={{ flex: 1 }}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.itemTitle} numberOfLines={1}>
                      {firstItem?.crop_name || "Fresh Harvest"}
                      {extraCount}
                    </Text>
                    <Text style={styles.amount}>
                      ₱{Number(item.total_amount || 0).toFixed(2)}
                    </Text>
                  </View>

                  <Text style={styles.seller}>
                    {item.seller_name || "Agri Dept - Unit 3"} •{" "}
                    {item.pickup_point || "Gate 2"}
                  </Text>

                  <View style={styles.metaRow}>
                    <Text style={styles.orderCode}>#{item.order_code}</Text>
                    <View
                      style={[
                        styles.statusBadge,
                        isCompleted && { backgroundColor: "#DCFCE7" },
                        isCancelled && { backgroundColor: "#FEE2E2" },
                        isPreOrder &&
                          !isCompleted && { backgroundColor: "#DBEAFE" },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusBadgeText,
                          isCompleted && { color: "#15803D" },
                          isCancelled && { color: "#DC2626" },
                          isPreOrder && !isCompleted && { color: "#1D4ED8" },
                        ]}
                      >
                        {badgeLabel}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Bottom Action Buttons */}
              <View style={styles.btnRow}>
                {!isCompleted ? (
                  <>
                    <TouchableOpacity
                      style={styles.outlineBtn}
                      onPress={() => openOrderChat(item.id)}
                    >
                      <MessageSquare size={14} color={Colors.text} />
                      <Text style={styles.outlineText}>Message Seller</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.fillBtn}
                      onPress={() =>
                        router.push(
                          `/buyer/order-success/${item.order_code}` as any,
                        )
                      }
                    >
                      <QrCode size={14} color="#FFF" />
                      <Text style={styles.fillText}>Show QR Pass</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity
                      style={styles.outlineBtn}
                      disabled={receiptExportingId === item.id}
                      onPress={() => void handleDownloadReceipt(item)}
                      accessibilityRole="button"
                      accessibilityLabel={`Download receipt for order ${item.order_code}`}
                    >
                      <Download size={14} color={Colors.text} />
                      <Text style={styles.outlineText}>
                        {receiptExportingId === item.id
                          ? "Preparing Receipt..."
                          : "Download / Share Receipt"}
                      </Text>
                    </TouchableOpacity>

                    {item.reviewed ? (
                      <TouchableOpacity
                        style={styles.reorderBtn}
                        onPress={() => router.push("/buyer")}
                      >
                        <RefreshCw size={14} color={Colors.primary} />
                        <Text style={styles.reorderText}>Re-order</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={styles.rateBtn}
                        onPress={() => {
                          setReviewOrder(item);
                          setRating(5);
                          setComment("");
                          setAttachedPhotos([]);
                        }}
                      >
                        <Star size={14} color="#B45309" fill="#F59E0B" />
                        <Text style={styles.rateText}>Rate & Review</Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </View>
              {item.order_status === "pending" && (
                <TouchableOpacity
                  style={[
                    styles.cancelOrderBtn,
                    cancellingOrderId === item.id && styles.cancelOrderDisabled,
                  ]}
                  disabled={cancellingOrderId === item.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Cancel order ${item.order_code}`}
                  onPress={() => confirmCancelOrder(item)}
                >
                  <X size={14} color={Colors.danger} />
                  <Text style={styles.cancelOrderText}>
                    {cancellingOrderId === item.id
                      ? "Cancelling..."
                      : "Cancel Order"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          );
        }}
      />

      {/* Rating & Review Modal */}
      <Modal visible={!!reviewOrder} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <View style={{ width: 28 }} />
                <Text style={styles.modalTitle}>Rate your harvest</Text>
                <TouchableOpacity
                  style={styles.closeModalBtn}
                  onPress={() => setReviewOrder(null)}
                >
                  <X size={18} color={Colors.text} />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalSub}>
                How fresh was your produce from{" "}
                {reviewOrder?.seller_name || "Agri Unit"}?
              </Text>

              {/* Selected Harvest Mini Banner */}
              {reviewOrder && (
                <View style={styles.reviewItemBanner}>
                  <View style={styles.bannerThumb}>
                    <Sprout size={18} color={Colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.bannerTitle}>
                      {reviewOrder.items?.[0]?.crop_name || "Fresh Harvest"}
                    </Text>
                    <Text style={styles.bannerMeta}>
                      Order #{reviewOrder.order_code} • Picked up
                    </Text>
                  </View>
                  <View style={styles.completedTag}>
                    <Text style={styles.completedTagText}>Completed</Text>
                  </View>
                </View>
              )}

              {/* 5 Interactive Stars */}
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <TouchableOpacity key={s} onPress={() => setRating(s)}>
                    <Star
                      size={34}
                      color="#F59E0B"
                      fill={s <= rating ? "#F59E0B" : "transparent"}
                    />
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.ratingLabel}>
                {RATING_LABELS[rating] || "Very Fresh!"}
              </Text>

              {/* Quick Feedback Tag Chips */}
              <View style={styles.tagsWrap}>
                {REVIEW_TAGS.map((tag) => {
                  const active = selectedTags.includes(tag);
                  return (
                    <TouchableOpacity
                      key={tag}
                      style={[styles.tagChip, active && styles.tagChipActive]}
                      onPress={() => toggleTag(tag)}
                    >
                      <Text
                        style={[
                          styles.tagChipText,
                          active && {
                            color: Colors.primary,
                            fontWeight: "800",
                          },
                        ]}
                      >
                        {tag}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Written Review Input */}
              <Text style={styles.inputLbl}>Your review</Text>
              <TextInput
                style={styles.reviewInput}
                placeholder="Super presko! Nilinis ra agad at tamang-tama ang timbang. Will order again next week."
                multiline
                maxLength={250}
                value={comment}
                onChangeText={setComment}
              />
              <Text style={styles.charCount}>{comment.length}/250</Text>

              {/* Attach Photo Bar */}
              <TouchableOpacity
                style={styles.attachRow}
                onPress={pickReviewPhoto}
              >
                <Camera size={16} color={Colors.primary} />
                <Text style={styles.attachText}>
                  Attach photo ({attachedPhotos.length}/3)
                </Text>
              </TouchableOpacity>

              {attachedPhotos.length > 0 && (
                <View style={styles.photoPreviewRow}>
                  {attachedPhotos.map((uri, i) => (
                    <Image
                      key={i}
                      source={{ uri }}
                      style={styles.reviewPhotoThumb}
                    />
                  ))}
                </View>
              )}

              {/* Submit Feedback Button */}
              <TouchableOpacity
                style={[styles.submitBtn, submittingReview && { opacity: 0.7 }]}
                onPress={submitReview}
                disabled={submittingReview}
              >
                <Text style={styles.submitText}>
                  {submittingReview ? "Submitting..." : "✓ Submit Feedback"}
                </Text>
              </TouchableOpacity>
            </ScrollView>
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
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  header: { fontSize: 19, fontWeight: "800", color: Colors.text },
  searchWrap: { paddingHorizontal: 16, marginBottom: 10 },
  searchInput: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
  },

  tabRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 6,
    marginBottom: 4,
  },
  tab: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText: { fontSize: 11, fontWeight: "700", color: Colors.text },

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
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardTopRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  thumbImg: { width: 54, height: 54, borderRadius: 12 },
  thumbFallback: {
    width: 54,
    height: 54,
    borderRadius: 12,
    backgroundColor: "#DCFCE7",
    justifyContent: "center",
    alignItems: "center",
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  itemTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "800",
    color: Colors.text,
  },
  amount: { fontSize: 14, fontWeight: "800", color: Colors.text },
  seller: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  orderCode: { fontSize: 11, fontWeight: "700", color: Colors.textMuted },
  statusBadge: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusBadgeText: { fontSize: 9, fontWeight: "800", color: "#B45309" },

  btnRow: { flexDirection: "row", gap: 8 },
  outlineBtn: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  outlineText: { fontSize: 12, fontWeight: "700", color: Colors.text },
  fillBtn: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.primary,
  },
  fillText: { fontSize: 12, fontWeight: "700", color: "#FFF" },
  cancelOrderBtn: {
    minHeight: 40,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.danger,
    backgroundColor: "#FEF2F2",
  },
  cancelOrderDisabled: { opacity: 0.6 },
  cancelOrderText: { color: Colors.danger, fontSize: 12, fontWeight: "800" },
  rateBtn: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  rateText: { fontSize: 12, fontWeight: "800", color: "#B45309" },
  reorderBtn: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#DCFCE7",
  },
  reorderText: { fontSize: 12, fontWeight: "800", color: Colors.primary },

  modalBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.48)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#FFF",
    padding: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "88%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitle: { fontSize: 18, fontWeight: "800", color: Colors.text },
  closeModalBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  modalSub: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 14,
  },
  reviewItemBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.background,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 14,
  },
  bannerThumb: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#DCFCE7",
    justifyContent: "center",
    alignItems: "center",
  },
  bannerTitle: { fontSize: 13, fontWeight: "800", color: Colors.text },
  bannerMeta: { fontSize: 10, color: Colors.textMuted },
  completedTag: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  completedTagText: { fontSize: 10, fontWeight: "800", color: "#15803D" },

  starsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    marginBottom: 6,
  },
  ratingLabel: {
    textAlign: "center",
    fontSize: 13,
    fontWeight: "800",
    color: "#D97706",
    marginBottom: 14,
  },
  tagsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  tagChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  tagChipActive: {
    borderColor: Colors.primary,
    backgroundColor: "#F0FDF4",
  },
  tagChipText: { fontSize: 11, fontWeight: "600", color: Colors.text },

  inputLbl: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: 6,
  },
  reviewInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 12,
    height: 82,
    textAlignVertical: "top",
    backgroundColor: Colors.background,
    fontSize: 13,
  },
  charCount: {
    fontSize: 10,
    color: Colors.textMuted,
    textAlign: "right",
    marginTop: 4,
    marginBottom: 10,
  },
  attachRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: Colors.primary,
    backgroundColor: "#F0FDF4",
    marginBottom: 12,
  },
  attachText: { fontSize: 12, fontWeight: "700", color: Colors.primary },
  photoPreviewRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  reviewPhotoThumb: { width: 56, height: 56, borderRadius: 10 },

  submitBtn: {
    backgroundColor: Colors.primary,
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
  },
  submitText: { color: "#FFF", fontWeight: "800", fontSize: 15 },
});
