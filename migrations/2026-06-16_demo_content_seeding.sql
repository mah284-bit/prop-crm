BEGIN TRANSACTION;

UPDATE projects 
SET hero_image_url = 'https://www.emaar.ae/content/dam/emaar-ae/property-details/creek-harbour/creek-harbour-aerial.jpg',
    amenities = ARRAY['Marina', 'Promenade', 'Retail', 'Restaurants', 'Spa', 'Beach Access', '24/7 Security', 'Lagoon']
WHERE name = 'Creek Harbour';

UPDATE projects 
SET hero_image_url = 'https://www.aldar.com/static/images/projects/grove-residences-hero.jpg',
    amenities = ARRAY['Pool', 'Gym', 'Clubhouse', 'VR Park', 'Waterfall', 'Retail', 'Beach Access', '24/7 Security']
WHERE name = 'Aldar Grove Residences';

UPDATE projects 
SET hero_image_url = 'https://www.damacproperties.com/en/projects/lagoons/images/hero.jpg',
    amenities = ARRAY['Lagoon', 'Beach', 'Retail', 'Restaurants', 'Golf', 'Spa', 'Marina', '24/7 Security']
WHERE name = 'DAMAC Lagoons';

COMMIT;