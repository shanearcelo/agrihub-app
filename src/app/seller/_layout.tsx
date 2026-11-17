// src/app/seller/_layout.tsx
import { Tabs } from "expo-router";
import { ClipboardList, Home, PlusCircle, User } from "lucide-react-native";
import { Colors } from "../../constants/theme";

export default function SellerLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        headerShown: false,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
        tabBarStyle: {
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
          backgroundColor: "#FFF",
          borderTopColor: Colors.border,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <Home size={21} color={color} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "Orders",
          tabBarIcon: ({ color }) => <ClipboardList size={21} color={color} />,
        }}
      />
      <Tabs.Screen
        name="post-harvest"
        options={{
          title: "Post",
          tabBarIcon: ({ color }) => <PlusCircle size={21} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => <User size={21} color={color} />,
        }}
      />

      {/* Hidden Seller Sub-Screens */}
      <Tabs.Screen name="pre-orders" options={{ href: null }} />
      <Tabs.Screen name="messages" options={{ href: null }} />
      <Tabs.Screen name="subscription" options={{ href: null }} />
    </Tabs>
  );
}
