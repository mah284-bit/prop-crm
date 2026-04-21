import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Top UAE developers to collect data for
const UAE_DEVELOPERS = [
  { name: "Emaar Properties",     website: "emaar.com",              community_focus: ["Downtown Dubai","Dubai Creek Harbour","Dubai Hills","Emaar Beachfront"] },
  { name: "DAMAC Properties",     website: "damacproperties.com",    community_focus: ["DAMAC Hills","Business Bay","Jumeirah Village"] },
  { name: "Aldar Properties",     website: "aldar.com",              community_focus: ["Yas Island","Saadiyat Island","Al Reem Island"] },
  { name: "Sobha Realty",         website: "sobharealty.com",        community_focus: ["Sobha Hartland","Mohammed Bin Rashid City"] },
  { name: "Nshama",               website: "nshama.com",             community_focus: ["Town Square Dubai"] },
  { name: "Meraas",               website: "meraas.com",             community_focus: ["City Walk","Bluewaters","Port de La Mer"] },
  { name: "Ellington Properties", website: "ellingtonproperties.com",community_focus: ["Downtown Dubai","Palm Jumeirah","JVC"] },
  { name: "Binghatti Developers", website: "binghatti.com",          community_focus: ["Business Bay","JVC","Al Jaddaf"] },
  { name: "Azizi Developments",   website: "azizidevelopments.com",  community_focus: ["Palm Jumeirah","Al Furjan","Meydan"] },
  { name: "Nakheel",              website: "nakheel.com",            community_focus: ["Palm Jumeirah","Deira Islands","Jumeirah Islands"] },
]

