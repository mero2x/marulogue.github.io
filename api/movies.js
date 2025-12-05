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
        const page = parseInt(req.query.page) || 1;
        const limit = 30;
        const type = req.query.type || 'movie';

        const entry = await client.getEntry(process.env.CONTENTFUL_ENTRY_ID || 'movieList');
        const allItems = entry.fields.contents || [];

        // Filter
        const filtered = allItems.filter(item => {
            const itemType = item.media_type || (item.first_air_date ? 'tv' : 'movie');
            return itemType === type;
        });

        // Sort (Newest watched first)
        filtered.sort((a, b) => new Date(b.dateWatched || 0) - new Date(a.dateWatched || 0));

        // Paginate
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginated = filtered.slice(startIndex, endIndex);

        res.json({
            movies: paginated,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(filtered.length / limit),
                totalItems: filtered.length,
                hasNextPage: endIndex < filtered.length,
                hasPrevPage: page > 1
            }
        });
    } catch (error) {
        console.error('Error fetching movies:', error);
        res.status(500).json({ movies: [], pagination: {}, error: error.message });
    }
};
