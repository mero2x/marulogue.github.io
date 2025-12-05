const contentful = require('contentful');

const client = contentful.createClient({
    space: process.env.CONTENTFUL_SPACE_ID || '6bzr8twttvj3',
    accessToken: process.env.CONTENTFUL_ACCESS_TOKEN || 'MdfnSyUm-p9jlDCG7HCyUuokTZAhyK7UxuXdKA_vXUo'
});

const ITEMS_PER_PAGE = 30;

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const page = parseInt(req.query.page) || 1;
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

        // Sort by release date (latest first)
        filteredMovies.sort((a, b) => {
            const dateA = new Date(a.release_date || a.first_air_date || 0);
            const dateB = new Date(b.release_date || b.first_air_date || 0);
            return dateB - dateA; // Descending order (latest first)
        });

        // Calculate pagination
        const totalItems = filteredMovies.length;
        const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
        const startIndex = (page - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;

        // Get the slice for this page
        const pageMovies = filteredMovies.slice(startIndex, endIndex);

        res.status(200).json({
            movies: pageMovies,
            pagination: {
                currentPage: page,
                totalPages: totalPages,
                totalItems: totalItems,
                itemsPerPage: ITEMS_PER_PAGE,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1
            }
        });

    } catch (error) {
        console.error('Error fetching movies:', error);
        res.status(500).json({ error: 'Failed to fetch movies', details: error.message });
    }
};
