// src/app/seller/subscription.tsx
import * as ImagePicker from "expo-image-picker";
import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import {
    ArrowLeft,
    CheckCircle2,
    Clock,
    Receipt,
    Store,
    Upload,
} from "lucide-react-native";
import { useCallback, useState } from "react";
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
import { getCurrentSemester, getSemesterPaymentStatus } from "../../lib/semesterFee";
import { supabase } from "../../lib/supabase";
import {
  getImageUrl,
  uploadPrivateImageToSupabase,
} from "../../lib/uploadImageToSupabase";

// Admin GCash account details displayed in the semester fee flow.
const ADMIN_GCASH_NUMBER = "09171234567";
const ADMIN_GCASH_NAME = "ADSSU TBI Admin";

type SubscriptionStatus = "unpaid" | "partial" | "paid";

interface ReceiptEntry {
  id: string;
  amount: number;
  receipt_url: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  rejection_reason?: string | null;
}

export default function DigitalBoothScreen() {
  const { paymentId } = useLocalSearchParams<{ paymentId?: string }>();
  const [subscriptionStatus, setSubscriptionStatus] =
    useState<SubscriptionStatus>("unpaid");
  const [amountPaid, setAmountPaid] = useState(0);
  const [receipts, setReceipts] = useState<ReceiptEntry[]>([]);
  const [pendingReview, setPendingReview] = useState(false);
  const [semester, setSemester] = useState(getCurrentSemester());
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState<30 | 20 | null>(null);
  const [receiptImageUri, setReceiptImageUri] = useState<string | null>(null);
  const [showPaymentFlow, setShowPaymentFlow] = useState(false);

  const router = useRouter();

  function showMessage(title: string, msg: string) {
    if (Platform.OS === "web") {
      window.alert(`${title}: ${msg}`);
    } else {
      Alert.alert(title, msg);
    }
  }

  const loadSubscriptionData = useCallback(async () => {
    try {
      const user = await getCurrentUser();
      if (!user) {
        setLoading(false);
        return;
      }
      const currentSemester = getCurrentSemester();
      const [{ data: profile, error: profileError }, { data: payments, error: paymentError }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select(
              "semester_fee_paid, semester_fee_semester, subscription_amount_paid, subscription_semester",
            )
            .eq("id", user.id)
            .single(),
          supabase
            .from("seller_semester_payments")
            .select("id, amount, receipt_path, status, created_at, rejection_reason")
            .eq("seller_id", user.id)
            .eq("semester", currentSemester)
            .order("created_at", { ascending: false }),
        ]);
      if (profileError) throw profileError;
      if (paymentError) throw paymentError;
      setSemester(currentSemester);

      const paid =
        profile.semester_fee_semester === currentSemester
          ? Number(profile.semester_fee_paid || 0)
          : profile.subscription_semester === currentSemester
            ? Number(profile.subscription_amount_paid || 0)
            : 0;
      setAmountPaid(paid);
      setSubscriptionStatus(getSemesterPaymentStatus(paid));

      const receiptEntries = await Promise.all(
        (payments || []).map(async (payment) => ({
          id: payment.id,
          amount: Number(payment.amount),
          receipt_url:
            (await getImageUrl("payment-receipts", payment.receipt_path)) || "",
          status: payment.status,
          created_at: payment.created_at,
          rejection_reason: payment.rejection_reason,
        })),
      );
      setReceipts(receiptEntries);
      setPendingReview(receiptEntries.some((receipt) => receipt.status === "pending"));
    } catch (error) {
      console.error("Failed to load semester fee:", error);
      showMessage(
        "Could Not Load Fee Status",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadSubscriptionData();
    }, [loadSubscriptionData]),
  );

  async function pickReceiptPhoto() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.7,
    });
    if (!res.canceled && res.assets?.length > 0) {
      setReceiptImageUri(res.assets[0].uri);
    }
  }

  async function handleSubmitPayment() {
    if (!receiptImageUri || !selectedAmount) {
      return showMessage(
        "Missing Receipt",
        "Please upload a screenshot of your GCash payment receipt.",
      );
    }

    let user;
    try {
      user = await getCurrentUser();
    } catch (error) {
      return showMessage(
        "Account Error",
        error instanceof Error ? error.message : "Could not read your session.",
      );
    }
    if (!user) {
      router.replace("/auth/login");
      return;
    }

    setUploading(true);
    try {
      const receiptPath = await uploadPrivateImageToSupabase(
        receiptImageUri,
        "payment-receipts",
        `${user.id}/semester/${Date.now()}.jpg`,
      );

      const { error } = await supabase.rpc("submit_semester_payment", {
        p_amount: selectedAmount,
        p_semester: semester,
        p_receipt_path: receiptPath,
      });
      if (error) throw error;
      setReceiptImageUri(null);
      setSelectedAmount(null);
      setShowPaymentFlow(false);
      await loadSubscriptionData();
      showMessage(
        "Payment Submitted",
        "Your installment receipt is awaiting Admin verification. The ₱30 posting gate unlocks after approval.",
      );
    } catch (e: unknown) {
      showMessage(
        "Upload Failed",
        e instanceof Error ? e.message : "Could not upload receipt. Please try again.",
      );
    } finally {
      setUploading(false);
    }
  }

  function startPayment(amount: 30 | 20) {
    setSelectedAmount(amount);
    setReceiptImageUri(null);
    setShowPaymentFlow(true);
  }

  const focusedPayment = receipts.find((receipt) => receipt.id === paymentId);

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.topRow}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={20} color={Colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.header}>Digital Booth</Text>
          <Text style={styles.subHeader}>
            Subscription &amp; booth fee payment
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 36 }}
      >
        {paymentId ? (
          <View style={styles.focusedPayment}>
            <Text style={styles.focusedPaymentTitle}>
              {focusedPayment ? "Payment record" : "Payment record unavailable"}
            </Text>
            {focusedPayment ? (
              <>
                <Text style={styles.focusedPaymentText}>
                  ₱{focusedPayment.amount} • {focusedPayment.status.toUpperCase()}
                </Text>
                <Text style={styles.focusedPaymentText}>
                  Submitted {new Date(focusedPayment.created_at).toLocaleString()}
                </Text>
                {focusedPayment.rejection_reason ? (
                  <Text style={styles.focusedPaymentError}>
                    {focusedPayment.rejection_reason}
                  </Text>
                ) : null}
                {focusedPayment.receipt_url ? (
                  <Image
                    source={{ uri: focusedPayment.receipt_url }}
                    style={styles.focusedPaymentImage}
                    accessibilityLabel="Receipt for the selected semester payment"
                  />
                ) : null}
              </>
            ) : (
              <Text style={styles.focusedPaymentText}>
                This installment may belong to another semester or was removed.
              </Text>
            )}
          </View>
        ) : null}

        {/* Status Banner */}
        <View
          style={[
            styles.statusBanner,
            subscriptionStatus === "paid" && styles.statusPaid,
            subscriptionStatus === "partial" && styles.statusPartial,
            subscriptionStatus === "unpaid" && styles.statusUnpaid,
          ]}
        >
          <View style={styles.statusTopRow}>
            <View
              style={[
                styles.statusPill,
                subscriptionStatus === "paid" && { backgroundColor: "#BBF7D0" },
                subscriptionStatus === "partial" && {
                  backgroundColor: "#FDE68A",
                },
                subscriptionStatus === "unpaid" && {
                  backgroundColor: "#FECACA",
                },
              ]}
            >
              {subscriptionStatus === "paid" ? (
                <CheckCircle2 size={12} color="#14532D" />
              ) : (
                <Clock size={12} color="#92400E" />
              )}
              <Text
                style={[
                  styles.statusPillText,
                  subscriptionStatus === "unpaid" && { color: "#991B1B" },
                ]}
              >
                {subscriptionStatus === "paid"
                  ? "FULLY PAID"
                  : subscriptionStatus === "partial"
                    ? "PARTIAL — ₱20 REMAINING"
                    : "UNPAID"}
              </Text>
            </View>
            <Store size={20} color="rgba(255,255,255,0.5)" />
          </View>

          <Text style={styles.bannerTitle}>Semester Booth Fee</Text>
          <View style={styles.priceRow}>
            <Text style={styles.priceVal}>
              ₱{amountPaid}
            </Text>
            <Text style={styles.priceUnit}>/ ₱50 paid</Text>
          </View>
          <Text style={styles.termText}>{semester}</Text>

          {/* Payment progress bar */}
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Payment progress</Text>
            <Text style={styles.progressPct}>
              {Math.round((amountPaid / 50) * 100)}%
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.min(100, (amountPaid / 50) * 100)}%` },
              ]}
            />
          </View>
        </View>

        {/* Payment Flow */}
        {showPaymentFlow && selectedAmount !== null ? (
          <View style={styles.paymentFlowCard}>
            <Text style={styles.paymentFlowTitle}>
              Pay ₱{selectedAmount} via GCash
            </Text>

            {/* Admin GCash Details */}
            <View style={styles.adminGcashBox}>
              <View style={styles.gcashBadge}>
                <Text style={styles.gcashG}>G</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.adminGcashLabel}>Send to:</Text>
                <Text style={styles.adminGcashNumber}>
                  {ADMIN_GCASH_NUMBER}
                </Text>
                <Text style={styles.adminGcashName}>{ADMIN_GCASH_NAME}</Text>
              </View>
            </View>

            <Text style={styles.instructionText}>
              1. Open GCash and send ₱{selectedAmount} to the number above
              {"\n"}2. Take a screenshot of your payment receipt{"\n"}3. Upload
              the screenshot below
            </Text>

            {/* Receipt upload */}
            <TouchableOpacity
              style={styles.receiptUploadBox}
              onPress={pickReceiptPhoto}
            >
              {receiptImageUri ? (
                <Image
                  source={{ uri: receiptImageUri }}
                  style={styles.receiptPreview}
                />
              ) : (
                <View style={styles.receiptPlaceholder}>
                  <Upload size={22} color={Colors.primary} />
                  <Text style={styles.receiptUploadText}>
                    Tap to upload receipt screenshot
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setShowPaymentFlow(false);
                  setReceiptImageUri(null);
                  setSelectedAmount(null);
                }}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.submitPayBtn,
                  (!receiptImageUri || uploading) && { opacity: 0.5 },
                ]}
                onPress={handleSubmitPayment}
                disabled={!receiptImageUri || uploading}
              >
                <Text style={styles.submitPayText}>
                  {uploading ? "Uploading..." : `Submit ₱${selectedAmount} Payment`}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            {/* Action Buttons */}
            {pendingReview ? (
              <View style={styles.paidBanner}>
                <Clock size={20} color="#B45309" />
                <Text style={styles.paidBannerText}>
                  Your last installment is awaiting Admin review. You can submit another payment after it is reviewed.
                </Text>
              </View>
            ) : null}
            {!pendingReview && subscriptionStatus === "unpaid" && (
              <TouchableOpacity
                style={styles.payBtn}
                onPress={() => startPayment(30)}
              >
                <Text style={styles.payBtnText}>
                  Pay ₱30 Initial Booth Fee
                </Text>
                <Text style={styles.payBtnSub}>
                  Required before you can post harvests
                </Text>
              </TouchableOpacity>
            )}

            {!pendingReview && subscriptionStatus === "partial" && (
              <TouchableOpacity
                style={[styles.payBtn, { backgroundColor: "#D97706" }]}
                onPress={() => startPayment(20)}
              >
                <Text style={styles.payBtnText}>
                  Pay Remaining ₱20
                </Text>
                <Text style={styles.payBtnSub}>
                  Complete your ₱50 semester fee
                </Text>
              </TouchableOpacity>
            )}

            {!pendingReview && subscriptionStatus === "paid" && (
              <View style={styles.paidBanner}>
                <CheckCircle2 size={20} color={Colors.success} />
                <Text style={styles.paidBannerText}>
                  You&apos;re all set! Your booth fee is fully paid for {semester}.
                </Text>
              </View>
            )}
          </>
        )}

        {/* Payment History */}
        {receipts.length > 0 && (
          <>
            <View style={styles.historyHeader}>
              <Receipt size={16} color={Colors.text} />
              <Text style={styles.sectionTitle}>Payment History</Text>
            </View>

            <View style={styles.historyCard}>
              {receipts.map((r) => (
                <View key={r.id} style={styles.historyRow}>
                  <View style={styles.histIcon}>
                    {r.status === "approved" ? (
                      <CheckCircle2 size={15} color={Colors.success} />
                    ) : (
                      <Clock size={15} color="#B45309" />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.histTitle}>
                      {r.amount === 30
                        ? "Initial Payment"
                        : "Remaining Payment"}{" "}
                      — ₱{r.amount}
                    </Text>
                    <Text style={styles.histDate}>
                      {r.status.replace("_", " ").toUpperCase()} •{" "}
                      {new Date(r.created_at).toLocaleDateString("en-PH", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </Text>
                  </View>
                  {r.receipt_url ? (
                    <TouchableOpacity
                      onPress={() =>
                        showMessage(
                          "Receipt",
                          r.status === "rejected"
                            ? r.rejection_reason || "Receipt was rejected."
                            : "Receipt image is available in your private payment history.",
                        )
                      }
                    >
                      <Text style={styles.viewReceipt}>View</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))}
            </View>
          </>
        )}

        {/* Payment Info */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>How Booth Payments Work</Text>
          <Text style={styles.infoText}>
            • The semester booth fee is ₱50, split into two payments:{"\n"}
            {"  "}— ₱30 initial fee (required to start posting){"\n"}
            {"  "}— ₱20 remaining fee (pay anytime during the semester){"\n"}
            • Send payment via GCash to the admin number shown above.{"\n"}
            • Upload a screenshot of your receipt for verification.{"\n"}
            • Your booth is active once the initial ₱30 is paid.
          </Text>
        </View>
      </ScrollView>
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

  // Status Banner
  statusBanner: {
    padding: 18,
    borderRadius: 20,
    marginBottom: 12,
  },
  focusedPayment: {
    marginBottom: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: "#F0FDF4",
  },
  focusedPaymentTitle: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: "800",
  },
  focusedPaymentText: {
    color: Colors.text,
    fontSize: 12,
    marginTop: 4,
  },
  focusedPaymentError: {
    color: Colors.danger,
    fontSize: 12,
    marginTop: 6,
  },
  focusedPaymentImage: {
    width: "100%",
    height: 190,
    marginTop: 10,
    borderRadius: 10,
    resizeMode: "contain",
    backgroundColor: "#FFF",
  },
  statusPaid: { backgroundColor: Colors.primary },
  statusPartial: { backgroundColor: "#D97706" },
  statusUnpaid: { backgroundColor: "#991B1B" },
  statusTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusPillText: { fontSize: 10, fontWeight: "800", color: "#14532D" },
  bannerTitle: { color: "#FFF", fontSize: 13, fontWeight: "700", opacity: 0.85 },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
    marginTop: 2,
  },
  priceVal: { color: "#FFF", fontSize: 34, fontWeight: "800" },
  priceUnit: { color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: "600" },
  termText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 11,
    marginTop: 4,
    marginBottom: 14,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  progressLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 10,
    fontWeight: "600",
  },
  progressPct: { color: "#FDE68A", fontSize: 10, fontWeight: "800" },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.2)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#FDE68A",
    borderRadius: 3,
  },

  // Payment flow card
  paymentFlowCard: {
    backgroundColor: "#FFF",
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  paymentFlowTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.text,
    marginBottom: 14,
  },
  adminGcashBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#EFF6FF",
    padding: 14,
    borderRadius: 14,
    marginBottom: 14,
  },
  gcashBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
  },
  gcashG: { color: "#FFF", fontSize: 18, fontWeight: "900" },
  adminGcashLabel: { fontSize: 10, color: Colors.textMuted, fontWeight: "600" },
  adminGcashNumber: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.text,
    letterSpacing: 1,
  },
  adminGcashName: { fontSize: 12, color: Colors.textMuted, fontWeight: "600" },
  instructionText: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 20,
    marginBottom: 14,
  },
  receiptUploadBox: {
    height: 160,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: Colors.primary,
    backgroundColor: "#F0FDF4",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  receiptPreview: {
    width: "100%",
    height: "100%",
    resizeMode: "contain",
  },
  receiptPlaceholder: { alignItems: "center", gap: 6 },
  receiptUploadText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.primary,
  },

  cancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
  },
  cancelText: { fontWeight: "700", color: Colors.text, fontSize: 13 },
  submitPayBtn: {
    flex: 2,
    padding: 14,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: "center",
  },
  submitPayText: { fontWeight: "800", color: "#FFF", fontSize: 13 },

  // Pay buttons
  payBtn: {
    backgroundColor: Colors.primary,
    padding: 18,
    borderRadius: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  payBtnText: { color: "#FFF", fontSize: 15, fontWeight: "800" },
  payBtnSub: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
    marginTop: 3,
    fontWeight: "600",
  },

  paidBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#DCFCE7",
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
  },
  paidBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: "#14532D",
  },

  // Payment history
  historyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: Colors.text },

  historyCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: 14,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  histIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#DCFCE7",
    justifyContent: "center",
    alignItems: "center",
  },
  histTitle: { fontSize: 13, fontWeight: "800", color: Colors.text },
  histDate: { fontSize: 11, color: Colors.textMuted },
  viewReceipt: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.primary,
  },

  // Info card
  infoCard: {
    backgroundColor: "#FFF",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 14,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.text,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 20,
  },
});
