import { useFocusEffect, useRouter } from "expo-router";
import { ArrowLeft, Bell } from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Colors } from "../../constants/theme";
import { getCurrentUser } from "../../lib/authHelpers";
import { supabase } from "../../lib/supabase";

type AppNotification = {
  id: string;
  title: string;
  body: string;
  type: string;
  reference_id: string | null;
  is_read: boolean;
  created_at: string;
};

function showError(message: string) {
  if (Platform.OS === "web") window.alert(message);
  else Alert.alert("Notification Error", message);
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loadError, setLoadError] = useState("");

  useFocusEffect(
    useCallback(() => {
      let active = true;
      let channel: ReturnType<typeof supabase.channel> | null = null;
      void (async () => {
        try {
          const user = await getCurrentUser();
          if (!active) return;
          if (!user) {
            router.replace("/auth/login");
            return;
          }
          const loadNotifications = async () => {
            const { data, error } = await supabase
              .from("notifications")
              .select("*")
              .eq("user_id", user.id)
              .order("created_at", { ascending: false })
              .limit(100);
            if (error) throw error;
            if (active) setItems((data || []) as AppNotification[]);
          };
          await loadNotifications();
          if (!active) return;
          channel = supabase
            .channel(`notifications:${user.id}`)
            .on(
              "postgres_changes",
              {
                event: "*",
                schema: "public",
                table: "notifications",
                filter: `user_id=eq.${user.id}`,
              },
              () => {
                void loadNotifications().catch((error: unknown) => {
                  console.error("Could not refresh notifications.", error);
                  if (active) {
                    setLoadError(
                      error instanceof Error ? error.message : "Refresh failed.",
                    );
                  }
                });
              },
            )
            .subscribe();
        } catch (error) {
          console.error("Could not load notifications.", error);
          if (active) {
            setLoadError(
              error instanceof Error
                ? error.message
                : "Could not load notifications.",
            );
          }
        }
      })();
      return () => {
        active = false;
        if (channel) void supabase.removeChannel(channel);
      };
    }, [router]),
  );

  async function openNotification(item: AppNotification) {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", item.id);
      if (error) throw error;
      setItems((current) =>
        current.map((notification) =>
          notification.id === item.id
            ? { ...notification, is_read: true }
            : notification,
        ),
      );

      if (item.type === "message" && item.reference_id) {
        router.push({
          pathname: "/chat/[orderId]",
          params: { orderId: item.reference_id },
        });
      } else if (
        (item.type === "order" || item.type === "payment") &&
        item.reference_id
      ) {
        const { data: order, error: orderError } = await supabase
          .from("orders")
          .select("id, order_code, buyer_id, seller_id")
          .eq("id", item.reference_id)
          .maybeSingle();
        if (orderError) throw orderError;
        const user = await getCurrentUser();
        if (!user) {
          router.replace("/auth/login");
          return;
        }
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();
        if (profileError) throw profileError;

        if (order) {
          if (profile?.role === "seller" && order.seller_id === user.id) {
            router.push({
              pathname: "/seller/orders",
              params: { orderId: order.id },
            });
          } else if (order.order_code) {
            router.push({
              pathname: "/buyer/order-success/[id]",
              params: { id: order.order_code },
            });
          }
        } else if (profile?.role === "seller") {
          router.push({
            pathname: "/seller/subscription",
            params: { paymentId: item.reference_id },
          });
        } else {
          router.push("/buyer/orders-history");
        }
      } else if (item.type === "verification") {
        const user = await getCurrentUser();
        if (!user) {
          router.replace("/auth/login");
          return;
        }
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();
        if (profileError) throw profileError;
        router.push({
          pathname: profile?.role === "seller" ? "/seller/profile" : "/buyer/profile",
          params: { profileId: item.reference_id || user.id },
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not open this alert.";
      showError(message);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.top}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
        >
          <ArrowLeft size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
      </View>
      {loadError ? (
        <Text style={styles.errorText}>Could not load alerts: {loadError}</Text>
      ) : null}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.emptyText}>You&apos;re all caught up.</Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, !item.is_read && styles.unreadCard]}
            onPress={() => openNotification(item)}
            accessibilityRole="button"
            accessibilityLabel={`${item.title}. ${item.body}`}
          >
            <Bell
              size={18}
              color={item.is_read ? Colors.textMuted : Colors.primary}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.nTitle}>{item.title}</Text>
              <Text style={styles.nDesc}>{item.body}</Text>
              <Text style={styles.nTime}>
                {new Date(item.created_at).toLocaleString()}
              </Text>
            </View>
            {!item.is_read ? <View style={styles.unreadDot} /> : null}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, paddingTop: 52 },
  top: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
    paddingHorizontal: 18,
  },
  title: { fontSize: 22, fontWeight: "800", color: Colors.text },
  list: { paddingHorizontal: 18, paddingBottom: 24, gap: 10, flexGrow: 1 },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#FFF",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  unreadCard: { borderColor: Colors.primary, backgroundColor: "#F0FDF4" },
  nTitle: { fontSize: 14, fontWeight: "700", color: Colors.text },
  nDesc: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  nTime: {
    fontSize: 10,
    color: Colors.primary,
    fontWeight: "700",
    marginTop: 4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginTop: 4,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 12,
    paddingHorizontal: 18,
    marginBottom: 10,
  },
  emptyText: {
    textAlign: "center",
    color: Colors.textMuted,
    paddingVertical: 36,
  },
});
