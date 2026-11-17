import { Tabs } from "expo-router";
import {
    BarChart3,
    FileSpreadsheet,
    Megaphone,
    Receipt,
    User,
    UserCheck,
} from "lucide-react-native";
import { Colors } from "../../constants/theme";

export default function AdminLayout() {
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
          title: "Overview",
          tabBarIcon: ({ color }) => <BarChart3 size={21} color={color} />,
        }}
      />
      <Tabs.Screen
        name="verification"
        options={{
          title: "Sellers",
          tabBarIcon: ({ color }) => <UserCheck size={21} color={color} />,
        }}
      />
      <Tabs.Screen
        name="payments"
        options={{
          title: "Payments",
          tabBarIcon: ({ color }) => <Receipt size={21} color={color} />,
        }}
      />
      <Tabs.Screen
        name="monetization"
        options={{
          title: "Ads",
          tabBarIcon: ({ color }) => <Megaphone size={21} color={color} />,
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: "Reports",
          tabBarIcon: ({ color }) => (
            <FileSpreadsheet size={21} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Account",
          tabBarIcon: ({ color }) => <User size={21} color={color} />,
        }}
      />
    </Tabs>
  );
}
