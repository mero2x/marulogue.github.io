// using global fetch

const API_KEY = '5c9cef63f6816c9678256d7eb09b6ccc';
const BASE_URL = 'https://api.themoviedb.org/3';
const SERVER_URL = 'http://localhost:3000';

async function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function enrichRestore() {
    console.log('🔄 Fetching current movies from server...');
    const response = await fetch(`${SERVER_URL}/api/movies`);
    const movies = await response.json();
    console.log(`Found ${movies.length} movies.`);

    let enrichedCount = 0;
    const enrichedMovies = [];

    // Process in chunks to save progress
    for (const item of movies) {
        let needsUpdate = false;

        // Determine type
        const isMovie = item.media_type === 'movie' || (!item.media_type && !item.first_air_date);
        const type = isMovie ? 'movie' : 'tv';

        // Check missing fields
        const missingCountries = isMovie ? !item.production_countries : !item.origin_country;
        const missingCredits = isMovie ? !item.director : !item.creator;

        if (missingCountries || missingCredits) {
            try {
                // Fetch details
                await wait(250); // Rate limit friendly

                // console.log(`enriching ${item.title}...`); 
                const detailsUrl = `${BASE_URL}/${type}/${item.id}?api_key=${API_KEY}&append_to_response=credits`;
                const detailsRes = await fetch(detailsUrl);

                if (detailsRes.ok) {
                    const data = await detailsRes.json();

                    if (isMovie) {
                        item.production_countries = data.production_countries;
                        const director = data.credits?.crew?.find(p => p.job === 'Director');
                        item.director = director ? director.name : null;
                    } else {
                        item.origin_country = data.origin_country;
                        const creator = data.created_by?.[0];
                        item.creator = creator ? creator.name : null;
                    }

                    needsUpdate = true;
                    enrichedCount++;
                    process.stdout.write('.');
                } else if (detailsRes.status === 429) {
                    console.log('Rate limit... waiting 5s');
                    await wait(5000);
                }
            } catch (e) {
                console.error(`Error enriching ${item.id}:`, e.message);
            }
        }

        enrichedMovies.push(item);
    }

    console.log(`\n✨ Enriched ${enrichedCount} movies.`);

    // Save back
    console.log('💾 Saving enriched list to Contentful...');
    // We can use the bulk save endpoint safely here because we HAVE the full list
    const saveRes = await fetch(`${SERVER_URL}/api/save-movies`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(enrichedMovies)
    });

    const saveResult = await saveRes.json();
    console.log('Save result:', saveResult);
}

enrichRestore();
