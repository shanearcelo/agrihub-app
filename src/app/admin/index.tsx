// src/app/admin/index.tsx
import { useFocusEffect, useRouter } from "expo-router";
import {
  AlertCircle,
  Bell,
  LogOut,
  ShoppingBag,
  Sprout,
  Store,
  TrendingUp,
  Users,
} from "lucide-react-native";
import { useCallback, useState } from "react";
import { BrandLogo } from "../../components/BrandLogo";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Colors } from "../../constants/theme";
import { supabase } from "../../lib/supabase";

const TIME_FILTERS = ["Today", "This Week", "This Month", "Semester"] as const;
type TimeFilter = (typeof TIME_FILTERS)[number];

export default function AdminOverviewScreen() {
  const [selectedFilter, setSelectedFilter] =
    useState<TimeFilter>("This Month");
  const [stats, setStats] = useState({
    activeSellers: 0,
    produceSoldKg: 0,
    revenue: 0,
    buyers: 0,
    pendingSellers: 0,
    pendingSponsors: 0,
    boothsRevenue: 0,
    featuredRevenue: 0,
    sponsorRevenue: 0,
  });
  const router = useRouter();

  const loadAdminStats = useCallback(async () => {
    try {
      const [profilesResult, ordersResult, productsResult, sponsorsResult] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("id, role, verification_status, semester_fee_paid"),
          supabase
            .from("orders")
            .select("total_amount, quantity_kg, items, created_at, order_status"),
          supabase.from("products").select("is_featured, featured_fee"),
          supabase.from("sponsors").select("status, amount"),
        ]);
      if (profilesResult.error) throw profilesResult.error;
      if (ordersResult.error) throw ordersResult.error;
      if (productsResult.error) throw productsResult.error;
      if (sponsorsResult.error) throw sponsorsResult.error;
      const profiles = profilesResult.data || [];
      const orders = ordersResult.data || [];
      const products = productsResult.data || [];
      const sponsors = sponsorsResult.data || [];
      const buyers = profiles.filter((profile) => profile.role === "buyer").length;
      const activeSellers = profiles.filter(
        (profile) =>
          profile.role === "seller" &&
          profile.verification_status === "verified",
      ).length;
      const pendingSellers = profiles.filter(
        (profile) =>
          profile.role === "seller" &&
          profile.verification_status === "pending",
      ).length;

      const now = new Date();
      const filteredOrders = orders.filter((o) => {
        if (!o.created_at) return true;
        const created = new Date(o.created_at);
        const diffDays =
          (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
        if (selectedFilter === "Today") return diffDays <= 1;
        if (selectedFilter === "This Week") return diffDays <= 7;
        if (selectedFilter === "This Month") return diffDays <= 30;
        return diffDays <= 150;
      });

      const produceSoldKg = filteredOrders
        .filter((order) => order.order_status === "completed")
        .reduce((sum, order) => {
          const itemQuantity = Array.isArray(order.items)
            ? order.items.reduce(
                (quantity: number, item: { quantity?: number }) =>
                  quantity + Number(item.quantity || 0),
                0,
              )
            : 0;
          return sum + Number(order.quantity_kg || itemQuantity);
        }, 0);
      const boothsRevenue = profiles.reduce(
        (sum, profile) => sum + Number(profile.semester_fee_paid || 0),
        0,
      );
      const featuredRevenue = products.reduce(
        (sum, product) =>
          sum +
          (product.is_featured ? Number(product.featured_fee || 0) : 0),
        0,
      );
      const sponsorRevenue = sponsors
        .filter((sponsor) => sponsor.status === "approved")
        .reduce((sum, sponsor) => sum + Number(sponsor.amount || 0), 0);
      const pendingSponsors = sponsors.filter(
        (sponsor) => sponsor.status === "pending",
      ).length;

      setStats({
        activeSellers,
        produceSoldKg,
        revenue: boothsRevenue + featuredRevenue + sponsorRevenue,
        buyers,
        pendingSellers,
        pendingSponsors,
        boothsRevenue,
        featuredRevenue,
        sponsorRevenue,
      });
    } catch (error) {
      console.error("Failed to load admin overview stats:", error);
    }
  }, [selectedFilter]);

  useFocusEffect(
    useCallback(() => {
      void loadAdminStats();
    }, [loadAdminStats]),
  );

  const totalMonetization =
    stats.boothsRevenue + stats.featuredRevenue + stats.sponsorRevenue;
  const boothPct =
    totalMonetization > 0
      ? Math.round((stats.boothsRevenue / totalMonetization) * 100)
      : 39;
  const featuredPct =
    totalMonetization > 0
      ? Math.round((stats.featuredRevenue / totalMonetization) * 100)
      : 25;
  const sponsorPct =
    totalMonetization > 0 ? Math.max(0, 100 - boothPct - featuredPct) : 36;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 32 }}
    >
      {/* Top Green Header */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={styles.brandRow}>
            <BrandLogo size={38} />
            <View>
              <Text style={styles.headerTitle}>Campus Admin</Text>
              <Text style={styles.headerSub}>
                TBI & CCIS Oversight • ADSSU Main
              </Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => router.push("/admin/verification")}
            >
              <Bell size={18} color="#FFF" />
              {stats.pendingSellers > 0 && <View style={styles.notifDot} />}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={async () => {
                const { error } = await supabase.auth.signOut();
                if (error) {
                  console.error("Could not sign out admin.", error);
                  Alert.alert("Sign Out Failed", error.message);
                  return;
                }
                router.replace("/auth/login");
              }}
            >
              <LogOut size={18} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.statusBanner}>
          <View style={styles.statusLeft}>
            <View style={styles.greenDot} />
            <Text style={styles.statusText}>All services operational</Text>
          </View>
          <Text style={styles.uptimeText}>99.98% uptime</Text>
        </View>
      </View>

      {/* Time Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {TIME_FILTERS.map((filter) => {
          const active = selectedFilter === filter;
          return (
            <TouchableOpacity
              key={filter}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setSelectedFilter(filter)}
            >
              <Text
                style={[styles.filterText, active && styles.filterTextActive]}
              >
                {filter}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* 2x2 KPI Grid */}
      <View style={styles.grid}>
        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push("/admin/verification")}
        >
          <View style={styles.cardTop}>
            <View style={[styles.iconBox, { backgroundColor: "#DCFCE7" }]}>
              <Store size={16} color={Colors.primary} />
            </View>
            <Text style={styles.growthBadge}>+{stats.activeSellers}</Text>
          </View>
          <Text style={styles.val}>{stats.activeSellers}</Text>
          <Text style={styles.lbl}>Total Active Sellers</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push("/admin/analytics")}
        >
          <View style={styles.cardTop}>
            <View style={[styles.iconBox, { backgroundColor: "#FEF3C7" }]}>
              <ShoppingBag size={16} color="#D97706" />
            </View>
            <Text style={styles.growthBadge}>+18%</Text>
          </View>
          <Text style={styles.val}>{stats.produceSoldKg.toLocaleString()}</Text>
          <Text style={styles.lbl}>Produce Sold (kg)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push("/admin/monetization")}
        >
          <View style={styles.cardTop}>
            <View style={[styles.iconBox, { backgroundColor: "#E0E7FF" }]}>
              <TrendingUp size={16} color="#4F46E5" />
            </View>
            <Text style={styles.growthBadge}>+24%</Text>
          </View>
          <Text style={styles.val}>₱{stats.revenue.toLocaleString()}</Text>
          <Text style={styles.lbl}>Platform Revenue</Text>
        </TouchableOpacity>

        <View style={styles.card}>
          <View style={styles.cardTop}>
            <View style={[styles.iconBox, { backgroundColor: "#DBEAFE" }]}>
              <Users size={16} color="#2563EB" />
            </View>
            <Text style={styles.growthBadge}>+{stats.buyers}</Text>
          </View>
          <Text style={styles.val}>{stats.buyers.toLocaleString()}</Text>
          <Text style={styles.lbl}>Active Buyers</Text>
        </View>
      </View>

      {/* Monthly Platform Revenue Card */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Monthly Platform Revenue</Text>
          <Text style={styles.sectionSubRight}>
            {selectedFilter === "Semester" ? "AY 2026" : "Nov 2026"}
          </Text>
        </View>

        <View style={styles.revenueContent}>
          {/* Donut Summary Ring */}
          <View style={styles.donutRing}>
            <Text style={styles.donutLabel}>Total</Text>
            <Text style={styles.donutValue}>
              ₱
              {totalMonetization >= 1000
                ? `${(totalMonetization / 1000).toFixed(1)}k`
                : totalMonetization}
            </Text>
          </View>

          {/* Breakdown Rows */}
          <View style={styles.breakdownList}>
            <View style={styles.breakdownRow}>
              <View style={styles.legendLeft}>
                <View
                  style={[
                    styles.legendDot,
                    { backgroundColor: Colors.primary },
                  ]}
                />
                <Text style={styles.legendLabel}>Booths (₱50/sem)</Text>
              </View>
              <Text style={styles.legendValue}>
                ₱{stats.boothsRevenue.toLocaleString()} • {boothPct}%
              </Text>
            </View>

            <View style={styles.breakdownRow}>
              <View style={styles.legendLeft}>
                <View
                  style={[styles.legendDot, { backgroundColor: "#F59E0B" }]}
                />
                <Text style={styles.legendLabel}>Featured (₱20)</Text>
              </View>
              <Text style={styles.legendValue}>
                ₱{stats.featuredRevenue.toLocaleString()} • {featuredPct}%
              </Text>
            </View>

            <View style={styles.breakdownRow}>
              <View style={styles.legendLeft}>
                <View
                  style={[styles.legendDot, { backgroundColor: "#10B981" }]}
                />
                <Text style={styles.legendLabel}>Sponsor Ads (₱30)</Text>
              </View>
              <Text style={styles.legendValue}>
                ₱{stats.sponsorRevenue.toLocaleString()} • {sponsorPct}%
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Needs Attention Section */}
      <View style={styles.attentionHeader}>
        <Text style={styles.sectionTitle}>Needs Attention</Text>
        <TouchableOpacity onPress={() => router.push("/admin/verification")}>
          <Text style={styles.viewAllText}>View all</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.alertBox}
        onPress={() => router.push("/admin/verification")}
      >
        <View style={styles.alertIconWrap}>
          <AlertCircle size={18} color="#D97706" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.alertTitle}>
            {stats.pendingSellers} seller{" "}
            {stats.pendingSellers === 1 ? "verification" : "verifications"}{" "}
            pending
          </Text>
          <Text style={styles.alertSub}>
            Tap to review ID documents & approve units
          </Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.alertBox,
          { marginTop: 10, backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" },
        ]}
        onPress={() => router.push("/admin/monetization")}
      >
        <View style={[styles.alertIconWrap, { backgroundColor: "#DBEAFE" }]}>
          <Sprout size={18} color="#2563EB" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.alertTitle, { color: "#1E3A8A" }]}>
            {stats.pendingSponsors} sponsor banners awaiting review
          </Text>
          <Text style={[styles.alertSub, { color: "#3B82F6" }]}>
            Manage featured crops & campus placements
          </Text>
        </View>
        <Text style={[styles.chevron, { color: "#2563EB" }]}>›</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    backgroundColor: Colors.primary,
    paddingTop: 54,
    paddingBottom: 20,
    paddingHorizontal: 18,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerTitle: { color: "#FFF", fontSize: 20, fontWeight: "800" },
  headerSub: { color: "#D8F3DC", fontSize: 11, marginTop: 1 },
  headerActions: { flexDirection: "row", gap: 8 },
  iconBtn: {
    backgroundColor: "rgba(255,255,255,0.16)",
    padding: 9,
    borderRadius: 12,
    position: "relative",
  },
  notifDot: {
    position: "absolute",
    top: 7,
    right: 7,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#F59E0B",
  },
  statusBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginTop: 14,
  },
  statusLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  greenDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#34D399",
  },
  statusText: { color: "#ECFDF5", fontSize: 11, fontWeight: "700" },
  uptimeText: { color: "#A7F3D0", fontSize: 11, fontWeight: "700" },

  filterRow: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterText: { fontSize: 12, fontWeight: "700", color: Colors.textMuted },
  filterTextActive: { color: "#FFF" },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 10,
  },
  card: {
    width: "48.3%",
    backgroundColor: "#FFF",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  iconBox: {
    width: 30,
    height: 30,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  growthBadge: {
    fontSize: 11,
    fontWeight: "800",
    color: Colors.success,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  val: {
    fontSize: 21,
    fontWeight: "800",
    color: Colors.text,
    marginTop: 10,
  },
  lbl: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: "600",
    marginTop: 2,
  },

  sectionCard: {
    backgroundColor: "#FFF",
    marginHorizontal: 16,
    marginTop: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: Colors.text },
  sectionSubRight: { fontSize: 11, fontWeight: "700", color: Colors.textMuted },
  revenueContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  donutRing: {
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 9,
    borderColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
  },
  donutLabel: { fontSize: 10, color: Colors.textMuted, fontWeight: "700" },
  donutValue: { fontSize: 14, fontWeight: "800", color: Colors.text },
  breakdownList: { flex: 1, gap: 9 },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  legendLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 11, fontWeight: "600", color: Colors.text },
  legendValue: { fontSize: 11, fontWeight: "700", color: Colors.textMuted },

  attentionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 18,
    marginBottom: 10,
  },
  viewAllText: { fontSize: 12, fontWeight: "700", color: Colors.primary },
  alertBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFBEB",
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  alertIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#FEF3C7",
    justifyContent: "center",
    alignItems: "center",
  },
  alertTitle: { fontSize: 13, fontWeight: "800", color: "#92400E" },
  alertSub: { fontSize: 11, color: "#B45309", marginTop: 1 },
  chevron: { fontSize: 20, fontWeight: "700", color: "#B45309" },
});
