import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { City } from 'https://esm.sh/country-state-city@3.1.4'
import { corsHeaders } from '../_shared/cors.ts'

console.log(`Function "get-cities" up and running!`);

serve(async (req) => {
  // This is needed if you're planning to invoke your function from a browser.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { countryCode } = await req.json();

    if (!countryCode) {
      return new Response(JSON.stringify({ error: 'Missing countryCode' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Heavy lifting is done on the server, not the client's phone.
    const cities = City.getCitiesOfCountry(countryCode)?.map(c => c.name) || [];
    const uniqueSortedCities = [...new Set(cities)].sort();

    return new Response(JSON.stringify(uniqueSortedCities), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
