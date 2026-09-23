import { ImageResponse } from "next/og";

// Dynamic favicon matching Sundarban Riders emblem
export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #14b8a6 0%, #0f766e 100%)",
          borderRadius: 16,
          boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
          fontSize: 20,
        }}
      >
        🐯
      </div>
    ),
    { ...size },
  );
}
