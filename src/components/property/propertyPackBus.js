// =====================================================================
// Phase 2.2b — Property Pack Viewer + Phase 2.3b Share
// propertyPackBus — the ONE trigger, callable from anywhere
// =====================================================================

export const PROPERTY_PACK_EVENT = "propcrm:open-property-pack";

let sharedContext = {
  opportunity: null,
  lead: null,
  unit: null,
  project: null,
  currentUser: null,
  supabase: null,
  showToast: null
};

export function setPropertyPackContext(ctx) {
  sharedContext = { ...sharedContext, ...ctx };
}

export function getPropertyPackContext() {
  return sharedContext;
}

export function openPropertyPack(unitId) {
  if (!unitId) return;
  window.dispatchEvent(
    new CustomEvent(PROPERTY_PACK_EVENT, { 
      detail: { 
        unitId,
        context: sharedContext
      } 
    })
  );
}
