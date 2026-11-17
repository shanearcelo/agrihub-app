// src/app/buyer/_layout.tsx
import { Tabs } from "expo-router";
import {
    Home,
    MessageSquare,
    Search,
    ShoppingCart,
    User,
} from "lucide-react-native";
import { Colors } from "../../constants/theme";

export default function BuyerLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        headerShown: false,
        tabBarStyle: {
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
          backgroundColor: "#FFF",
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
        name="search"
        options={{
          title: "Search",
          tabBarIcon: ({ color }) => <Search size={21} color={color} />,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: "Cart",
          tabBarIcon: ({ color }) => <ShoppingCart size={21} color={color} />,
        }}
      />
      <Tabs.Screen
        name="message"
        options={{
          title: "Message",
          tabBarIcon: ({ color }) => <MessageSquare size={21} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => <User size={21} color={color} />,
        }}
      />

      {/* Sub-screens: gamita ang tabBarButton: () => null imbes nga href: null aron mo-navigate! */}
      <Tabs.Screen
        name="harvest/[id]"
        options={{ tabBarButton: () => null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="checkout"
        options={{ tabBarButton: () => null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="order-success/[id]"
        options={{ tabBarButton: () => null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="orders-history"
        options={{ tabBarButton: () => null }}
      />
      <Tabs.Screen name="map" options={{ tabBarButton: () => null }} />
      <Tabs.Screen
        name="notifications"
        options={{ tabBarButton: () => null }}
      />
    </Tabs>
  );
}
