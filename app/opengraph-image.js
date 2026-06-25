import { ImageResponse } from "next/og";

export const alt = "Soli: know what you actually keep";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const SUN = `
<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 512 512">
  <g stroke="#FFFDF9" fill="#FFFDF9">
    <circle cx="256" cy="256" r="78"/>
    <g stroke-width="18" stroke-linecap="round">
      <line x1="256" y1="135" x2="256" y2="108"/>
      <line x1="256" y1="377" x2="256" y2="404"/>
      <line x1="135" y1="256" x2="108" y2="256"/>
      <line x1="377" y1="256" x2="404" y2="256"/>
      <line x1="170" y1="170" x2="151" y2="151"/>
      <line x1="342" y1="342" x2="361" y2="361"/>
      <line x1="342" y1="170" x2="361" y2="151"/>
      <line x1="170" y1="342" x2="151" y2="361"/>
    </g>
  </g>
</svg>`;

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "90px",
          background: "#F6EFE4",
          backgroundImage:
            "radial-gradient(circle at 14% 0%, rgba(201,162,75,0.18), transparent 45%), radial-gradient(circle at 92% 10%, rgba(188,107,76,0.14), transparent 42%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "28px" }}>
          <div
            style={{
              width: "118px",
              height: "118px",
              borderRadius: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(160deg, #D4895F, #A4583B)",
            }}
          >
            <img
              width="78"
              height="78"
              src={`data:image/svg+xml;base64,${Buffer.from(SUN).toString("base64")}`}
            />
          </div>
          <div style={{ fontSize: "118px", fontWeight: 700, color: "#2B2118" }}>
            Soli
          </div>
        </div>
        <div
          style={{
            marginTop: "40px",
            fontSize: "52px",
            fontWeight: 600,
            color: "#A4583B",
            maxWidth: "900px",
          }}
        >
          Know what you actually keep.
        </div>
        <div style={{ marginTop: "20px", fontSize: "34px", color: "#6E5E4C" }}>
          Real take-home after product, booth rent & taxes.
        </div>
      </div>
    ),
    { ...size }
  );
}
