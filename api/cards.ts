async function supabaseRequest({
  supabaseUrl,
  supabaseSecretKey,
  path,
  method = "GET",
}) {
  return fetch(`${supabaseUrl}${path}`, {
    method,
    headers: {
      apikey: supabaseSecretKey,
      Authorization: `Bearer ${supabaseSecretKey}`,
      "Content-Type": "application/json",
    },
  });
}

const businessId = membership.business_id;

const locationsResponse = await supabaseRequest({
  supabaseUrl,
  supabaseSecretKey,
  path: `/rest/v1/locations?business_id=eq.${businessId}&select=id`,
});

const locations = await locationsResponse.json();

const locationIds = locations.map(
  (location: any) => location.id,
);

if (locationIds.length === 0) {
  return res.status(200).json([]);
}

const landingPagesResponse =
  await supabaseRequest({
    supabaseUrl,
    supabaseSecretKey,
    path: `/rest/v1/landing_pages?location_id=in.(${locationIds.join(",")})&select=id,name`,
  });

const landingPages =
  await landingPagesResponse.json();

const landingIds = landingPages.map(
  (page: any) => page.id,
);

if (landingIds.length === 0) {
  return res.status(200).json([]);
}

const cardsResponse = await supabaseRequest({
  supabaseUrl,
  supabaseSecretKey,
  path: `/rest/v1/cards?landing_page_id=in.(${landingIds.join(",")})&select=*`,
});

const cards = await cardsResponse.json();

return res.status(200).json(cards);
