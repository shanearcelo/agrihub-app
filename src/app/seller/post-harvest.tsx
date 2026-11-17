// src/app/seller/post-harvest.tsx
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import {
    AlertCircle,
    ArrowLeft,
    Camera,
    CheckCircle2,
    Sprout,
    Star,
    Zap,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Alert,
    Image,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { Colors } from "../../constants/theme";
import { getCurrentUser } from "../../lib/authHelpers";
import { getCurrentSemester } from "../../lib/semesterFee";
import { supabase } from "../../lib/supabase";
import {
  uploadImageToSupabase,
  uploadPrivateImageToSupabase,
} from "../../lib/uploadImageToSupabase";

const CATEGORIES = [
  "Fresh Vegetables",
  "Fruits",
  "Aquaculture",
  "Poultry & Eggs",
];
const UNITS = ["kg", "bundle", "pcs", "tray"];
type PaymentMethod = "GCash" | "Cash on Pick-up";

function getLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function splitAvailabilityValues(value: string) {
  return [...new Set(value.split(",").map((entry) => entry.trim()).filter(Boolean))];
}

export default function PostHarvestScreen() {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Fresh Vegetables");
  const [unit, setUnit] = useState("kg");
  const [listingType, setListingType] = useState<
    "immediate_stock" | "in_ground_preorder"
  >("immediate_stock");
  const [harvestDate, setHarvestDate] = useState("In 5 days");
  const [totalYield, setTotalYield] = useState("");
  const [price, setPrice] = useState("");
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([
    "Cash on Pick-up",
  ]);
  const [gcashAccountName, setGcashAccountName] = useState("");
  const [gcashMobileNumber, setGcashMobileNumber] = useState("");
  const [gcashQrUri, setGcashQrUri] = useState<string | null>(null);
  const pickupDateOptions = useMemo(
    () =>
      Array.from({ length: 14 }, (_, index) => {
        const date = new Date();
        date.setHours(12, 0, 0, 0);
        date.setDate(date.getDate() + index);
        return getLocalDateKey(date);
      }),
    [],
  );
  const [availableDates, setAvailableDates] = useState<string[]>([
    getLocalDateKey(new Date()),
  ]);
  const [pickupVenuesInput, setPickupVenuesInput] = useState("");
  const [pickupTimesInput, setPickupTimesInput] = useState("");
  const [isFeatured, setIsFeatured] = useState(false);
  const [featuredTier, setFeaturedTier] = useState<15 | 20>(15);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<
    "pending" | "verified" | "rejected"
  >("pending");
  const [subscriptionAmountPaid, setSubscriptionAmountPaid] = useState(0);

  const router = useRouter();

  function showMessage(title: string, msg: string) {
    if (Platform.OS === "web") {
      window.alert(`${title}: ${msg}`);
    } else {
      Alert.alert(title, msg);
    }
  }

  const checkSellerStatus = useCallback(async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "verification_status, semester_fee_paid, semester_fee_semester, subscription_amount_paid, subscription_semester",
        )
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Seller profile was not found.");
      setVerificationStatus(data.verification_status || "pending");
      const currentSemester = getCurrentSemester();
      const paid =
        (data.semester_fee_semester === currentSemester
          ? Number(data.semester_fee_paid || 0)
          : data.subscription_semester === currentSemester
            ? Number(data.subscription_amount_paid || 0)
            : 0) || 0;
      setSubscriptionAmountPaid(paid);
    } catch (error) {
      console.error("Could not load seller posting eligibility.", error);
      setVerificationStatus("pending");
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(checkSellerStatus);
  }, [checkSellerStatus]);

  async function pickCropPhoto() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.7,
    });
    if (!res.canceled && res.assets?.length > 0) {
      setImageUri(res.assets[0].uri);
    }
  }

  async function pickGcashQr() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.8,
    });
    if (!res.canceled && res.assets.length > 0) {
      setGcashQrUri(res.assets[0].uri);
    }
  }

  function togglePaymentMethod(method: PaymentMethod) {
    setPaymentMethods((current) =>
      current.includes(method)
        ? current.filter((value) => value !== method)
        : [...current, method],
    );
  }

  async function submitHarvest(status: "published" | "draft") {
    if (verificationStatus !== "verified") {
      return showMessage(
        "Verification Required",
        "You cannot post harvests until your Seller / Farm Unit is verified by the Campus Admin.",
      );
    }

    if (status === "published" && subscriptionAmountPaid < 30) {
      return showMessage(
        "Initial Booth Fee Required",
        "Submit the ₱30 first semester installment and wait for Admin approval before publishing harvests.",
      );
    }

    if (!title.trim() || !totalYield || !price) {
      return showMessage(
        "Missing Fields",
        "Please enter Crop Title, Total Harvest Yield, and Price per Unit.",
      );
    }

    if (paymentMethods.length === 0) {
      return showMessage(
        "Payment Method Required",
        "Select at least one payment method for this listing.",
      );
    }

    const pickupVenues = splitAvailabilityValues(pickupVenuesInput);
    const pickupTimes = splitAvailabilityValues(pickupTimesInput);
    if (
      status === "published" &&
      (availableDates.length === 0 ||
        pickupVenues.length === 0 ||
        pickupTimes.length === 0)
    ) {
      return showMessage(
        "Pickup Availability Required",
        "Select at least one pickup date, venue, and time for this listing.",
      );
    }

    const acceptsGcash = paymentMethods.includes("GCash");
    const cleanGcashNumber = gcashMobileNumber.replace(/\D/g, "");
    if (
      acceptsGcash &&
      (!gcashAccountName.trim() ||
        !/^09\d{9}$/.test(cleanGcashNumber) ||
        !gcashQrUri)
    ) {
      return showMessage(
        "Complete GCash Setup",
        "Enter the GCash account name, a Philippine mobile number starting with 09 (11 digits), and select the GCash QR image.",
      );
    }

    let currentUser;
    try {
      currentUser = await getCurrentUser();
    } catch (error) {
      return showMessage(
        "Account Error",
        error instanceof Error ? error.message : "Could not read your session.",
      );
    }
    if (!currentUser) {
      router.replace("/auth/login");
      return;
    }

    setLoading(true);
    try {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("full_name, store_name, department")
        .eq("id", currentUser.id)
        .single();
      if (profileError) throw profileError;
      const sellerName = profile.store_name || profile.full_name || "Agri Dept - Unit 3";
      const sellerDept = profile.department || "Agriculture Department";

      const gcashQrUrl =
        acceptsGcash && gcashQrUri
          ? await uploadPrivateImageToSupabase(
              gcashQrUri,
              "gcash-qrs",
              `${currentUser.id}/${Date.now()}.jpg`,
            )
          : null;

      let uploadedUrl =
        "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=400";

      if (imageUri) {
        uploadedUrl = await uploadImageToSupabase(
          imageUri,
          "product-images",
          `${currentUser.id}/${Date.now()}.jpg`,
        );
      }

      const qtyNum = Number(totalYield);
      const { error } = await supabase.from("products").insert({
        seller_id: currentUser.id,
        seller_name: sellerName,
        seller_department: sellerDept,
        title: title.trim(),
        description: "",
        category,
        unit,
        listing_type: listingType,
        expected_harvest:
          listingType === "in_ground_preorder" ? harvestDate : "Ready now",
        total_stock: qtyNum,
        available_stock: qtyNum,
        reserved_stock: 0,
        total_yield_kg: unit === "kg" ? qtyNum : null,
        remaining_yield_kg: unit === "kg" ? qtyNum : null,
        price_per_unit: Number(price),
        price_per_kg: unit === "kg" ? Number(price) : null,
        is_featured: isFeatured,
        featured_fee: isFeatured ? featuredTier : 0,
        status,
        image_url: uploadedUrl,
        payment_methods: paymentMethods,
        accepts_gcash: acceptsGcash,
        accepts_cash: paymentMethods.includes("Cash on Pick-up"),
        gcash_account_name: acceptsGcash ? gcashAccountName.trim() : null,
        gcash_number: acceptsGcash ? cleanGcashNumber : null,
        gcash_mobile_number: acceptsGcash ? cleanGcashNumber : null,
        gcash_qr_url: gcashQrUrl,
        available_dates: availableDates,
        pickup_venues: pickupVenues,
        pickup_times: pickupTimes,
      });
      if (error) throw error;

      showMessage(
        status === "draft" ? "Draft Saved" : "Harvest Published!",
        status === "draft"
          ? `${title} saved to your drafts.`
          : `${title} is now live on the AgriHub campus marketplace.`,
      );
      router.back();
    } catch (error) {
      showMessage(
        "Error",
        error instanceof Error ? error.message : "Failed to save harvest.",
      );
    } finally {
      setLoading(false);
    }
  }

  const isLocked = verificationStatus !== "verified";

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 18, paddingTop: 52, paddingBottom: 42 }}
    >
      {/* Top Header */}
      <View style={styles.topRow}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={20} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.header}>Post New Harvest</Text>
      </View>

      {/* Locked Warning if Pending Admin Approval */}
      {isLocked && (
        <View style={styles.lockBanner}>
          <AlertCircle size={18} color="#B45309" />
          <Text style={styles.lockText}>
            Your account status is{" "}
            <Text style={{ fontWeight: "800" }}>
              {verificationStatus.toUpperCase()}
            </Text>
            . Posting is disabled until approved by Campus Admin.
          </Text>
        </View>
      )}

      {/* Photo Upload Area */}
      <TouchableOpacity style={styles.photoBox} onPress={pickCropPhoto}>
        {imageUri ? (
          <View style={styles.photoPreviewWrap}>
            <Image source={{ uri: imageUri }} style={styles.photoPreview} />
            <View style={styles.coverBadge}>
              <Text style={styles.coverText}>Cover Photo</Text>
            </View>
          </View>
        ) : (
          <View style={styles.photoPlaceholder}>
            <View style={styles.camCircle}>
              <Camera size={22} color={Colors.primary} />
            </View>
            <Text style={styles.photoTitle}>Tap to upload crop photo</Text>
            <Text style={styles.photoHint}>
              Clear natural light • max 5MB (JPG/PNG)
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Crop Title */}
      <Text style={styles.label}>Crop Title</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Native Tomatoes (Vine-ripened)"
        value={title}
        onChangeText={setTitle}
      />

      {/* Category */}
      <Text style={styles.label}>Category</Text>
      <View style={styles.chipRow}>
        {CATEGORIES.map((cat) => {
          const active = category === cat;
          return (
            <TouchableOpacity
              key={cat}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setCategory(cat)}
            >
              <Text style={[styles.chipText, active && { color: "#FFF" }]}>
                {cat}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Unit Selector */}
      <Text style={styles.label}>Unit</Text>
      <View style={styles.chipRow}>
        {UNITS.map((u) => {
          const active = unit === u;
          return (
            <TouchableOpacity
              key={u}
              style={[styles.unitChip, active && styles.chipActive]}
              onPress={() => setUnit(u)}
            >
              <Text style={[styles.chipText, active && { color: "#FFF" }]}>
                {u}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Listing Type Toggle */}
      <Text style={styles.label}>Listing Type</Text>
      <View style={styles.typeRow}>
        <TouchableOpacity
          style={[
            styles.typeBtn,
            listingType === "immediate_stock" && styles.typeBtnActive,
          ]}
          onPress={() => setListingType("immediate_stock")}
        >
          <Zap
            size={15}
            color={listingType === "immediate_stock" ? "#FFF" : Colors.primary}
          />
          <Text
            style={[
              styles.typeBtnText,
              listingType === "immediate_stock" && { color: "#FFF" },
            ]}
          >
            Immediate Stock
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.typeBtn,
            listingType === "in_ground_preorder" && styles.typeBtnActive,
          ]}
          onPress={() => setListingType("in_ground_preorder")}
        >
          <Sprout
            size={15}
            color={
              listingType === "in_ground_preorder" ? "#FFF" : Colors.primary
            }
          />
          <Text
            style={[
              styles.typeBtnText,
              listingType === "in_ground_preorder" && { color: "#FFF" },
            ]}
          >
            In-Ground Pre-Order
          </Text>
        </TouchableOpacity>
      </View>

      {listingType === "in_ground_preorder" && (
        <View style={{ marginTop: 10 }}>
          <Text style={styles.label}>Estimated Harvest Window</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. In 5 days / Nov 22, 2026"
            value={harvestDate}
            onChangeText={setHarvestDate}
          />
        </View>
      )}

      {/* Yield & Price Row */}
      <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Total Harvest Yield ({unit})</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            placeholder="60"
            value={totalYield}
            onChangeText={setTotalYield}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Price per {unit} (₱)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            placeholder="45.00"
            value={price}
            onChangeText={setPrice}
          />
        </View>
      </View>

      <Text style={styles.label}>Pickup Dates (next 14 days)</Text>
      <Text style={styles.paymentHint}>
        Today is available by default. Choose every date buyers may collect this harvest.
      </Text>
      <View style={styles.availabilityDateGrid}>
        {pickupDateOptions.map((date, index) => {
          const selected = availableDates.includes(date);
          const dateObj = new Date(`${date}T12:00:00`);
          const label =
            index === 0
              ? "Today"
              : dateObj.toLocaleDateString(undefined, { weekday: "short" });
          return (
            <TouchableOpacity
              key={date}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              style={[
                styles.availabilityDate,
                selected && styles.availabilityDateActive,
              ]}
              onPress={() =>
                setAvailableDates((current) =>
                  selected
                    ? current.filter((value) => value !== date)
                    : [...current, date].sort(),
                )
              }
            >
              <Text
                style={[
                  styles.availabilityDateLabel,
                  selected && styles.availabilityDateLabelActive,
                ]}
              >
                {label}
              </Text>
              <Text
                style={[
                  styles.availabilityDateNumber,
                  selected && styles.availabilityDateLabelActive,
                ]}
              >
                {dateObj.getDate()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.label}>Pickup Venues</Text>
      <TextInput
        style={styles.input}
        placeholder="Separate options with commas"
        value={pickupVenuesInput}
        onChangeText={setPickupVenuesInput}
        maxLength={300}
      />
      <Text style={styles.label}>Pickup Time Windows</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. 7:00–9:00 AM, 4:00–5:30 PM"
        value={pickupTimesInput}
        onChangeText={setPickupTimesInput}
        maxLength={300}
      />
      <Text style={styles.paymentHint}>
        Enter multiple venues or time windows separated by commas.
      </Text>

      <Text style={styles.label}>Accepted Payment Methods</Text>
      <Text style={styles.paymentHint}>
        Buyers can only select a method accepted for this listing.
      </Text>
      <View style={styles.paymentOptions}>
        {(["GCash", "Cash on Pick-up"] as PaymentMethod[]).map((method) => {
          const selected = paymentMethods.includes(method);
          return (
            <TouchableOpacity
              key={method}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              style={[
                styles.paymentOption,
                selected && styles.paymentOptionActive,
              ]}
              onPress={() => togglePaymentMethod(method)}
            >
              <View
                style={[styles.checkbox, selected && styles.checkboxActive]}
              >
                {selected ? <Text style={styles.checkboxCheck}>✓</Text> : null}
              </View>
              <Text style={styles.paymentOptionText}>{method}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {paymentMethods.includes("GCash") && (
        <View style={styles.gcashSetup}>
          <Text style={styles.gcashSetupTitle}>GCash Payment Details</Text>
          <Text style={styles.label}>GCash Account Name</Text>
          <TextInput
            style={styles.input}
            autoCapitalize="words"
            placeholder="Name registered to GCash"
            value={gcashAccountName}
            onChangeText={setGcashAccountName}
          />
          <Text style={styles.label}>GCash Mobile Number</Text>
          <TextInput
            style={styles.input}
            keyboardType="phone-pad"
            placeholder="09XXXXXXXXX"
            value={gcashMobileNumber}
            maxLength={11}
            onChangeText={(value) =>
              setGcashMobileNumber(value.replace(/\D/g, "").slice(0, 11))
            }
          />
          <Text style={styles.paymentHint}>
            Enter 11 digits starting with 09.
          </Text>
          <TouchableOpacity
            style={styles.qrPicker}
            onPress={pickGcashQr}
            accessibilityRole="button"
          >
            {gcashQrUri ? (
              <Image source={{ uri: gcashQrUri }} style={styles.qrPreview} />
            ) : (
              <Text style={styles.qrPickerText}>Select GCash QR Code</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Featured Harvest Placement Card */}
      <View style={styles.featuredCard}>
        <View style={styles.featuredTop}>
          <View style={styles.starBox}>
            <Star size={16} color="#D97706" fill="#D97706" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.featTitle}>Featured Harvest Placement</Text>
            <Text style={styles.featSub}>
              Top of buyer feed for higher visibility
            </Text>
          </View>
          <Switch
            value={isFeatured}
            onValueChange={setIsFeatured}
            trackColor={{ true: Colors.primary }}
          />
        </View>

        {isFeatured && (
          <View style={styles.tierRow}>
            <TouchableOpacity
              style={[
                styles.tierBtn,
                featuredTier === 15 && styles.tierBtnActive,
              ]}
              onPress={() => setFeaturedTier(15)}
            >
              <CheckCircle2
                size={13}
                color={featuredTier === 15 ? Colors.primary : Colors.textMuted}
              />
              <Text style={styles.tierText}>₱15 • 3 days</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tierBtn,
                featuredTier === 20 && styles.tierBtnActive,
              ]}
              onPress={() => setFeaturedTier(20)}
            >
              <CheckCircle2
                size={13}
                color={featuredTier === 20 ? Colors.primary : Colors.textMuted}
              />
              <Text style={styles.tierText}>₱20 • 7 days + badge</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Bottom Action Buttons */}
      <View style={styles.bottomActions}>
        <TouchableOpacity
          style={styles.draftBtn}
          onPress={() => submitHarvest("draft")}
          disabled={loading || isLocked}
        >
          <Text style={styles.draftText}>Save Draft</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.publishBtn, (loading || isLocked) && { opacity: 0.6 }]}
          onPress={() => submitHarvest("published")}
          disabled={loading || isLocked}
        >
          <Text style={styles.publishText}>
            {loading
              ? "Publishing..."
              : isFeatured
                ? `Publish Harvest • ₱${featuredTier}`
                : "Publish Harvest"}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF" },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  header: { fontSize: 20, fontWeight: "800", color: Colors.text },

  lockBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  lockText: { flex: 1, fontSize: 12, color: "#92400E" },

  photoBox: {
    height: 145,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: Colors.primary,
    backgroundColor: "#F0FDF4",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  photoPreviewWrap: { width: "100%", height: "100%", position: "relative" },
  photoPreview: { width: "100%", height: "100%" },
  coverBadge: {
    position: "absolute",
    bottom: 8,
    left: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  coverText: { color: "#FFF", fontSize: 10, fontWeight: "800" },
  photoPlaceholder: { alignItems: "center", gap: 4 },
  camCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#DCFCE7",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 2,
  },
  photoTitle: { fontSize: 12, fontWeight: "800", color: Colors.primary },
  photoHint: { fontSize: 10, color: Colors.textMuted },

  label: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.text,
    marginTop: 14,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: Colors.background,
    fontSize: 13,
  },
  paymentHint: { fontSize: 11, color: Colors.textMuted, marginBottom: 8 },
  availabilityDateGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  availabilityDate: {
    width: "13%",
    minWidth: 42,
    paddingVertical: 7,
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  availabilityDateActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  availabilityDateLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: Colors.textMuted,
  },
  availabilityDateLabelActive: { color: "#FFF" },
  availabilityDateNumber: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: "800",
    color: Colors.text,
  },
  paymentOptions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  paymentOption: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  paymentOptionActive: {
    borderColor: Colors.primary,
    backgroundColor: "#F0FDF4",
  },
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkboxCheck: { color: "#FFF", fontSize: 12, fontWeight: "800" },
  paymentOptionText: { fontSize: 12, fontWeight: "700", color: Colors.text },
  gcashSetup: {
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "#FFF",
  },
  gcashSetupTitle: { fontSize: 14, fontWeight: "800", color: Colors.text },
  qrPicker: {
    height: 160,
    marginTop: 12,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: Colors.primary,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "#F0FDF4",
  },
  qrPreview: { width: "100%", height: "100%", resizeMode: "contain" },
  qrPickerText: { color: Colors.primary, fontSize: 13, fontWeight: "800" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  unitChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 12, fontWeight: "700", color: Colors.text },

  typeRow: { flexDirection: "row", gap: 8 },
  typeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: "#F0FDF4",
  },
  typeBtnActive: { backgroundColor: Colors.primary },
  typeBtnText: { fontSize: 12, fontWeight: "700", color: Colors.primary },

  featuredCard: {
    backgroundColor: "#FFFBEB",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FDE68A",
    marginTop: 18,
  },
  featuredTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  starBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#FEF3C7",
    justifyContent: "center",
    alignItems: "center",
  },
  featTitle: { fontSize: 13, fontWeight: "800", color: "#92400E" },
  featSub: { fontSize: 11, color: "#B45309", marginTop: 1 },
  tierRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  tierBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  tierBtnActive: { borderColor: Colors.primary, backgroundColor: "#F0FDF4" },
  tierText: { fontSize: 11, fontWeight: "700", color: Colors.text },

  bottomActions: { flexDirection: "row", gap: 10, marginTop: 22 },
  draftBtn: {
    paddingVertical: 15,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    alignItems: "center",
  },
  draftText: { fontSize: 13, fontWeight: "800", color: Colors.text },
  publishBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: "center",
  },
  publishText: { color: "#FFF", fontSize: 14, fontWeight: "800" },
});
