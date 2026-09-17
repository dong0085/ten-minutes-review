import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";

export const alt = "Ten Minutes Review";
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default async function Image() {
  const t = await getTranslations("Seo");
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          backgroundColor: "#f9f6f1",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 64,
              height: 64,
              borderRadius: 18,
              backgroundColor: "#2b654e",
              color: "#f9f6f1",
              fontSize: 30,
              fontWeight: 600,
            }}
          >
            10′
          </div>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 600, color: "#23352d" }}>
            {t("ogImageTagline")}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 68,
            fontWeight: 700,
            lineHeight: 1.1,
            color: "#241c15",
            maxWidth: 1000,
          }}
        >
          {t("ogImageTitle")}
        </div>
        <div
          style={{
            display: "flex",
            borderTop: "2px solid rgba(43, 101, 78, 0.25)",
            paddingTop: 24,
            fontSize: 26,
            lineHeight: 1.4,
            color: "#23352d",
          }}
        >
          {t("homeDescription")}
        </div>
      </div>
    ),
    size,
  );
}
