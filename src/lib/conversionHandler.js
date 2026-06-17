import { supabase } from "./supabase";

/**
 * Fetch complete unit data for conversion to opportunity
 * Returns all data needed to pre-fill CreateOpportunityDialog
 */
export async function prepareUnitForConversion(unitId) {
  try {
    // Fetch unit with all related data
    const { data: unit, error: unitErr } = await supabase
      .from('project_units')
      .select('*')
      .eq('id', unitId)
      .single();

    if (unitErr || !unit) throw new Error('Unit not found');

    // Fetch project details
    const { data: project, error: projErr } = await supabase
      .from('projects')
      .select('*')
      .eq('id', unit.project_id)
      .single();

    if (projErr) throw new Error('Project not found');

    // Fetch developer
    const { data: developer, error: devErr } = await supabase
      .from('developers')
      .select('*')
      .eq('id', project.developer_id)
      .single();

    if (devErr) throw new Error('Developer not found');

    // Fetch unit pricing / payment plan
    const { data: pricing, error: pricErr } = await supabase
      .from('sale_pricing')
      .select('*')
      .eq('unit_id', unitId)
      .single();

    if (pricErr) console.warn('No pricing found for unit');

    // Return pre-filled data structure
    return {
      unit_id: unit.id,
      unit_ref: unit.unit_ref,
      asking_price: unit.price || pricing?.asking_price,
      bedrooms: unit.bedrooms,
      size_sqft: unit.size_sqft,
      project_id: project.id,
      project_name: project.name,
      developer_id: developer.id,
      developer_name: developer.name,
      payment_plan: pricing?.payment_plan || 'Custom',
      discount_pct: pricing?.discount_pct || 0,
      final_price: pricing?.discounted_price || unit.price,
      view: unit.view,
      sub_type: unit.sub_type,
    };
  } catch (error) {
    console.error('Failed to prepare unit:', error);
    throw new Error(`Conversion failed: ${error.message}`);
  }
}
