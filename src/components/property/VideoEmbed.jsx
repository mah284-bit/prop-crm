// =====================================================================
// Phase 2.2 — Property Detail Pack  (inline-style, matches PropPulse)
// VideoEmbed — detects YouTube / Vimeo / direct file and renders correctly
// =====================================================================
// Props:
//   url   : string  — video URL (video_url column)
//   title : string  — heading (default "Video Walkthrough")
//
// Renders nothing when url is empty.
// =====================================================================

const LABEL = {
  fontSize: 11, fontWeight: 700, color: "#94A3B8",
  textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 8,
};

function parseVideo(url) {
  if (!url) return null;
  const u = String(url).trim();

  const yt = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/);
  if (yt) return { kind: "iframe", src: `https://www.youtube.com/embed/${yt[1]}` };

  const vm = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) return { kind: "iframe", src: `https://player.vimeo.com/video/${vm[1]}` };

  if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(u)) return { kind: "video", src: u };

  return { kind: "link", src: u };
}

export default function VideoEmbed({ url, title = "Video Walkthrough" }) {
  const parsed = parseVideo(url);
  if (!parsed) return null;

  return (
    <div>
      <div style={LABEL}>{title}</div>

      {parsed.kind === "iframe" && (
        <div style={{ position: "relative", width: "100%", height: 0, paddingBottom: "56.25%", borderRadius: 10, overflow: "hidden", border: "1px solid #E8EDF4" }}>
          <iframe
            src={parsed.src}
            title={title}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}

      {parsed.kind === "video" && (
        <video src={parsed.src} controls
          style={{ width: "100%", borderRadius: 10, border: "1px solid #E8EDF4", background: "#000" }} />
      )}

      {parsed.kind === "link" && (
        <a href={parsed.src} target="_blank" rel="noreferrer"
          style={{ display: "inline-block", padding: "8px 16px", borderRadius: 8, background: "#0F2540", color: "#fff", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
          ▶ Watch video ↗
        </a>
      )}
    </div>
  );
}
