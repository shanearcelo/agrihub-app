// src/app/buyer/search.tsx
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Search,
  SlidersHorizontal,
  Star,
  X,
} from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Colors } from "../../constants/theme";
import { supabase } from "../../lib/supabase";

export default function SearchFilterScreen() {
  const searchParams = useLocalSearchParams<{ sellerId?: string | string[] }>();
  const sellerId = Array.isArray(searchParams.sellerId)
    ? searchParams.sellerId[0]
    : searchParams.sellerId;
  const [searchText, setSearchText] = useState("");
  const [sortPriceAsc, setSortPriceAsc] = useState(true);
  const [within500m, setWithin500m] = useState(true);
  const [onlyHarvestedToday, setOnlyHarvestedToday] = useState(!sellerId);
  const [results, setResults] = useState<any[]>([]);
  const [preorderResults, setPreorderResults] = useState<any[]>([]);
  const router = useRouter();

  const fetchResults = useCallback(async () => {
    try {
      let productsQuery = supabase
        .from("products")
        .select("*")
        .eq("status", "published")
        .gt("available_stock", 0);
      if (sellerId) productsQuery = productsQuery.eq("seller_id", sellerId);
      const { data, error } = await productsQuery;
      if (error) throw error;
      let list = data || [];

      if (searchText.trim()) {
        const low = searchText.trim().toLowerCase();
        list = list.filter(
          (i) =>
            i.title?.toLowerCase().includes(low) ||
            i.category?.toLowerCase().includes(low) ||
            i.seller_name?.toLowerCase().includes(low),
        );
      }

      // Separate immediate stock vs in-ground pre-orders
      const immediate = list.filter(
        (i) => i.listing_type !== "in_ground_preorder",
      );
      const preorders = list.filter(
        (i) => i.listing_type === "in_ground_preorder",
      );

      const sorter = (a: any, b: any) =>
        sortPriceAsc
          ?           Number(a.price_per_unit || 0) - Number(b.price_per_unit || 0)
          : Number(b.price_per_unit || 0) - Number(a.price_per_unit || 0);

      immediate.sort(sorter);
      preorders.sort(sorter);

      setResults(immediate);
      setPreorderResults(onlyHarvestedToday ? [] : preorders);
    } catch (e) {
      console.error("Failed to fetch search results:", e);
    }
  }, [onlyHarvestedToday, searchText, sellerId, sortPriceAsc]);

  useEffect(() => {
    void Promise.resolve().then(fetchResults);
  }, [fetchResults]);

  function clearAllFilters() {
    setOnlyHarvestedToday(false);
    setWithin500m(false);
    setSearchText("");
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 36 }}
    >
      {/* Top Search Bar */}
      <View style={styles.topRow}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={20} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.searchBox}>
          <Search size={17} color={Colors.primary} />
          <TextInput
            style={styles.input}
            placeholder="Search tomatoes, pechay, tilapia..."
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText("")}>
              <X size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Multi-Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        <TouchableOpacity
          style={[styles.chip, sortPriceAsc && styles.chipActive]}
          onPress={() => setSortPriceAsc(!sortPriceAsc)}
        >
          <Text
            style={[styles.chipText, sortPriceAsc && styles.chipTextActive]}
          >
            {sortPriceAsc ? "Price: Low to High ✕" : "Price: High to Low"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.chip, within500m && styles.chipActive]}
          onPress={() => setWithin500m(!within500m)}
        >
          <Text style={[styles.chipText, within500m && styles.chipTextActive]}>
            {within500m ? "Distance < 500m ✕" : "All Campus Zones"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.chip, onlyHarvestedToday && styles.chipActive]}
          onPress={() => setOnlyHarvestedToday(!onlyHarvestedToday)}
        >
          <Text
            style={[
              styles.chipText,
              onlyHarvestedToday && styles.chipTextActive,
            ]}
          >
            {onlyHarvestedToday ? "Harvested Today ✕" : "Include Pre-Orders"}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Results Header */}
      <View style={styles.countRow}>
        <Text style={styles.countText}>
          {sellerId
            ? `${results.length} seller listing${results.length === 1 ? "" : "s"}`
            : `${results.length} ${results.length === 1 ? "result" : "results"}${searchText ? ` for "${searchText}"` : ""}`}
        </Text>
        <View style={styles.filterBadge}>
          <SlidersHorizontal size={12} color={Colors.primary} />
          <Text style={styles.filterBadgeText}>
            {sortPriceAsc ? "Lowest ₱" : "Highest ₱"}
          </Text>
        </View>
      </View>

      {/* Immediate Harvest Results */}
      <View style={{ paddingHorizontal: 16, gap: 10 }}>
        {results.length === 0 ? (
          <View style={styles.emptyBox}>
            <Search size={26} color={Colors.primary} />
            <Text style={styles.emptyTitle}>No immediate harvests found</Text>
            <Text style={styles.emptySub}>
              Try another keyword or clear active filters below.
            </Text>
          </View>
        ) : (
          results.map((item) => {
            const isLow = Number(item.available_stock) <= 5;
            return (
              <TouchableOpacity
                key={item.id}
                style={styles.resultCard}
                onPress={() => router.push(`/buyer/harvest/${item.id}` as any)}
              >
                <Image
                  source={{
                    uri: item.image_url?.startsWith("http")
                      ? item.image_url
                      : "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=300",
                  }}
                  style={styles.img}
                />
                <View style={{ flex: 1 }}>
                  <View style={styles.titleRow}>
                    <Text style={styles.title} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <View style={styles.distPill}>
                      <MapPin size={10} color={Colors.textMuted} />
                      <Text style={styles.distText}>120m</Text>
                    </View>
                  </View>

                  <Text style={styles.price}>
                    ₱{item.price_per_unit}{" "}
                    <Text style={styles.unit}>/ {item.unit}</Text>
                  </Text>

                  <Text style={styles.seller} numberOfLines={1}>
                    {item.seller_name || "Agri Dept - Unit 3"}
                  </Text>

                  <View style={styles.metaFooter}>
                    <View style={styles.ratingRow}>
                      <Star
                        size={11}
                        color={Colors.accent}
                        fill={Colors.accent}
                      />
                      <Text style={styles.rating}>4.8</Text>
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>Harvested today</Text>
                      </View>
                    </View>

                    <Text
                      style={[
                        styles.stockTxt,
                        isLow && { color: Colors.danger },
                      ]}
                    >
                      {item.available_stock} {item.unit} left
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>

      {/* In-Ground Pre-Orders Section */}
      <View style={styles.preorderHeader}>
        <Text style={styles.preorderTitle}>In-Ground Pre-orders</Text>
        <Text style={styles.preorderFilter}>
          Filter: {onlyHarvestedToday ? "Harvested Today" : "Showing All"}
        </Text>
      </View>

      {onlyHarvestedToday ? (
        <View style={styles.emptyBox}>
          <View style={styles.emptyIconCircle}>
            <Search size={24} color={Colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>No crops match your filter</Text>
          <Text style={styles.emptySub}>
            Try removing &quot;Harvested Today&quot; to see upcoming in-ground pre-orders.
          </Text>
          <TouchableOpacity style={styles.clearBtn} onPress={clearAllFilters}>
            <Text style={styles.clearBtnText}>↻ Clear filters</Text>
          </TouchableOpacity>
        </View>
      ) : preorderResults.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>No In-Ground Pre-orders Listed</Text>
          <Text style={styles.emptySub}>
            Check back soon when campus farms post upcoming harvests.
          </Text>
        </View>
      ) : (
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          {preorderResults.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.resultCard}
              onPress={() => router.push(`/buyer/harvest/${item.id}` as any)}
            >
              <Image
                source={{
                  uri: item.image_url?.startsWith("http")
                    ? item.image_url
                    : "https://images.unsplash.com/photo-1551754655-cd27e38d2076?w=300",
                }}
                style={styles.img}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.price}>
                  ₱{item.price_per_unit}{" "}
                  <Text style={styles.unit}>/ {item.unit}</Text>
                </Text>
                <Text style={styles.seller}>
                  {item.seller_name || "Agri Dept - Unit 3"}
                </Text>
                <View style={styles.preorderTagRow}>
                  <Calendar size={11} color="#1D4ED8" />
                  <Text style={styles.preorderTagText}>
                    Est. Harvest: {item.expected_harvest || "In 5 days"} •{" "}
                    {item.available_stock} {item.unit} open
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, paddingTop: 52 },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 10,
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
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: 24,
    paddingHorizontal: 14,
    gap: 8,
  },
  input: { flex: 1, paddingVertical: 10, fontSize: 13 },
  chipRow: { paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: { backgroundColor: "#DCFCE7", borderColor: Colors.primary },
  chipText: { fontSize: 11, fontWeight: "700", color: Colors.text },
  chipTextActive: { color: Colors.primary },

  countRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginTop: 14,
    marginBottom: 8,
  },
  countText: { fontSize: 12, fontWeight: "800", color: Colors.text },
  filterBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFF",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterBadgeText: { fontSize: 10, fontWeight: "700", color: Colors.primary },

  resultCard: {
    flexDirection: "row",
    backgroundColor: "#FFF",
    padding: 12,
    borderRadius: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
  },
  img: { width: 70, height: 70, borderRadius: 12 },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 6,
  },
  title: { fontSize: 14, fontWeight: "800", color: Colors.text, flex: 1 },
  distPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: Colors.background,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  distText: { fontSize: 10, color: Colors.textMuted, fontWeight: "700" },
  price: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.primary,
    marginTop: 2,
  },
  unit: { fontSize: 11, fontWeight: "500", color: Colors.textMuted },
  seller: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  metaFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 5,
  },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  rating: { fontSize: 11, fontWeight: "700", color: Colors.textMuted },
  badge: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 4,
  },
  badgeText: { fontSize: 9, fontWeight: "800", color: Colors.primary },
  stockTxt: { fontSize: 10, fontWeight: "700", color: Colors.textMuted },

  preorderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginTop: 22,
    marginBottom: 10,
  },
  preorderTitle: { fontSize: 14, fontWeight: "800", color: Colors.text },
  preorderFilter: { fontSize: 11, color: Colors.textMuted },
  preorderTagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#DBEAFE",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 5,
  },
  preorderTagText: { fontSize: 10, fontWeight: "700", color: "#1D4ED8" },

  emptyBox: {
    marginHorizontal: 16,
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#DCFCE7",
    justifyContent: "center",
    alignItems: "center",
  },
  emptyTitle: { fontSize: 14, fontWeight: "800", marginTop: 10 },
  emptySub: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: "center",
    marginTop: 4,
  },
  clearBtn: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: "#F0FDF4",
  },
  clearBtnText: { fontSize: 12, fontWeight: "700", color: Colors.primary },
});
