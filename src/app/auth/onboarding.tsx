// src/app/auth/onboarding.tsx
import { useRouter } from "expo-router";
import {
  ArrowRight,
  Calendar,
  Fish,
  Leaf,
  QrCode,
  Recycle,
  Sprout,
} from "lucide-react-native";
import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Colors } from "../../constants/theme";

const SLIDES = [
  {
    badge: "LIVE HARVEST",
    updated: "Updated 2m ago",
    title: "Real-Time Harvest Updates",
    desc: "See what student farmers harvested today, with live stock counters so you never miss the freshest produce on campus.",
  },
  {
    badge: "IN-GROUND BOOKING",
    updated: "Zero-waste farming",
    title: "Reserve In-Ground Pre-Orders",
    desc: "Book upcoming crops directly from Agriculture & Fisheries student units before harvest day arrives.",
  },
  {
    badge: "CAMPUS PICK-UP",
    updated: "Instant QR Pass",
    title: "Fast Campus QR Pick-Up",
    desc: "Skip the lines at campus stalls. Pay via GCash or Cash on Pick-up and scan your QR pass in seconds.",
  },
];

export default function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const router = useRouter();

  const slide = SLIDES[step];

  return (
    <View style={styles.container}>
      {/* Top Bar: 1/3 & Skip */}
      <View style={styles.topBar}>
        <Text style={styles.stepIndicator}>{step + 1} / 3</Text>
        <TouchableOpacity onPress={() => router.replace("/auth/login")}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Illustration Card */}
      <View style={styles.heroCard}>
        <View style={styles.livePill}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>{slide.badge}</Text>
        </View>

        {/* Produce Cluster */}
        <View style={styles.clusterWrap}>
          <View style={[styles.produceBubble, styles.bubbleTomato]}>
            <View style={styles.tomatoCircle}>
              <Sprout size={26} color="#FFF" />
            </View>
          </View>

          <View style={[styles.produceBubble, styles.bubbleLeaf]}>
            <Leaf size={32} color={Colors.primary} />
          </View>

          <View style={[styles.produceBubble, styles.bubbleFish]}>
            <Fish size={30} color="#2563EB" />
          </View>
        </View>

        <View style={styles.harvestBadge}>
          <Text style={styles.harvestBadgeText}>● {slide.updated}</Text>
        </View>
      </View>

      {/* Title & Description */}
      <Text style={styles.title}>{slide.title}</Text>
      <Text style={styles.desc}>{slide.desc}</Text>

      {/* Feature Cards Row */}
      <View style={styles.pillRow}>
        <View style={styles.featureCard}>
          <View style={styles.featureIconBlue}>
            <Calendar size={14} color="#2563EB" />
          </View>
          <View>
            <Text style={styles.featureSub}>Slide 2</Text>
            <Text style={styles.featureText}>Campus Pre-Orders</Text>
          </View>
        </View>

        <View style={styles.featureCard}>
          <View style={styles.featureIconGreen}>
            {step === 2 ? (
              <QrCode size={14} color={Colors.primary} />
            ) : (
              <Recycle size={14} color={Colors.primary} />
            )}
          </View>
          <View>
            <Text style={styles.featureSub}>Slide 3</Text>
            <Text style={styles.featureText}>Zero Food Waste</Text>
          </View>
        </View>
      </View>

      {/* Progress Dots */}
      <View style={styles.dotsRow}>
        {[0, 1, 2].map((i) => (
          <TouchableOpacity
            key={i}
            onPress={() => setStep(i)}
            style={[styles.dot, step === i && styles.dotActive]}
          />
        ))}
      </View>

      {/* Primary CTA -> Goes directly to Login */}
      <TouchableOpacity
        style={styles.ctaBtn}
        onPress={() => {
          if (step < 2) setStep(step + 1);
          else router.replace("/auth/login");
        }}
      >
        <Text style={styles.ctaText}>{step < 2 ? "Next" : "Get Started"}</Text>
        <ArrowRight size={18} color="#FFF" />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.replace("/auth/login")}
        style={{ marginTop: 14 }}
      >
        <Text style={styles.loginLink}>
          Already have an account?{" "}
          <Text style={{ fontWeight: "800", color: Colors.primary }}>
            Log In
          </Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF",
    paddingHorizontal: 22,
    paddingTop: 52,
    paddingBottom: 28,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  stepIndicator: { fontSize: 13, fontWeight: "700", color: Colors.textMuted },
  skipText: { fontSize: 14, fontWeight: "700", color: Colors.primary },

  heroCard: {
    backgroundColor: "#E8F5E9",
    borderRadius: 24,
    height: 245,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    position: "relative",
  },
  livePill: {
    position: "absolute",
    top: 14,
    left: 14,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 6,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#EF4444" },
  liveText: { fontSize: 10, fontWeight: "800", color: Colors.text },

  clusterWrap: {
    width: 190,
    height: 150,
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  produceBubble: {
    position: "absolute",
    backgroundColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
    elevation: 2,
  },
  bubbleTomato: {
    width: 72,
    height: 72,
    borderRadius: 36,
    left: 12,
    top: 32,
  },
  tomatoCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#EF4444",
    justifyContent: "center",
    alignItems: "center",
  },
  bubbleLeaf: {
    width: 66,
    height: 66,
    borderRadius: 33,
    right: 16,
    top: 10,
    backgroundColor: "#DCFCE7",
  },
  bubbleFish: {
    width: 66,
    height: 66,
    borderRadius: 33,
    right: 22,
    bottom: 8,
    backgroundColor: "#DBEAFE",
  },

  harvestBadge: {
    position: "absolute",
    bottom: 14,
    right: 14,
    backgroundColor: "#FFF",
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 12,
  },
  harvestBadgeText: { fontSize: 11, fontWeight: "700", color: Colors.success },

  title: {
    fontSize: 22,
    fontWeight: "800",
    color: Colors.text,
    textAlign: "center",
  },
  desc: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
    marginTop: 8,
    paddingHorizontal: 6,
  },

  pillRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 18,
  },
  featureCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.background,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  featureIconBlue: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#DBEAFE",
    justifyContent: "center",
    alignItems: "center",
  },
  featureIconGreen: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#DCFCE7",
    justifyContent: "center",
    alignItems: "center",
  },
  featureSub: { fontSize: 9, fontWeight: "700", color: Colors.textMuted },
  featureText: { fontSize: 11, fontWeight: "800", color: Colors.text },

  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: 18,
    marginBottom: "auto",
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border },
  dotActive: { width: 22, backgroundColor: Colors.primary },

  ctaBtn: {
    backgroundColor: Colors.primary,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    padding: 15,
    borderRadius: 14,
    gap: 8,
  },
  ctaText: { color: "#FFF", fontSize: 15, fontWeight: "800" },
  loginLink: { textAlign: "center", fontSize: 13, color: Colors.textMuted },
});
