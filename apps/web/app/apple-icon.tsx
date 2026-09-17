import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#2b654e",
          color: "#f9f6f1",
          fontSize: 84,
          fontWeight: 600,
        }}
      >
        10′
      </div>
    ),
    size,
  );
}
