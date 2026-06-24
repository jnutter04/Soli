import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const SUN = `
<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 512 512">
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
          background: "linear-gradient(160deg, #D4895F, #A4583B)",
        }}
      >
        <img
          width="120"
          height="120"
          src={`data:image/svg+xml;base64,${Buffer.from(SUN).toString("base64")}`}
        />
      </div>
    ),
    { ...size }
  );
}
