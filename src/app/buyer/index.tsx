// src/app/buyer/index.tsx
import { useFocusEffect, useRouter } from "expo-router";
import {
  Bell,
  ChevronDown,
  Heart,
  MapPin,
  MessageSquare,
  Search,
  SlidersHorizontal,
  Sprout,
  Star,
  Store,
} from "lucide-react-native";
import { useCallback, useState } from "react";
import {
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

const CAMPUS_SPOTS = [
  "Main Campus Adssu",
  "Agriculture Dept Stalls",
  "CEIS Lobby",
  "TBI Office",
];

export default function BuyerHomeScreen() {
  const [userName, setUserName] = useState("");
  const [campusIdx, setCampusIdx] = useState(0);
  const [harvests, setHarvests] = useState<any[]>([]);
  const [sponsoredStores, setSponsoredStores] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [category, setCategory] = useState("All");
  const router = useRouter();

  const loadData = useCallback(async () => {
    try {
      const currentUser = await getCurrentUser();
      if (currentUser) {
        const [
          { data: profile, error: profileError },
          { count, error: notificationError },
        ] = await Promise.all([
          supabase
            .from("profiles")
            .select("full_name")
            .eq("id", currentUser.id)
            .maybeSingle(),
          supabase
            .from("notifications")
            .select("id", { count: "exact", head: true })
            .eq("user_id", currentUser.id)
            .eq("is_read", false),
        ]);
        if (profileError) throw profileError;
        if (notificationError) throw notificationError;
        if (profile?.full_name) setUserName(profile.full_name.split(" ")[0]);
        setUnreadCount(count || 0);
      }

      // Load harvests (excludes drafts)
      let productsQuery = supabase
        .from("products")
        .select("*")
        .eq("status", "published")
        .gt("available_stock", 0);
      if (category !== "All")
        productsQuery = productsQuery.eq("category", category);
      const { data: products, error: productsError } = await productsQuery;
      if (productsError) throw productsError;
      setHarvests(products || []);

      // Show only currently active, Admin-approved sponsor placements.
      const { data: sponsorRows, error: sponsorError } = await supabase
        .from("sponsors")
        .select(
          "id, title, subtitle, duration_days, banner_color, image_url, seller_id, updated_at",
        )
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(10);
      if (sponsorError) throw sponsorError;
      const now = Date.now();
      setSponsoredStores(
        (sponsorRows || []).filter(
          (sponsor) =>
            new Date(sponsor.updated_at).getTime() +
              Number(sponsor.duration_days || 0) * 24 * 60 * 60 * 1000 >
            now,
        ),
      );
    } catch (error) {
      console.error("Failed to load buyer home:", error);
    }
  }, [category]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData]),
  );

  function toggleFavorite(id: string) {
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  const featured = harvests.filter((h) => h.is_featured);
  const displayFeatured = featured.length > 0 ? featured : harvests.slice(0, 3);

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 32 }}
    >
      {/* Green Greeting Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarLetter}>
              {userName ? userName[0].toUpperCase() : "J"}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>
              Hello{userName ? `, ${userName}` : ", James"}!
            </Text>
            <TouchableOpacity
              style={styles.campusRow}
              onPress={() =>
                setCampusIdx((prev) => (prev + 1) % CAMPUS_SPOTS.length)
              }
            >
              <MapPin size={12} color="#FDE68A" />
              <Text style={styles.subGreeting}>{CAMPUS_SPOTS[campusIdx]}</Text>
              <ChevronDown size={12} color="#D8F3DC" />
            </TouchableOpacity>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.bellBtn}
              accessibilityRole="button"
              accessibilityLabel="Open chats"
              accessibilityHint="View conversations for your orders"
              onPress={() => router.push("/buyer/message")}
            >
              <MessageSquare size={19} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.bellBtn}
              accessibilityRole="button"
              accessibilityLabel="Open notifications"
              onPress={() => router.push("/buyer/notifications")}
            >
              <Bell size={19} color="#FFF" />
              {unreadCount > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifText}>{unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Bar + Filter Button */}
        <View style={styles.searchRow}>
          <TouchableOpacity
            style={styles.searchBar}
            onPress={() => router.push("/buyer/search")}
          >
            <Search size={16} color={Colors.textMuted} />
            <Text style={styles.searchPlaceholder}>
              Search fresh tilapia, tomatoes, cassava...
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.filterIconBtn}
            onPress={() => router.push("/buyer/search")}
          >
            <SlidersHorizontal size={17} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Category Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {[
          "All",
          "Fresh Vegetables",
          "Fruits",
          "Poultry & Eggs",
          "Aquaculture",
        ].map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[styles.chip, category === cat && styles.chipActive]}
            onPress={() => setCategory(cat)}
          >
            <Text
              style={[styles.chipText, category === cat && { color: "#FFF" }]}
            >
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {sponsoredStores.length > 0 ? (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Sponsored Stores</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.sponsorCarousel}
          >
            {sponsoredStores.map((sponsor) => (
              <TouchableOpacity
                key={sponsor.id}
                style={[
                  styles.sponsorBanner,
                  sponsor.banner_color && {
                    backgroundColor: sponsor.banner_color,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`View listings from sponsored store ${sponsor.title}`}
                accessibilityHint={
                  sponsor.seller_id
                    ? "Opens available listings from the linked seller."
                    : "Opens the campus map."
                }
                onPress={() =>
                  sponsor.seller_id
                    ? router.push({
                        pathname: "/buyer/search",
                        params: { sellerId: sponsor.seller_id },
                      })
                    : router.push("/buyer/map")
                }
              >
                {sponsor.image_url ? (
                  <Image
                    source={{ uri: sponsor.image_url }}
                    style={styles.sponsorImage}
                  />
                ) : (
                  <View style={styles.storeIconWrap}>
                    <Store size={20} color="#FFF" />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <View style={styles.sponsoredPill}>
                    <Text style={styles.sponsoredPillText}>SPONSORED</Text>
                  </View>
                  <Text style={styles.sponsorTitle} numberOfLines={1}>
                    {sponsor.title}
                  </Text>
                  <Text style={styles.sponsorSub} numberOfLines={2}>
                    {sponsor.subtitle || "Explore this campus store"}
                  </Text>
                </View>
                <View style={styles.sponsorRight}>
                  <View style={styles.visitBtn}>
                    <Text style={styles.visitBtnText}>Visit Store</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      ) : null}

      {/* Featured Harvests Horizontal Section */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Featured Harvests</Text>
        <TouchableOpacity onPress={() => router.push("/buyer/search")}>
          <Text style={styles.seeAll}>See all</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
      >
        {displayFeatured.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.featuredCard}
            onPress={() => router.push(`/buyer/harvest/${item.id}` as any)}
          >
            <Image
              source={{
                uri: item.image_url?.startsWith("http")
                  ? item.image_url
                  : "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=400",
              }}
              style={styles.featuredImg}
            />
            <View style={{ flex: 1 }}>
              <View style={styles.featuredTag}>
                <Text style={styles.featuredTagText}>★ FEATURED</Text>
              </View>
              <Text style={styles.itemTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.price}>
                ₱{item.price_per_unit}{" "}
                <Text style={styles.unit}>/ {item.unit}</Text>
              </Text>
              <View style={styles.featuredBottom}>
                <Text style={styles.sellerName} numberOfLines={1}>
                  {item.seller_name || "Agri Unit 3"}
                </Text>
                <View style={styles.orangeStockPill}>
                  <Text style={styles.orangeStockText}>
                    {item.available_stock} left
                  </Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Fresh Today Grid Section */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Fresh Today</Text>
        <TouchableOpacity onPress={() => router.push("/buyer/search")}>
          <Text style={styles.seeAll}>Filter</Text>
        </TouchableOpacity>
      </View>

      {harvests.length === 0 ? (
        <View style={styles.emptyBox}>
          <Sprout size={28} color={Colors.primary} />
          <Text style={styles.emptyTitle}>No Harvests in {category}</Text>
          <Text style={styles.emptySub}>
            Try switching to &quot;All&quot; or check back when campus agri
            units post new harvests.
          </Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {harvests.map((item) => {
            const isLow = Number(item.available_stock) <= 5;
            const isFav = favorites.includes(item.id);
            return (
              <TouchableOpacity
                key={item.id}
                style={styles.gridCard}
                onPress={() => router.push(`/buyer/harvest/${item.id}` as any)}
              >
                <View style={styles.imgWrap}>
                  <Image
                    source={{
                      uri: item.image_url?.startsWith("http")
                        ? item.image_url
                        : "https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=400",
                    }}
                    style={styles.gridImg}
                  />
                  <TouchableOpacity
                    style={styles.heartCircle}
                    onPress={() => toggleFavorite(item.id)}
                  >
                    <Heart
                      size={13}
                      color={isFav ? "#EF4444" : Colors.textMuted}
                      fill={isFav ? "#EF4444" : "transparent"}
                    />
                  </TouchableOpacity>
                  {item.listing_type === "in_ground_preorder" && (
                    <View style={styles.preOrderTag}>
                      <Text style={styles.preOrderTagText}>PRE-ORDER</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.itemTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.price}>
                  ₱{item.price_per_unit}{" "}
                  <Text style={styles.unit}>/ {item.unit}</Text>
                </Text>
                <Text style={styles.sellerName} numberOfLines={1}>
                  {item.seller_name || "Agronomy Soc."}
                </Text>

                <View style={styles.ratingRow}>
                  <Star size={11} color={Colors.accent} fill={Colors.accent} />
                  <Text style={styles.ratingText}>4.8</Text>
                  <Text style={styles.distText}>• 120m</Text>
                </View>

                <View
                  style={[
                    styles.stockAlertBar,
                    { backgroundColor: isLow ? "#FEE2E2" : "#DCFCE7" },
                  ]}
                >
                  <Text
                    style={[
                      styles.stockAlertText,
                      { color: isLow ? "#DC2626" : "#15803D" },
                    ]}
                  >
                    {isLow
                      ? `⚠ Only ${item.available_stock} ${item.unit} left`
                      : `${item.available_stock} ${item.unit} available`}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    backgroundColor: Colors.primary,
    paddingTop: 52,
    paddingBottom: 18,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accent,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarLetter: { fontSize: 17, fontWeight: "800", color: "#111827" },
  greeting: { fontSize: 18, fontWeight: "800", color: "#FFF" },
  campusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  subGreeting: { fontSize: 11, color: "#D8F3DC", fontWeight: "600" },
  bellBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  notifBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "#EF4444",
    width: 15,
    height: 15,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  notifText: { color: "#FFF", fontSize: 9, fontWeight: "800" },
  searchRow: { flexDirection: "row", gap: 8 },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 12,
    gap: 8,
  },
  searchPlaceholder: { color: Colors.textMuted, fontSize: 12 },
  filterIconBtn: {
    backgroundColor: "#2D6A4F",
    width: 42,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  chipRow: { paddingHorizontal: 16, paddingTop: 14, gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 12, fontWeight: "700", color: Colors.text },

  sponsorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F59E0B",
    width: 310,
    padding: 14,
    borderRadius: 16,
    gap: 10,
  },
  sponsorCarousel: { paddingHorizontal: 16, gap: 10 },
  sponsorImage: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  sponsoredPill: {
    backgroundColor: "rgba(0,0,0,0.22)",
    alignSelf: "flex-start",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  sponsoredPillText: { color: "#FFF", fontSize: 8, fontWeight: "800" },
  sponsorTitle: { fontSize: 16, fontWeight: "800", color: "#FFF" },
  sponsorSub: { fontSize: 11, color: "#FEF3C7", marginTop: 2 },
  sponsorRight: { alignItems: "flex-end", gap: 6 },
  visitBtn: {
    backgroundColor: "#FFF",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  visitBtnText: { fontSize: 10, fontWeight: "800", color: "#B45309" },
  storeIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginTop: 18,
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: Colors.text },
  seeAll: { fontSize: 12, fontWeight: "700", color: Colors.primary },

  featuredCard: {
    flexDirection: "row",
    width: 255,
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 10,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
  },
  featuredImg: { width: 72, height: 72, borderRadius: 12 },
  featuredTag: {
    backgroundColor: "#FEF3C7",
    alignSelf: "flex-start",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 3,
  },
  featuredTagText: { fontSize: 9, fontWeight: "800", color: "#B45309" },
  featuredBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
    gap: 4,
  },
  orangeStockPill: {
    backgroundColor: "#FFEDD5",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  orangeStockText: { fontSize: 9, fontWeight: "800", color: "#C2410C" },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: 12,
  },
  gridCard: {
    width: "48.1%",
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  imgWrap: { position: "relative", marginBottom: 8 },
  gridImg: { width: "100%", height: 96, borderRadius: 12 },
  heartCircle: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "#FFF",
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  preOrderTag: {
    position: "absolute",
    bottom: 6,
    left: 6,
    backgroundColor: "#2563EB",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  preOrderTagText: { color: "#FFF", fontSize: 8, fontWeight: "800" },
  itemTitle: { fontSize: 14, fontWeight: "800", color: Colors.text },
  price: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.primary,
    marginTop: 2,
  },
  unit: { fontSize: 11, fontWeight: "500", color: Colors.textMuted },
  sellerName: { fontSize: 11, color: Colors.textMuted, marginTop: 2, flex: 1 },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 3,
    marginBottom: 6,
  },
  ratingText: { fontSize: 11, color: Colors.text, fontWeight: "700" },
  distText: { fontSize: 10, color: Colors.textMuted },
  stockAlertBar: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  stockAlertText: { fontSize: 10, fontWeight: "700" },

  emptyBox: {
    backgroundColor: "#FFF",
    marginHorizontal: 16,
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
});
