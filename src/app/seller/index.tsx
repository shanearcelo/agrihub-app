// src/app/seller/index.tsx
import { useFocusEffect, useRouter } from "expo-router";
import {
    AlertCircle,
    Bell,
    Clock,
    Lock,
    MessageSquare,
    Plus,
    ShoppingBag,
    Sprout,
    TrendingUp,
} from "lucide-react-native";
import { useCallback, useState } from "react";
import {
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
import { getCurrentSemester } from "../../lib/semesterFee";
import { supabase } from "../../lib/supabase";

export default function SellerDashboardScreen() {
  const [unitName, setUnitName] = useState("Agri Dept - Unit 3");
  const [department, setDepartment] = useState("Agriculture Department");
  const [verificationStatus, setVerificationStatus] = useState<
    "pending" | "verified" | "rejected"
  >("pending");
  const [harvests, setHarvests] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [thisWeekRevenue, setThisWeekRevenue] = useState(0);
  const [semesterFeePaid, setSemesterFeePaid] = useState(0);
  const [semesterFeePaymentPending, setSemesterFeePaymentPending] =
    useState(false);
  const router = useRouter();

  function showMessage(title: string, msg: string) {
    if (Platform.OS === "web") {
      window.alert(`${title}: ${msg}`);
    } else {
      Alert.alert(title, msg);
    }
  }

  const loadSellerData = useCallback(async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;
      const [
        { data: profile, error: profileError },
        { data: products, error: productsError },
        { data: orderRows, error: ordersError },
        { data: pendingFeePayments, error: feePaymentsError },
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "full_name, store_name, department, verification_status, semester_fee_paid, semester_fee_semester, subscription_amount_paid, subscription_semester",
          )
          .eq("id", user.id)
          .single(),
        supabase.from("products").select("*").eq("seller_id", user.id),
        supabase.from("orders").select("*").eq("seller_id", user.id),
        supabase
          .from("seller_semester_payments")
          .select("id")
          .eq("seller_id", user.id)
          .eq("semester", getCurrentSemester())
          .eq("status", "pending")
          .limit(1),
      ]);
      if (profileError) throw profileError;
      if (productsError) throw productsError;
      if (ordersError) throw ordersError;
      if (feePaymentsError) throw feePaymentsError;
      setUnitName(profile.store_name || profile.full_name || "Agri Dept - Unit 3");
      setDepartment(profile.department || "Agriculture Department");
      setVerificationStatus(profile.verification_status || "pending");
      setHarvests(products || []);
      setOrders(orderRows || []);
      const currentSemester = getCurrentSemester();
      const paid =
        profile.semester_fee_semester === currentSemester
          ? Number(profile.semester_fee_paid || 0)
          : profile.subscription_semester === currentSemester
            ? Number(profile.subscription_amount_paid || 0)
            : 0;
      setSemesterFeePaid(paid);
      setSemesterFeePaymentPending((pendingFeePayments || []).length > 0);
      const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      setThisWeekRevenue(
        (orderRows || [])
          .filter(
            (order) =>
              order.order_status !== "cancelled" &&
              order.created_at &&
              new Date(order.created_at).getTime() >= oneWeekAgo,
          )
          .reduce((sum, order) => sum + Number(order.total_amount || 0), 0),
      );
    } catch (error) {
      console.error("Failed to load seller dashboard:", error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadSellerData();
    }, [loadSellerData]),
  );

  const isVerified = verificationStatus === "verified";

  const totalRevenue = orders
    .filter((o) => o.order_status !== "cancelled")
    .reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

  const preOrderCount = harvests.filter(
    (h) => h.listing_type === "in_ground_preorder",
  ).length;

  const readyCount = orders.filter(
    (o) => o.order_status === "pending" || o.order_status === "ready_for_pickup",
  ).length;

  const totalStockAll = harvests.reduce(
    (sum, h) => sum + Number(h.total_stock || 0),
    0,
  );
  const availStockAll = harvests.reduce(
    (sum, h) => sum + Number(h.available_stock || 0),
    0,
  );
  const sellThroughRate =
    totalStockAll > 0
      ? Math.round(((totalStockAll - availStockAll) / totalStockAll) * 100)
      : 92;
  const semesterFeeBalance = Math.max(0, 50 - semesterFeePaid);
  const semesterFeeBalanceDue = semesterFeePaid === 30;

  function handlePostPress() {
    if (!isVerified) {
      return showMessage(
        "Verification Required",
        "Your Seller / Farm Unit account is still PENDING Admin review. You can post harvests once approved by the Campus Admin.",
      );
    }
    router.push("/seller/post-harvest");
  }

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Green Revenue Header */}
        <View style={styles.header}>
          <View style={styles.unitRow}>
            <View style={styles.unitAvatar}>
              <Sprout size={18} color="#FDE68A" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.unitName} numberOfLines={1}>
                {unitName}
              </Text>
              <Text style={styles.unitSub} numberOfLines={1}>
                {department} • Seller Dashboard
              </Text>
            </View>

            <View
              style={[
                styles.statusBadge,
                !isVerified && { backgroundColor: "#F59E0B" },
              ]}
            >
              <Text style={styles.statusBadgeText}>
                {isVerified ? "● VERIFIED" : "● PENDING"}
              </Text>
            </View>

            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.bellBtn}
                accessibilityRole="button"
                accessibilityLabel="Open chats"
                accessibilityHint="View conversations for your orders"
                onPress={() => router.push("/seller/messages")}
              >
                <MessageSquare size={17} color="#FFF" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.bellBtn}
                accessibilityRole="button"
                accessibilityLabel="Open orders"
                onPress={() => router.push("/seller/orders")}
              >
                <Bell size={16} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.revRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.revLabel}>TOTAL REVENUE THIS SEMESTER</Text>
              <Text style={styles.revAmount}>
                ₱{totalRevenue.toLocaleString()}
              </Text>
              <Text style={styles.revSub}>
                This week: ₱{thisWeekRevenue.toLocaleString()} • {orders.length}{" "}
                orders
              </Text>
            </View>

            {/* Sparkline Trend Box */}
            <View style={styles.sparkBox}>
              <TrendingUp size={20} color="#34D399" />
              <Text style={styles.sparkText}>+14%</Text>
            </View>
          </View>
        </View>

        {/* Pending Verification Warning Banner */}
        {!isVerified && (
          <View style={styles.pendingBanner}>
            <AlertCircle size={20} color="#B45309" />
            <View style={{ flex: 1 }}>
              <Text style={styles.pendingTitle}>
                {verificationStatus === "rejected"
                  ? "Verification Rejected"
                  : "Awaiting Admin Verification"}
              </Text>
              <Text style={styles.pendingDesc}>
                {verificationStatus === "rejected"
                  ? "Your unit registration was declined. Please update your ID in Profile."
                  : "Campus Admin is reviewing your ID. Posting harvests is locked until verified."}
              </Text>
            </View>
          </View>
        )}

        {semesterFeeBalanceDue && (
          <View style={styles.semesterFeeBanner}>
            <View style={styles.semesterFeeHeading}>
              <AlertCircle size={19} color="#B45309" />
              <Text style={styles.semesterFeeTitle}>
                Semester Fee Balance Due: ₱{semesterFeeBalance}
              </Text>
            </View>
            {semesterFeePaymentPending ? (
              <Text style={styles.semesterFeeDescription}>
                Your remaining installment receipt is awaiting Admin review.
              </Text>
            ) : (
              <>
                <Text style={styles.semesterFeeDescription}>
                  You have paid ₱30 of the ₱50 semester fee.
                </Text>
                <TouchableOpacity
                  style={styles.semesterFeeButton}
                  accessibilityRole="button"
                  accessibilityLabel="Pay remaining 20 peso semester fee"
                  onPress={() => router.push("/seller/subscription")}
                >
                  <Text style={styles.semesterFeeButtonText}>
                    Pay Remaining ₱20
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* 4 KPI Cards Grid */}
        <View style={styles.kpiGrid}>
          <TouchableOpacity
            style={styles.kpiCard}
            onPress={() => router.push("/seller/subscription")}
          >
            <View style={styles.kpiTop}>
              <View style={[styles.kpiIconBox, { backgroundColor: "#DCFCE7" }]}>
                <ShoppingBag size={16} color={Colors.primary} />
              </View>
              <Text style={styles.kpiBadge}>Live</Text>
            </View>
            <Text style={styles.kpiVal}>{harvests.length}</Text>
            <Text style={styles.kpiLbl}>Active Listings</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.kpiCard}
            onPress={() => router.push("/seller/pre-orders")}
          >
            <View style={styles.kpiTop}>
              <View style={[styles.kpiIconBox, { backgroundColor: "#DBEAFE" }]}>
                <Clock size={16} color="#2563EB" />
              </View>
              <Text
                style={[
                  styles.kpiBadge,
                  { color: "#2563EB", backgroundColor: "#EFF6FF" },
                ]}
              >
                Track ›
              </Text>
            </View>
            <Text style={styles.kpiVal}>{preOrderCount}</Text>
            <Text style={styles.kpiLbl}>Pending Pre-Orders</Text>
          </TouchableOpacity>

          <View style={styles.kpiCard}>
            <View style={styles.kpiTop}>
              <View style={[styles.kpiIconBox, { backgroundColor: "#ECFDF5" }]}>
                <TrendingUp size={16} color={Colors.success} />
              </View>
              <Text style={styles.kpiBadge}>+6%</Text>
            </View>
            <Text style={styles.kpiVal}>{sellThroughRate}%</Text>
            <Text style={styles.kpiLbl}>Sell-Through Rate</Text>
          </View>

          <TouchableOpacity
            style={styles.kpiCard}
            onPress={() => router.push("/seller/orders")}
          >
            <View style={styles.kpiTop}>
              <View style={[styles.kpiIconBox, { backgroundColor: "#FEF3C7" }]}>
                <Sprout size={16} color="#D97706" />
              </View>
              <Text
                style={[
                  styles.kpiBadge,
                  { color: "#B45309", backgroundColor: "#FFFBEB" },
                ]}
              >
                Queue ›
              </Text>
            </View>
            <Text style={styles.kpiVal}>{readyCount}</Text>
            <Text style={styles.kpiLbl}>Ready for Pick-Up</Text>
          </TouchableOpacity>
        </View>

        {/* Active Harvests Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Active Harvests</Text>
          <TouchableOpacity onPress={() => router.push("/seller/pre-orders")}>
            <Text style={styles.linkText}>Manage ›</Text>
          </TouchableOpacity>
        </View>

        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          {harvests.length === 0 ? (
            <View style={styles.emptyBox}>
              <Sprout size={28} color={Colors.primary} />
              <Text style={styles.emptyTitle}>No Harvest Listings Yet</Text>
              <Text style={styles.emptySub}>
                {isVerified
                  ? "Tap '+ Post New Harvest' below to list your fresh crops."
                  : "Once verified by Admin, you can start posting harvests here."}
              </Text>
            </View>
          ) : (
            harvests.map((item) => {
              const total = Number(item.total_stock || 1);
              const avail = Number(item.available_stock || 0);
              const pct = Math.min(100, Math.round((avail / total) * 100));
              const isLow = pct <= 25;

              return (
                <View key={item.id} style={styles.harvestRow}>
                  <Image
                    source={{
                      uri: item.image_url?.startsWith("http")
                        ? item.image_url
                        : "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=200",
                    }}
                    style={styles.thumb}
                  />
                  <View style={{ flex: 1 }}>
                    <View style={styles.hTopLine}>
                      <Text style={styles.hTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <View
                        style={[
                          styles.typeBadge,
                          isLow && { backgroundColor: "#FEF2F2" },
                          item.listing_type === "in_ground_preorder" && {
                            backgroundColor: "#DBEAFE",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.typeText,
                            isLow && { color: Colors.danger },
                            item.listing_type === "in_ground_preorder" && {
                              color: "#1D4ED8",
                            },
                          ]}
                        >
                          {item.listing_type === "in_ground_preorder"
                            ? "Pre-Order"
                            : isLow
                              ? `${avail} left`
                              : "Selling fast"}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.hMeta}>
                      ₱{item.price_per_unit}/{item.unit} • {avail}/{total}{" "}
                      {item.unit} available
                    </Text>

                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${pct}%`,
                            backgroundColor: isLow ? "#F59E0B" : Colors.primary,
                          },
                        ]}
                      />
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Floating + Post New Harvest Button */}
      <TouchableOpacity
        style={[styles.fab, !isVerified && { backgroundColor: "#6B7280" }]}
        onPress={handlePostPress}
      >
        {isVerified ? (
          <Plus size={18} color="#FFF" />
        ) : (
          <Lock size={16} color="#FFF" />
        )}
        <Text style={styles.fabText}>
          {isVerified ? "Post New Harvest" : "Verification Pending"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: Colors.primary,
    paddingTop: 52,
    paddingBottom: 24,
    paddingHorizontal: 18,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  unitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  unitAvatar: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.16)",
    justifyContent: "center",
    alignItems: "center",
  },
  unitName: { color: "#FFF", fontSize: 15, fontWeight: "800" },
  unitSub: { color: "#D8F3DC", fontSize: 10, marginTop: 1 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusBadge: {
    backgroundColor: "#22C55E",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusBadgeText: { color: "#FFF", fontSize: 9, fontWeight: "800" },
  bellBtn: {
    backgroundColor: "rgba(255,255,255,0.16)",
    padding: 8,
    borderRadius: 10,
  },
  revRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  revLabel: { color: "#A7F3D0", fontSize: 10, fontWeight: "700" },
  revAmount: { color: "#FFF", fontSize: 32, fontWeight: "800", marginTop: 2 },
  revSub: { color: "#D8F3DC", fontSize: 11, marginTop: 2 },
  sparkBox: {
    backgroundColor: "rgba(255,255,255,0.14)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: "center",
  },
  sparkText: {
    color: "#34D399",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 2,
  },

  pendingBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFFBEB",
    marginHorizontal: 16,
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  pendingTitle: { fontSize: 13, fontWeight: "800", color: "#92400E" },
  pendingDesc: { fontSize: 11, color: "#B45309", marginTop: 2 },
  semesterFeeBanner: {
    marginHorizontal: 16,
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FDE68A",
    backgroundColor: "#FFFBEB",
  },
  semesterFeeHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  semesterFeeTitle: {
    flex: 1,
    color: "#92400E",
    fontSize: 13,
    fontWeight: "800",
  },
  semesterFeeDescription: {
    color: "#B45309",
    fontSize: 11,
    marginTop: 5,
    marginLeft: 27,
  },
  semesterFeeButton: {
    alignSelf: "flex-start",
    minHeight: 40,
    justifyContent: "center",
    marginTop: 10,
    marginLeft: 27,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: "#D97706",
  },
  semesterFeeButtonText: { color: "#FFF", fontSize: 12, fontWeight: "800" },

  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 16,
    gap: 10,
  },
  kpiCard: {
    width: "48.3%",
    backgroundColor: "#FFF",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  kpiTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  kpiIconBox: {
    width: 30,
    height: 30,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  kpiBadge: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.success,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  kpiVal: {
    fontSize: 22,
    fontWeight: "800",
    color: Colors.text,
    marginTop: 10,
  },
  kpiLbl: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: "600",
    marginTop: 2,
  },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: Colors.text },
  linkText: { fontSize: 12, fontWeight: "700", color: Colors.primary },

  harvestRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFF",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  thumb: { width: 50, height: 50, borderRadius: 12 },
  hTopLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 6,
  },
  hTitle: { fontSize: 14, fontWeight: "800", color: Colors.text, flex: 1 },
  hMeta: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  progressTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.background,
    marginTop: 7,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 3 },
  typeBadge: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  typeText: { fontSize: 10, fontWeight: "800", color: Colors.primary },

  emptyBox: {
    backgroundColor: "#FFF",
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.text,
    marginTop: 8,
  },
  emptySub: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: "center",
    marginTop: 4,
  },

  fab: {
    position: "absolute",
    bottom: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 28,
    elevation: 4,
  },
  fabText: { color: "#FFF", fontWeight: "800", fontSize: 13 },
});
