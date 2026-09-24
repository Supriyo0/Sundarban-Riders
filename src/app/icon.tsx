import { ImageResponse } from "next/og";

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
          background: "linear-gradient(135deg, #047857 0%, #059669 50%, #0d9488 100%)",
          borderRadius: 9,
          border: "1.5px solid #34d399",
          boxShadow: "0 2px 6px rgba(0,0,0,0.35)",
          fontSize: 18,
          position: "relative",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          🛺
        </div>
      </div>
    ),
    { ...size }
  );
}
