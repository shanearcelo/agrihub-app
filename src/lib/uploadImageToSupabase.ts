import { decode } from "base64-arraybuffer";
import { supabase } from "./supabase";

const PUBLIC_BUCKETS = new Set(["avatars", "product-images", "review-photos"]);

function readLocalImage(uri: string): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.responseType = "arraybuffer";
    request.timeout = 30_000;
    request.onload = () => {
      if (request.status !== 0 && (request.status < 200 || request.status >= 300)) {
        reject(new Error(`Unable to read image file (HTTP ${request.status}).`));
        return;
      }

      const bytes = request.response;
      if (!(bytes instanceof ArrayBuffer) || bytes.byteLength === 0) {
        reject(new Error("The selected image is empty or could not be read."));
        return;
      }
      resolve(bytes);
    };
    request.onerror = () => reject(new Error("Unable to read the selected image."));
    request.ontimeout = () => reject(new Error("Reading the image timed out."));
    request.onabort = () => reject(new Error("Reading the image was canceled."));
    request.open("GET", uri, true);
    request.send();
  });
}

function contentTypeForPath(filePath: string): string {
  const extension = filePath.split(".").pop()?.toLowerCase();
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  return "image/jpeg";
}

async function uploadBytes(
  bytes: ArrayBuffer,
  bucket: string,
  filePath: string,
  contentType: string,
): Promise<void> {
  const { error } = await supabase.storage.from(bucket).upload(filePath, bytes, {
    contentType,
    upsert: false,
  });
  if (error) throw error;
}

export async function uploadImageToSupabase(
  uri: string,
  bucket: string,
  filePath: string,
): Promise<string> {
  if (!PUBLIC_BUCKETS.has(bucket)) {
    throw new Error(`Bucket "${bucket}" is private. Use uploadPrivateImageToSupabase.`);
  }

  await uploadBytes(await readLocalImage(uri), bucket, filePath, contentTypeForPath(filePath));
  return supabase.storage.from(bucket).getPublicUrl(filePath).data.publicUrl;
}

export async function uploadPrivateImageToSupabase(
  uri: string,
  bucket: "valid-ids" | "gcash-qrs" | "payment-receipts",
  filePath: string,
): Promise<string> {
  if (PUBLIC_BUCKETS.has(bucket)) {
    throw new Error(`Bucket "${bucket}" is public; use uploadImageToSupabase.`);
  }

  await uploadBytes(await readLocalImage(uri), bucket, filePath, contentTypeForPath(filePath));
  return filePath;
}

export async function uploadBase64ImageToSupabase(
  base64: string,
  bucket: string,
  filePath: string,
): Promise<string> {
  const bytes = decode(base64);
  if (PUBLIC_BUCKETS.has(bucket)) {
    await uploadBytes(bytes, bucket, filePath, contentTypeForPath(filePath));
    return supabase.storage.from(bucket).getPublicUrl(filePath).data.publicUrl;
  }
  if (bucket !== "valid-ids" && bucket !== "gcash-qrs" && bucket !== "payment-receipts") {
    throw new Error(`Unknown Supabase Storage bucket "${bucket}".`);
  }
  await uploadBytes(bytes, bucket, filePath, contentTypeForPath(filePath));
  return filePath;
}

export async function getImageUrl(
  bucket: string,
  path: string | null | undefined,
): Promise<string | null> {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const storage = supabase.storage.from(bucket);
  if (PUBLIC_BUCKETS.has(bucket)) {
    return storage.getPublicUrl(path).data.publicUrl;
  }
  const { data, error } = await storage.createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}
