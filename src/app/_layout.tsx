import { Stack, useRouter, useSegments } from "expo-router";
import { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { CartProvider } from "../context/CartContext";
import { supabase } from "../lib/supabase";

type UserRole = "buyer" | "seller" | "admin";

function isUserRole(role: unknown): role is UserRole {
  return role === "buyer" || role === "seller" || role === "admin";
}

export default function RootLayout() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [bootstrapError, setBootstrapError] = useState(false);
  const [retryAttempt, setRetryAttempt] = useState(0);

  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    let active = true;
    let receivedAuthEvent = false;

    function applyUser(currentUser: User | null) {
      if (!active) return;
      setUser(currentUser);
      setBootstrapError(false);
      if (!currentUser) {
        setRole(null);
        setLoading(false);
      } else {
        setLoading(true);
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      receivedAuthEvent = true;
      applyUser(session?.user ?? null);
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) throw error;
      if (!receivedAuthEvent) applyUser(data.session?.user ?? null);
    }).catch((error: unknown) => {
      console.error("Failed to restore the Supabase session.", error);
      if (active) {
        setBootstrapError(true);
        setLoading(false);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [retryAttempt]);

  useEffect(() => {
    if (!user) return;

    let active = true;
    void (async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();
        if (error) throw error;
        const nextRole = data?.role || "buyer";
        if (!isUserRole(nextRole)) {
          throw new Error("User profile contains an unsupported role.");
        }
        if (active) {
          setRole(nextRole);
          setBootstrapError(false);
        }
      } catch (error) {
        console.error("Failed to load the authenticated user's profile.", error);
        if (active) {
          setRole(null);
          setBootstrapError(true);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [user, retryAttempt]);

  useEffect(() => {
    if (loading || bootstrapError) return;

    const firstSegment = segments[0];
    if (!user) {
      if (!firstSegment) router.replace("/auth/onboarding");
      return;
    }

    if (role && (!firstSegment || firstSegment === "auth")) {
      router.replace(`/${role}`);
    }
  }, [user, role, loading, bootstrapError, segments, router]);

  return (
    <CartProvider>
      <SafeAreaProvider>
        <View style={{ flex: 1 }}>
          <Stack screenOptions={{ headerShown: false }} />
          {(loading || bootstrapError) && (
            <View
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
                justifyContent: "center",
                alignItems: "center",
                padding: 24,
                backgroundColor: "#1B4332",
              }}
            >
              {bootstrapError ? (
                <>
                  <Text
                    style={{
                      color: "#FFFFFF",
                      fontSize: 18,
                      fontWeight: "700",
                      textAlign: "center",
                    }}
                  >
                    Could not load your account
                  </Text>
                  <Text
                    style={{
                      color: "#D8F3DC",
                      fontSize: 14,
                      marginTop: 8,
                      textAlign: "center",
                    }}
                  >
                    Check your internet connection, then try again.
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setRetryAttempt((attempt) => attempt + 1)}
                    style={{
                      marginTop: 20,
                      paddingHorizontal: 20,
                      paddingVertical: 12,
                      borderRadius: 10,
                      backgroundColor: "#FFFFFF",
                    }}
                  >
                    <Text
                      style={{
                        color: "#1B4332",
                        fontSize: 15,
                        fontWeight: "700",
                      }}
                    >
                      Try again
                    </Text>
                  </Pressable>
                </>
              ) : (
                <ActivityIndicator size="large" color="#FFFFFF" />
              )}
            </View>
          )}
        </View>
      </SafeAreaProvider>
    </CartProvider>
  );
}
