const fs = require('fs');

// Check local file
try {
    const raw = fs.readFileSync('./data/imported_movies.json', 'utf8');
    const data = JSON.parse(raw);
    const tvCount = data.filter(i => i.media_type === 'tv' || (!i.media_type && i.first_air_date)).length;
    console.log(`Local imported_movies.json has ${tvCount} TV shows out of ${data.length} items.`);
} catch (e) {
    console.log('Error reading local file:', e.message);
}

// Check API
// node 18+ has fetch
fetch('http://localhost:3000/api/movies?type=tv')
    .then(res => res.json())
    .then(data => {
        // API returns { movies: [], pagination: {} }
        const movies = data.movies || [];
        console.log(`API returned ${movies.length} TV shows on page 1.`);
        console.log('Total items in pagination:', data.pagination?.totalItems);
    })
    .catch(e => console.log('API Error:', e.message));
