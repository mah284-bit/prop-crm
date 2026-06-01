// =====================================================================
// Phase 2.2b — Property Pack Viewer
// propertyPackBus — the ONE trigger, callable from anywhere
// =====================================================================
// Any component (Inventory, Lead, Opp, Proposal builder, App.jsx inline)
// imports openPropertyPack and calls it with a unit id:
//
//     import { openPropertyPack } from "../property/propertyPackBus";
//     <button onClick={() => openPropertyPack(unit.id)}>Property Pack</button>
//
// Decoupled via a CustomEvent so there is no prop-drilling and no
// window-global timing coupling. PropertyPackModal (mounted once) listens.
//
// FUTURE (Phase 2.3 Send): can add openPropertyPackShare(unitId) here that
// dispatches the same/related event with a `mode:'share'` flag — additive,
// no change to existing callers.
// =====================================================================

export const PROPERTY_PACK_EVENT = "propcrm:open-property-pack";

export function openPropertyPack(unitId) {
  if (!unitId) return;
  window.dispatchEvent(
    new CustomEvent(PROPERTY_PACK_EVENT, { detail: { unitId } })
  );
}
