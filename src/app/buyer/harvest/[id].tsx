// src/app/buyer/harvest/[id].tsx
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  BadgeCheck,
  Calendar,
  Heart,
  MapPin,
  MessageSquare,
  Star,
} from "lucide-react-native";
import { useEffect, useState } from "react";
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
import { Colors } from "../../../constants/theme";
import { useCart } from "../../../context/CartContext";
import { getCurrentUser } from "../../../lib/authHelpers";
import { supabase } from "../../../lib/supabase";

export default function HarvestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<any>(null);
  const [qty, setQty] = useState(1);
  const [isLiked, setIsLiked] = useState(false);
  const { addToCart } = useCart();
  const router = useRouter();

  useEffect(() => {
    if (!id) return;
    let active = true;
    void (async () => {
      try {
        const { data, error } = await supabase
          .from("products")
          .select("*")
          .eq("id", id)
          .maybeSingle();
        if (error) throw error;
        if (active && data) setItem(data);
      } catch (error) {
        console.error("Could not load product details.", error);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  function showMessage(title: string, msg: string) {
    if (Platform.OS === "web") {
      window.alert(`${title}: ${msg}`);
    } else {
      Alert.alert(title, msg);
    }
  }

  if (!item) {
    return (
      <View style={styles.loadingWrap}>
        <Text style={styles.loadingText}>Loading harvest details...</Text>
      </View>
    );
  }

  const isPreOrder = item.listing_type === "in_ground_preorder";
  const maxStock = Number(item.available_stock) || 1;
  const totalStock = Number(item.total_stock) || maxStock;
  const stockPct =
    totalStock > 0
      ? Math.min(100, Math.round((maxStock / totalStock) * 100))
      : 50;
  const subtotal = (Number(item.price_per_unit || 0) * qty).toFixed(2);

  const sellerInitials = (item.seller_name || "Agri Unit")
    .split(" ")
    .slice(0, 2)
    .map((w: string) => w[0])
    .join("")
    .toUpperCase();

  function handleAdd(goCheckout = false) {
    addToCart({
      harvestId: item.id,
      title: item.title,
      pricePerUnit: Number(item.price_per_unit),
      unit: item.unit,
      quantity: qty,
      sellerId: item.seller_id,
      sellerName: item.seller_name || "Agri Dept - Unit 3",
      imageUrl: item.image_url,
    });
    if (goCheckout) {
      router.push("/buyer/checkout");
    } else {
      showMessage(
        "Added to Cart",
        `${qty} ${item.unit} of ${item.title} added to your cart!`,
      );
    }
  }

  async function handleChat() {
    try {
      const user = await getCurrentUser();
      if (!user) {
        router.push("/auth/login");
        return;
      }
      const { data: chatId, error } = await supabase.rpc("get_or_create_chat", {
        p_order_id: null,
        p_product_id: item.id,
        p_seller_id: item.seller_id,
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

  return (
    <View style={{ flex: 1, backgroundColor: "#FFF" }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {/* Hero Image */}
        <View style={styles.heroWrap}>
          <Image
            source={{
              uri: item.image_url?.startsWith("http")
                ? item.image_url
                : "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=500",
            }}
            style={styles.heroImg}
          />
          <TouchableOpacity
            style={styles.backCircle}
            onPress={() => router.back()}
          >
            <ArrowLeft size={20} color={Colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.heartCircle}
            onPress={() => setIsLiked(!isLiked)}
          >
            <Heart
              size={18}
              color={isLiked ? Colors.danger : Colors.textMuted}
              fill={isLiked ? Colors.danger : "transparent"}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          {/* Status & Harvest Time Badges */}
          <View style={styles.badgeRow}>
            <View
              style={[
                styles.readyBadge,
                isPreOrder && { backgroundColor: "#DBEAFE" },
              ]}
            >
              <Text
                style={[styles.readyText, isPreOrder && { color: "#1D4ED8" }]}
              >
                {isPreOrder ? "🌱 IN-GROUND PRE-ORDER" : "✓ READY NOW"}
              </Text>
            </View>
            <View style={styles.timeBadge}>
              <Calendar size={11} color="#B45309" />
              <Text style={styles.timeText}>
                {isPreOrder
                  ? `Est. Harvest: ${item.expected_harvest || "In 5 days"}`
                  : "Harvested today • 6:30 AM"}
              </Text>
            </View>
          </View>

          {/* Title, Price & Rating */}
          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.price}>
                ₱{item.price_per_unit}{" "}
                <Text style={styles.unit}>/ {item.unit}</Text>
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <View style={{ flexDirection: "row", gap: 2 }}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    size={13}
                    color={Colors.accent}
                    fill={Colors.accent}
                  />
                ))}
              </View>
              <Text style={styles.reviewCount}>4.9 (128 reviews)</Text>
            </View>
          </View>

          {/* Verified Seller Card */}
          <View style={styles.sellerCard}>
            <View style={styles.sellerAvatar}>
              <Text style={styles.sellerInit}>{sellerInitials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.sellerNameRow}>
                <Text style={styles.sellerName} numberOfLines={1}>
                  {item.seller_name || "Agri Dept - Unit 3"}
                </Text>
                <BadgeCheck size={15} color="#2563EB" />
              </View>
              <Text style={styles.sellerSub}>
                {item.seller_department || "Verified Student Seller"} • 342
                sales
              </Text>
            </View>
            <TouchableOpacity
              style={styles.chatBtn}
              onPress={handleChat}
            >
              <MessageSquare size={15} color={Colors.primary} />
              <Text style={styles.chatBtnText}>Chat</Text>
            </TouchableOpacity>
          </View>

          {/* Stock Remaining Progress */}
          <View style={styles.stockRow}>
            <Text style={styles.stockLabel}>
              {isPreOrder ? "Pre-order allocation left" : "Stock remaining"}
            </Text>
            <Text style={styles.stockVal}>
              {maxStock} / {totalStock} {item.unit}
            </Text>
          </View>
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${stockPct}%` }]} />
          </View>
          <Text style={styles.urgencyText}>
            ⚡ Selling fast — 7 buyers viewing now
          </Text>

          {/* Quantity Stepper */}
          <View style={styles.qtyRow}>
            <Text style={styles.qtyLabel}>Quantity ({item.unit})</Text>
            <View style={styles.stepper}>
              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => setQty(Math.max(1, qty - 1))}
              >
                <Text style={styles.stepText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.qtyNum}>{qty}</Text>
              <TouchableOpacity
                style={[styles.stepBtn, { backgroundColor: Colors.primary }]}
                onPress={() => setQty(Math.min(maxStock, qty + 1))}
              >
                <Text style={[styles.stepText, { color: "#FFF" }]}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* About Harvest */}
          <Text style={styles.aboutTitle}>About this harvest</Text>
          <Text style={styles.aboutDesc}>
            {item.description ||
              "Vine-ripened fresh campus produce grown in the ADSSU Agriculture demo farm. Pesticide-free and harvested fresh for campus pick-up."}
          </Text>
          <View style={styles.pickupRow}>
            <MapPin size={14} color={Colors.primary} />
            <Text style={styles.pickupNote}>
              Pick-up: Agriculture Dept Stalls • 7AM–5PM
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Sticky Action Bar */}
      <View style={styles.bottomBar}>
        <View>
          <Text style={styles.subLabel}>Subtotal</Text>
          <Text style={styles.subTotal}>₱{subtotal}</Text>
        </View>
        <TouchableOpacity
          style={styles.addCartBtn}
          onPress={() => handleAdd(false)}
        >
          <Text style={styles.addCartText}>Add to Cart</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.buyNowBtn}
          onPress={() => handleAdd(true)}
        >
          <Text style={styles.buyNowText}>
            {isPreOrder ? "Pre-Order Now" : "Order Now"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingWrap: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { fontSize: 13, fontWeight: "700", color: Colors.textMuted },
  heroWrap: { position: "relative", height: 250, backgroundColor: "#F3F4F6" },
  heroImg: { width: "100%", height: "100%" },
  backCircle: {
    position: "absolute",
    top: 48,
    left: 16,
    backgroundColor: "#FFF",
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },
  heartCircle: {
    position: "absolute",
    top: 48,
    right: 16,
    backgroundColor: "#FFF",
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },
  body: { padding: 18 },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  readyBadge: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  readyText: { fontSize: 10, fontWeight: "800", color: Colors.primary },
  timeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  timeText: { fontSize: 10, fontWeight: "700", color: "#B45309" },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  title: { fontSize: 21, fontWeight: "800", color: Colors.text },
  price: {
    fontSize: 20,
    fontWeight: "800",
    color: Colors.primary,
    marginTop: 2,
  },
  unit: { fontSize: 13, fontWeight: "500", color: Colors.textMuted },
  reviewCount: { fontSize: 11, color: Colors.textMuted, marginTop: 3 },
  sellerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.background,
    padding: 12,
    borderRadius: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sellerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  sellerInit: { color: "#FFF", fontWeight: "800", fontSize: 14 },
  sellerNameRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  sellerName: { fontSize: 14, fontWeight: "800", color: Colors.text },
  sellerSub: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  chatBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#FFF",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chatBtnText: { fontSize: 12, fontWeight: "700", color: Colors.primary },
  stockRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 18,
  },
  stockLabel: { fontSize: 13, fontWeight: "700", color: Colors.text },
  stockVal: { fontSize: 13, fontWeight: "800", color: "#EA580C" },
  progressBg: {
    height: 7,
    backgroundColor: "#E5E7EB",
    borderRadius: 4,
    marginTop: 6,
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: "#F97316" },
  urgencyText: {
    fontSize: 11,
    color: "#EA580C",
    fontWeight: "600",
    marginTop: 5,
  },
  qtyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 18,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.border,
  },
  qtyLabel: { fontSize: 14, fontWeight: "700", color: Colors.text },
  stepper: { flexDirection: "row", alignItems: "center", gap: 14 },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.background,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  stepText: { fontSize: 18, fontWeight: "700" },
  qtyNum: { fontSize: 16, fontWeight: "800" },
  aboutTitle: { fontSize: 14, fontWeight: "800", marginTop: 16 },
  aboutDesc: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 18,
    marginTop: 4,
  },
  pickupRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  pickupNote: { fontSize: 12, fontWeight: "700", color: Colors.primary },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderTopWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "#FFF",
  },
  subLabel: { fontSize: 11, color: Colors.textMuted },
  subTotal: { fontSize: 17, fontWeight: "800", color: Colors.text },
  addCartBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    alignItems: "center",
  },
  addCartText: { fontSize: 13, fontWeight: "700", color: Colors.primary },
  buyNowBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: "center",
  },
  buyNowText: { fontSize: 13, fontWeight: "700", color: "#FFF" },
});
