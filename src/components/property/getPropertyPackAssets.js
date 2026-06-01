// =====================================================================
// Phase 2.2b — Property Pack Viewer
// getPropertyPackAssets — the ONE resolver (single source of truth)
// =====================================================================
// Fetches a unit + its parent project (with media columns) and returns a
// structured pack object. DISPLAY consumes unit/project/amenities to render;
// SEND (Phase 2.3) consumes the typed `assets[]` to offer attach checkboxes.
// Build-once: both layers read THIS function. No duplicate data plumbing.
//
//   const pack = await getPropertyPackAssets(unitId);
//   // pack = { unit, project, developerName, amenities, assets[] }
//   // assets[i] = { type, label, url, scope:'project'|'unit' }
// =====================================================================

import { supabase } from "../../lib/supabase";

export async function getPropertyPackAssets(unitId) {
  if (!unitId) throw new Error("getPropertyPackAssets: unitId required");

  // 1. The unit
  const { data: unit, error: uErr } = await supabase
    .from("project_units")
    .select("*")
    .eq("id", unitId)
    .single();
  if (uErr || !unit) throw uErr || new Error("Unit not found");

  // 2. Parent project (with developer name if linked)
  let project = null;
  if (unit.project_id) {
    const { data: proj } = await supabase
      .from("projects")
      .select("*, pp_developers(name,logo_url)")
      .eq("id", unit.project_id)
      .single();
    project = proj || null;
  }

  // 3. Typed, future-proof asset list (Send will use `type` for checkboxes)
  const assets = [];
  const push = (type, label, url, scope) => {
    if (url) assets.push({ type, label, url, scope });
  };

  if (project) {
    push("hero", "Hero Image", project.hero_image_url, "project");
    (project.photo_gallery_urls || []).forEach((u, i) =>
      push("gallery", `Community Photo ${i + 1}`, u, "project")
    );
    push("master_plan", "Master Plan", project.master_plan_url, "project");
    push("video", "Video Walkthrough", project.video_url, "project");
    push(
      "project_brochure",
      "Project Brochure",
      project.brochure_file_url || project.brochure_url,
      "project"
    );
  }

  push("floor_plan", "Floor Plan", unit.floor_plan_url, "unit");
  (unit.photo_urls || []).forEach((u, i) =>
    push("unit_photo", `Unit Photo ${i + 1}`, u, "unit")
  );
  push("unit_brochure", "Unit Brochure", unit.brochure_url, "unit");
  push("unit_render", "3D Render", unit.render_url, "unit");

  return {
    unit,
    project,
    developerName: project?.pp_developers?.name || project?.developer || "",
    amenities: project?.amenities || [],
    assets,
  };
}
