// =====================================================================
// Phase 2.2 — Property Detail Pack
// VideoEmbed — detects YouTube / Vimeo / direct video and renders correctly
// =====================================================================
// Zero dependencies. Pure URL parsing + native embeds.
//
// Props:
//   url   : string  — video URL (video_url column)
//   title : string  — optional heading (default "Video Walkthrough")
//
// Behavior:
//   - Renders nothing if url is empty (section hidden per spec)
//   - YouTube (watch?v=, youtu.be, /embed/) -> iframe embed
//   - Vimeo (vimeo.com/ID)                  -> iframe embed
//   - Direct file (.mp4/.webm/.ogg)         -> <video> element
//   - Unknown -> "Watch video" CTA link (graceful fallback)
// =====================================================================

function parseVideo(url) {
  if (!url) return null;
  const u = String(url).trim();

  // YouTube
  const yt =
    u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/);
  if (yt) {
    return { kind: "iframe", src: `https://www.youtube.com/embed/${yt[1]}` };
  }

  // Vimeo
  const vm = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) {
    return { kind: "iframe", src: `https://player.vimeo.com/video/${vm[1]}` };
  }

  // Direct video file
  if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(u)) {
    return { kind: "video", src: u };
  }

  // Unknown -> link fallback
  return { kind: "link", src: u };
}

export default function VideoEmbed({ url, title = "Video Walkthrough" }) {
  const parsed = parseVideo(url);
  if (!parsed) return null;

  return (
    <section className="mb-6">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-3">
        {title}
      </h3>

      {parsed.kind === "iframe" && (
        <div className="relative w-full rounded-lg overflow-hidden border border-slate-200 aspect-video">
          <iframe
            src={parsed.src}
            title={title}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}

      {parsed.kind === "video" && (
        <video
          src={parsed.src}
          controls
          className="w-full rounded-lg border border-slate-200 bg-black"
        />
      )}

      {parsed.kind === "link" && (
        <a
          href={parsed.src}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-900 transition"
        >
          ▶ Watch video ↗
        </a>
      )}
    </section>
  );
}