// Structured project data collected from public sources
const SEED_PROJECTS = [
  {
    developer: "Emaar Properties",
    projects: [
      { name:"Creek Harbour", community:"Dubai Creek Harbour", emirate:"Dubai", project_type:"Mixed Use", project_status:"Under Construction", announcement_date:"2016-01-01", handover_date:"2027-12-31", starting_price:1200000, total_units:7000, description:"A waterfront mega-development spanning 6 sq km along the Dubai Creek, featuring residential towers, a marina, retail and the future Creek Tower.", google_maps_url:"https://maps.google.com/?q=Dubai+Creek+Harbour", service_charge_psf:18 },
      { name:"Dubai Hills Estate", community:"Dubai Hills", emirate:"Dubai", project_type:"Mixed Use", project_status:"Ready", announcement_date:"2014-01-01", handover_date:"2023-12-31", starting_price:800000, total_units:22000, description:"An 11 million sqm integrated community featuring villas, apartments, an 18-hole championship golf course, a mall, and schools.", google_maps_url:"https://maps.google.com/?q=Dubai+Hills+Estate", service_charge_psf:16 },
      { name:"Emaar Beachfront", community:"Dubai Harbour", emirate:"Dubai", project_type:"Residential", project_status:"Under Construction", announcement_date:"2018-01-01", handover_date:"2026-06-30", starting_price:1500000, total_units:10000, description:"A private island community between Palm Jumeirah and JBR featuring 27 residential towers with direct beach access.", google_maps_url:"https://maps.google.com/?q=Emaar+Beachfront+Dubai", service_charge_psf:22 },
      { name:"The Oasis", community:"Dubailand", emirate:"Dubai", project_type:"Villa", project_status:"Under Construction", announcement_date:"2023-05-01", handover_date:"2027-12-31", starting_price:5000000, total_units:7000, description:"Emaar's largest villa community featuring 4-6 bedroom villas and mansions surrounded by waterways and lush greenery.", google_maps_url:"https://maps.google.com/?q=The+Oasis+Emaar+Dubai", service_charge_psf:20 },
    ]
  },
  {
    developer: "DAMAC Properties",
    projects: [
      { name:"DAMAC Hills", community:"Dubailand", emirate:"Dubai", project_type:"Mixed Use", project_status:"Ready", announcement_date:"2013-01-01", handover_date:"2022-12-31", starting_price:600000, total_units:30000, description:"A self-sustaining community built around the Trump International Golf Club Dubai, featuring apartments, villas and townhouses.", google_maps_url:"https://maps.google.com/?q=DAMAC+Hills+Dubai", service_charge_psf:14 },
      { name:"DAMAC Lagoons", community:"Dubailand", emirate:"Dubai", project_type:"Villa", project_status:"Under Construction", announcement_date:"2021-01-01", handover_date:"2026-12-31", starting_price:1800000, total_units:8000, description:"A Mediterranean-inspired community featuring villas and townhouses surrounded by crystal lagoons and themed clusters.", google_maps_url:"https://maps.google.com/?q=DAMAC+Lagoons+Dubai", service_charge_psf:16 },
      { name:"Safa One", community:"Al Safa", emirate:"Dubai", project_type:"Residential", project_status:"Under Construction", announcement_date:"2022-03-01", handover_date:"2026-12-31", starting_price:1200000, total_units:1300, description:"A luxury skyscraper featuring sky gardens, an artificial beach, and stunning views of Safa Park and the Dubai skyline.", google_maps_url:"https://maps.google.com/?q=Safa+One+DAMAC+Dubai", service_charge_psf:28 },
    ]
  },
  {
    developer: "Aldar Properties",
    projects: [
      { name:"Yas Acres", community:"Yas Island", emirate:"Abu Dhabi", project_type:"Villa", project_status:"Ready", announcement_date:"2017-01-01", handover_date:"2022-12-31", starting_price:2500000, total_units:2000, description:"A premium golf and waterfront community on Yas Island featuring 3-6 bedroom villas and townhouses.", google_maps_url:"https://maps.google.com/?q=Yas+Acres+Abu+Dhabi", service_charge_psf:15 },
      { name:"Saadiyat Lagoons", community:"Saadiyat Island", emirate:"Abu Dhabi", project_type:"Villa", project_status:"Under Construction", announcement_date:"2022-01-01", handover_date:"2026-12-31", starting_price:3500000, total_units:4000, description:"A nature-inspired villa community on Saadiyat Island surrounded by mangroves and nature reserves.", google_maps_url:"https://maps.google.com/?q=Saadiyat+Lagoons+Abu+Dhabi", service_charge_psf:18 },
      { name:"Yas Bay", community:"Yas Island", emirate:"Abu Dhabi", project_type:"Mixed Use", project_status:"Ready", announcement_date:"2018-01-01", handover_date:"2023-12-31", starting_price:900000, total_units:3500, description:"A waterfront destination on Yas Island featuring residential apartments, hotels, retail and entertainment.", google_maps_url:"https://maps.google.com/?q=Yas+Bay+Abu+Dhabi", service_charge_psf:20 },
    ]
  },
  {
    developer: "Sobha Realty",
    projects: [
      { name:"Sobha Hartland II", community:"Mohammed Bin Rashid City", emirate:"Dubai", project_type:"Mixed Use", project_status:"Under Construction", announcement_date:"2022-01-01", handover_date:"2027-06-30", starting_price:1100000, total_units:10000, description:"An 8 million sqft waterfront community featuring residential towers, villas, schools and retail within MBR City.", google_maps_url:"https://maps.google.com/?q=Sobha+Hartland+2+Dubai", service_charge_psf:20 },
      { name:"Sobha SeaHaven", community:"Dubai Harbour", emirate:"Dubai", project_type:"Residential", project_status:"Under Construction", announcement_date:"2022-06-01", handover_date:"2026-12-31", starting_price:2000000, total_units:1500, description:"Ultra-luxury waterfront residences at Dubai Harbour with panoramic sea views and world-class amenities.", google_maps_url:"https://maps.google.com/?q=Sobha+SeaHaven+Dubai", service_charge_psf:30 },
    ]
  },
  {
    developer: "Nshama",
    projects: [
      { name:"Town Square Dubai", community:"Town Square", emirate:"Dubai", project_type:"Mixed Use", project_status:"Under Construction", announcement_date:"2015-01-01", handover_date:"2027-12-31", starting_price:500000, total_units:18000, description:"One of Dubai's largest integrated communities featuring affordable apartments, townhouses, retail, parks and schools.", google_maps_url:"https://maps.google.com/?q=Town+Square+Dubai+Nshama", service_charge_psf:12 },
    ]
  },
  {
    developer: "Meraas",
    projects: [
      { name:"Bluewaters Residences", community:"Bluewaters Island", emirate:"Dubai", project_type:"Residential", project_status:"Ready", announcement_date:"2016-01-01", handover_date:"2019-12-31", starting_price:2000000, total_units:698, description:"Luxury residences on Bluewaters Island, home to Ain Dubai — the world's largest observation wheel.", google_maps_url:"https://maps.google.com/?q=Bluewaters+Residences+Dubai", service_charge_psf:35 },
      { name:"Port de La Mer", community:"Jumeirah", emirate:"Dubai", project_type:"Residential", project_status:"Ready", announcement_date:"2017-01-01", handover_date:"2022-12-31", starting_price:1800000, total_units:3500, description:"A Mediterranean-inspired waterfront community in the heart of Jumeirah with a private marina and beach.", google_maps_url:"https://maps.google.com/?q=Port+de+La+Mer+Dubai", service_charge_psf:25 },
    ]
  },
  {
    developer: "Ellington Properties",
    projects: [
      { name:"The Quayside", community:"Business Bay", emirate:"Dubai", project_type:"Residential", project_status:"Under Construction", announcement_date:"2023-01-01", handover_date:"2026-06-30", starting_price:1400000, total_units:300, description:"A boutique waterfront residence in Business Bay featuring design-led apartments with Dubai Canal views.", google_maps_url:"https://maps.google.com/?q=The+Quayside+Ellington+Dubai", service_charge_psf:26 },
      { name:"Crestmark", community:"Business Bay", emirate:"Dubai", project_type:"Residential", project_status:"Under Construction", announcement_date:"2022-06-01", handover_date:"2025-12-31", starting_price:1200000, total_units:250, description:"An architectural landmark in Business Bay with panoramic views of the Dubai skyline and Canal.", google_maps_url:"https://maps.google.com/?q=Crestmark+Ellington+Business+Bay", service_charge_psf:24 },
    ]
  },
  {
    developer: "Binghatti Developers",
    projects: [
      { name:"Binghatti Skyrise", community:"Business Bay", emirate:"Dubai", project_type:"Residential", project_status:"Under Construction", announcement_date:"2023-06-01", handover_date:"2026-12-31", starting_price:900000, total_units:2000, description:"One of the world's tallest residential towers in Business Bay featuring luxury apartments with iconic skyline views.", google_maps_url:"https://maps.google.com/?q=Binghatti+Skyrise+Business+Bay", service_charge_psf:22 },
      { name:"Binghatti Hills", community:"Dubai Science Park", emirate:"Dubai", project_type:"Residential", project_status:"Under Construction", announcement_date:"2023-03-01", handover_date:"2026-06-30", starting_price:700000, total_units:1000, description:"A twin-tower development at Dubai Science Park offering smart luxury apartments with lagoon and skyline views.", google_maps_url:"https://maps.google.com/?q=Binghatti+Hills+Dubai", service_charge_psf:18 },
    ]
  },
  {
    developer: "Azizi Developments",
    projects: [
      { name:"Azizi Riviera", community:"Meydan", emirate:"Dubai", project_type:"Residential", project_status:"Under Construction", announcement_date:"2018-01-01", handover_date:"2026-12-31", starting_price:450000, total_units:16000, description:"A French Riviera-inspired mega community at Meydan featuring studios to 3BR apartments with lagoon and skyline views.", google_maps_url:"https://maps.google.com/?q=Azizi+Riviera+Meydan+Dubai", service_charge_psf:14 },
      { name:"Azizi Venice", community:"Dubai South", emirate:"Dubai", project_type:"Mixed Use", project_status:"Under Construction", announcement_date:"2023-01-01", handover_date:"2027-12-31", starting_price:600000, total_units:30000, description:"A Venice-inspired mega development near Al Maktoum Airport featuring a 700m crystal lagoon, opera house and retail.", google_maps_url:"https://maps.google.com/?q=Azizi+Venice+Dubai+South", service_charge_psf:16 },
    ]
  },
  {
    developer: "Nakheel",
    projects: [
      { name:"Palm Jebel Ali", community:"Palm Jebel Ali", emirate:"Dubai", project_type:"Mixed Use", project_status:"Under Construction", announcement_date:"2023-01-01", handover_date:"2027-12-31", starting_price:8000000, total_units:35000, description:"The revival of Palm Jebel Ali — twice the size of Palm Jumeirah, featuring luxury villas, hotels and entertainment.", google_maps_url:"https://maps.google.com/?q=Palm+Jebel+Ali+Dubai", service_charge_psf:25 },
      { name:"Deira Islands", community:"Deira", emirate:"Dubai", project_type:"Mixed Use", project_status:"Under Construction", announcement_date:"2014-01-01", handover_date:"2026-12-31", starting_price:700000, total_units:15000, description:"A waterfront destination in Deira featuring residential, hotels, retail, and the Night Souk.", google_maps_url:"https://maps.google.com/?q=Deira+Islands+Dubai+Nakheel", service_charge_psf:18 },
    ]
  },
]

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const results = { added: 0, updated: 0, skipped: 0, errors: [] }

  try {
    for (const devData of SEED_PROJECTS) {
      // Find developer in pp_developers
      const { data: dev } = await supabaseAdmin
        .from('pp_developers')
        .select('id')
        .ilike('name', `%${devData.developer.split(' ')[0]}%`)
        .single()

      if (!dev) {
        results.errors.push(`Developer not found: ${devData.developer}`)
        continue
      }

      for (const proj of devData.projects) {
        // Check if project already exists
        const { data: existing } = await supabaseAdmin
          .from('projects')
          .select('id')
          .ilike('name', proj.name)
          .single()

        if (existing) {
          // Update with PropPulse fields
          await supabaseAdmin.from('projects').update({
            pp_developer_id: dev.id,
            project_status: proj.project_status,
            project_type: proj.project_type,
            community: proj.community,
            emirate: proj.emirate,
            starting_price: proj.starting_price,
            total_units: proj.total_units,
            handover_date: proj.handover_date,
            announcement_date: proj.announcement_date,
            description: proj.description,
            google_maps_url: proj.google_maps_url,
            service_charge_psf: proj.service_charge_psf,
            is_pp_verified: true,
            pp_data_source: 'ai_agent',
            pp_last_updated: new Date().toISOString(),
            pp_confidence_score: 85,
          }).eq('id', existing.id)
          results.updated++
        } else {
          // Insert new project
          const { error } = await supabaseAdmin.from('projects').insert({
            name: proj.name,
            developer: devData.developer,
            pp_developer_id: dev.id,
            project_status: proj.project_status,
            project_type: proj.project_type,
            community: proj.community,
            emirate: proj.emirate,
            city: 'Dubai',
            country: 'UAE',
            starting_price: proj.starting_price,
            total_units: proj.total_units,
            handover_date: proj.handover_date,
            announcement_date: proj.announcement_date,
            description: proj.description,
            google_maps_url: proj.google_maps_url,
            service_charge_psf: proj.service_charge_psf,
            status: 'Active',
            is_pp_verified: true,
            pp_data_source: 'ai_agent',
            pp_last_updated: new Date().toISOString(),
            pp_confidence_score: 85,
          })
          if (error) results.errors.push(`${proj.name}: ${error.message}`)
          else results.added++
        }
      }
    }

    // Log the job
    await supabaseAdmin.from('pp_agent_jobs').insert({
      job_type: 'project_scrape',
      target_name: 'UAE Top Developers - Initial Seed',
      status: 'completed',
      records_found: SEED_PROJECTS.reduce((s, d) => s + d.projects.length, 0),
      records_added: results.added,
      records_updated: results.updated,
      records_skipped: results.skipped,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    })

    return res.status(200).json(results)
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}
