const contentful = require('contentful');

const client = contentful.createClient({
    space: process.env.CONTENTFUL_SPACE_ID || '6bzr8twttvj3',
    accessToken: process.env.CONTENTFUL_ACCESS_TOKEN || 'MdfnSyUm-p9jlDCG7HCyUuokTZAhyK7UxuXdKA_vXUo'
});

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const type = req.query.type || 'movie'; // 'movie' or 'tv'

        // Fetch the movie list entry from Contentful
        const entry = await client.getEntry('movieList');

        if (!entry || !entry.fields || !entry.fields.contents) {
            return res.status(404).json({ error: 'Movie list not found' });
        }

        let allMovies = entry.fields.contents;

        // Filter by media type
        const filteredMovies = allMovies.filter(item => {
            const itemType = item.media_type || (item.first_air_date ? 'tv' : 'movie');
            return itemType === type;
        });

        // Calculate stats
        const totalWatched = filteredMovies.length;

        // Count unique countries
        const countries = new Set();
        filteredMovies.forEach(item => {
            if (item.production_countries && Array.isArray(item.production_countries)) {
                item.production_countries.forEach(country => {
                    if (country.name) countries.add(country.name);
                });
            } else if (item.origin_country && Array.isArray(item.origin_country)) {
                item.origin_country.forEach(country => countries.add(country));
            }
        });

        // Count unique directors/creators
        const directors = new Set();
        filteredMovies.forEach(item => {
            if (type === 'movie' && item.director) {
                directors.add(item.director);
            } else if (type === 'tv' && item.creator) {
                directors.add(item.creator);
            }
        });

        // Top 10 countries
        const countryCount = {};
        filteredMovies.forEach(item => {
            if (item.production_countries && Array.isArray(item.production_countries)) {
                item.production_countries.forEach(country => {
                    if (country.name) {
                        countryCount[country.name] = (countryCount[country.name] || 0) + 1;
                    }
                });
            } else if (item.origin_country && Array.isArray(item.origin_country)) {
                item.origin_country.forEach(country => {
                    countryCount[country] = (countryCount[country] || 0) + 1;
                });
            }
        });

        const topCountries = Object.entries(countryCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([name, count]) => ({ name, count }));

        // Top 10 directors/creators
        const directorCount = {};
        filteredMovies.forEach(item => {
            const name = type === 'movie' ? item.director : item.creator;
            if (name) {
                directorCount[name] = (directorCount[name] || 0) + 1;
            }
        });

        const topDirectors = Object.entries(directorCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([name, count]) => ({ name, count }));

        res.status(200).json({
            totalWatched,
            totalCountries: countries.size,
            totalDirectors: directors.size,
            topCountries,
            topDirectors
        });

    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats', details: error.message });
    }
};
