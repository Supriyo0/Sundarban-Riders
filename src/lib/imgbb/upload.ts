/**
 * ImgBB Image Upload Utility
 * Uploads images (File, Blob, or base64 data URL) to ImgBB CDN
 * and returns the public permanent image URL.
 */

export interface ImgBBUploadResponse {
  success: boolean;
  url?: string;
  display_url?: string;
  thumb_url?: string;
  delete_url?: string;
  error?: string;
}

export async function uploadImageToImgBB(
  fileOrBase64: File | Blob | string,
  fileName?: string
): Promise<ImgBBUploadResponse> {
  const apiKey =
    process.env.IMGBB_API_KEY ||
    process.env.NEXT_PUBLIC_IMGBB_API_KEY ||
    "";

  if (!apiKey) {
    console.warn("[ImgBB] No IMGBB_API_KEY configured. Storing original payload fallback.");
    if (typeof fileOrBase64 === "string") {
      return { success: true, url: fileOrBase64, display_url: fileOrBase64 };
    }
    return {
      success: false,
      error: "IMGBB_API_KEY is not configured in .env.local",
    };
  }

  try {
    const formData = new FormData();

    if (typeof fileOrBase64 === "string") {
      // If it's a data URL, strip the prefix if needed
      const cleanBase64 = fileOrBase64.replace(/^data:image\/\w+;base64,/, "");
      formData.append("image", cleanBase64);
    } else {
      formData.append("image", fileOrBase64);
    }

    if (fileName) {
      formData.append("name", fileName.replace(/\.[^/.]+$/, ""));
    }

    const res = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      const errMsg = data?.error?.message || "ImgBB upload failed";
      console.warn("[ImgBB] Upload API returned error:", errMsg);
      return { success: false, error: errMsg };
    }

    return {
      success: true,
      url: data.data.url,
      display_url: data.data.display_url || data.data.url,
      thumb_url: data.data.thumb?.url,
      delete_url: data.data.delete_url,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Network error during upload";
    console.error("[ImgBB] Upload exception:", msg);
    return { success: false, error: msg };
  }
}
