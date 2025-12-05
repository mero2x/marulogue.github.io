const fs = require('fs');
const http = require('http');

const API_KEY = '5c9cef63f6816c9678256d7eb09b6ccc'; // TMDB API Key
const BASE_URL = 'https://api.themoviedb.org/3';
const SERVER_URL = 'http://localhost:3000';

async function main() {
    console.log('Starting background enrichment...');

    // 1. Fetch current movies
    console.log('Fetching current movie list...');
    let movies = await fetchMovies();
    if (!movies || movies.length === 0) {
        console.error('No movies found to enrich.');
        return;
    }
    console.log(`Loaded ${movies.length} movies.`);

    // 2. Identify items needing enrichment
    const toEnrich = movies.filter(item => {
        const isMovie = item.media_type === 'movie' || (!item.media_type && !item.first_air_date);
        if (isMovie) {
            return !item.director || !item.production_countries;
        } else {
            return !item.creator || !item.origin_country;
        }
    });

    console.log(`Found ${toEnrich.length} items needing enrichment.`);

    if (toEnrich.length === 0) {
        console.log('All items are already enriched!');
        return;
    }

    // 3. Process in batches
    let processedCount = 0;
    const BATCH_SIZE = 50; // Save every 50 items

    for (const item of toEnrich) {
        await enrichItem(item);
        processedCount++;

        // Log progress
        if (processedCount % 10 === 0) {
            console.log(`Enriched ${processedCount}/${toEnrich.length} items...`);
        }

        // Save periodically
        if (processedCount % BATCH_SIZE === 0) {
            console.log('Saving batch to Contentful...');
            await saveMovies(movies);
        }

        // Rate limiting delay (300ms)
        await new Promise(resolve => setTimeout(resolve, 300));
    }

    // Final save
    console.log('Enrichment complete. Saving final result...');
    await saveMovies(movies);
    console.log('Done!');
}

async function fetchMovies() {
    try {
        const response = await fetch(`${SERVER_URL}/api/movies`);
        if (!response.ok) throw new Error(response.statusText);
        return await response.json();
    } catch (error) {
        console.error('Failed to fetch movies:', error);
        return [];
    }
}

async function saveMovies(movies) {
    try {
        const response = await fetch(`${SERVER_URL}/api/save-movies`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(movies)
        });
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Server error: ${text}`);
        }
        console.log('Successfully saved to Contentful.');
    } catch (error) {
        console.error('Failed to save movies:', error);
        // Don't exit, keep trying
    }
}

async function enrichItem(item) {
    const isMovie = item.media_type === 'movie' || (!item.media_type && !item.first_air_date);
    const type = isMovie ? 'movie' : 'tv';

    try {
        const response = await fetch(`${BASE_URL}/${type}/${item.id}?api_key=${API_KEY}&append_to_response=credits`);

        if (response.status === 429) {
            console.warn(`Rate limit hit for ${item.title || item.name}. Waiting 5s...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
            return enrichItem(item); // Retry
        }

        if (response.ok) {
            const data = await response.json();

            if (isMovie) {
                item.production_countries = data.production_countries;
                item.director = extractDirector(data.credits);
                // Ensure we don't save the full credits object
                delete item.credits;
            } else {
                item.origin_country = data.origin_country;
                item.creator = extractCreator(data.created_by);
                delete item.created_by;
            }
        }
    } catch (error) {
        console.warn(`Failed to enrich ${item.title || item.name}:`, error.message);
    }
}

function extractDirector(credits) {
    if (!credits || !credits.crew) return null;
    const director = credits.crew.find(person => person.job === 'Director');
    return director ? director.name : null;
}

function extractCreator(createdBy) {
    if (!createdBy || createdBy.length === 0) return null;
    return createdBy[0].name;
}

// Run main
main().catch(console.error);
