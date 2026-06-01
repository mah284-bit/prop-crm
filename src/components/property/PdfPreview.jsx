// =====================================================================
// Phase 2.2 — Property Detail Pack
// PdfPreview — brochure display with native iframe (architect Decision 4)
// =====================================================================
// Zero dependencies. Native <iframe> renders PDFs in all modern browsers.
// (react-pdf adds ~200KB; iframe is 0KB.)
//
// Props:
//   fileUrl   : string  — Supabase Storage public URL (brochure_file_url)
//   externalUrl : string — developer-hosted brochure link (brochure_url)
//   title     : string  — optional heading (default "Brochure")
//
// Fallback ladder per spec:
//   1. fileUrl present     -> inline iframe preview + "Open in new tab"
//   2. else externalUrl    -> "View Brochure" CTA (opens external)
//   3. else                -> "Brochure not yet uploaded" placeholder
// =====================================================================

export default function PdfPreview({ fileUrl, externalUrl, title = "Brochure" }) {
  const Heading = () => (
    <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-3">
      {title}
    </h3>
  );

  // 1. Inline preview
  if (fileUrl) {
    return (
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            {title}
          </h3>
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            Open in new tab ↗
          </a>
        </div>
        <div className="rounded-lg overflow-hidden border border-slate-200">
          <iframe
            src={fileUrl}
            title={title}
            className="w-full h-[480px] bg-slate-50"
          />
        </div>
      </section>
    );
  }

  // 2. External CTA
  if (externalUrl) {
    return (
      <section className="mb-6">
        <Heading />
        <a
          href={externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition"
        >
          📄 View Brochure ↗
        </a>
      </section>
    );
  }

  // 3. Placeholder
  return (
    <section className="mb-6">
      <Heading />
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
        <p className="text-sm text-slate-400">Brochure not yet uploaded</p>
      </div>
    </section>
  );
}
