import { ImageResponse } from "next/og";

// Home-screen icon for iOS "Add to Home Screen". iOS applies its own rounded
// mask, so we fill the whole tile with a warm gradient and center a heart.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const HEART =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='white' d='M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z'/></svg>"
  );

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(135deg, #FF7A5A 0%, #FF3B30 55%, #E5306B 100%)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={HEART} width={112} height={112} alt="" />
      </div>
    ),
    size
  );
}
