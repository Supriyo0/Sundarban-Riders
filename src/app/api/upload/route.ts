import { NextResponse } from "next/server";
import { uploadImageToImgBB } from "@/lib/imgbb/upload";

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";

    let imagePayload: File | Blob | string | null = null;
    let fileName = "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("image") || formData.get("file");
      if (file && typeof file === "object" && "arrayBuffer" in file) {
        imagePayload = file as File;
        fileName = (file as File).name || "upload";
      }
    } else {
      const body = await req.json().catch(() => ({}));
      if (body.image) {
        imagePayload = body.image;
        fileName = body.name || "image";
      }
    }

    if (!imagePayload) {
      return NextResponse.json(
        { success: false, message: "কোনো ছবি পাওয়া যায়নি (image parameter required)" },
        { status: 400 }
      );
    }

    const result = await uploadImageToImgBB(imagePayload, fileName);

    if (!result.success) {
      // Fallback: If ImgBB has no key or fails, return the base64 or placeholder so UX does not break
      if (typeof imagePayload === "string" && imagePayload.startsWith("data:image")) {
        return NextResponse.json({
          success: true,
          url: imagePayload,
          display_url: imagePayload,
          fallback: true,
          warning: result.error,
        });
      }
      if (typeof imagePayload === "object" && imagePayload !== null && "arrayBuffer" in imagePayload) {
        const buffer = Buffer.from(await (imagePayload as File).arrayBuffer());
        const mime = (imagePayload as File).type || "image/jpeg";
        const dataUrl = `data:${mime};base64,${buffer.toString("base64")}`;
        return NextResponse.json({
          success: true,
          url: dataUrl,
          display_url: dataUrl,
          fallback: true,
          warning: result.error,
        });
      }
      return NextResponse.json(
        { success: false, message: result.error || "ImgBB আপলোড ব্যর্থ হয়েছে" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      url: result.url,
      display_url: result.display_url,
      thumb_url: result.thumb_url,
      delete_url: result.delete_url,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("[/api/upload] Error:", message);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
