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
        const sort = req.query.sort || 'latest';
        const searchQuery = req.query.search || '';

        const entry = await client.getEntry(process.env.CONTENTFUL_ENTRY_ID || 'movieList');
        let allItems = entry.fields.contents || [];

        // Search filter (if query provided)
        if (searchQuery) {
            const lowerQuery = searchQuery.toLowerCase();
            allItems = allItems.filter(item => {
                const title = (item.title || item.name || '').toLowerCase();
                return title.includes(lowerQuery);
            });
        }

        // Type filter
        const filtered = allItems.filter(item => {
            const itemType = item.media_type || (item.first_air_date ? 'tv' : 'movie');
            return itemType === type;
        });

        // Sort based on parameter
        filtered.sort((a, b) => {
            const dateA = new Date(a.release_date || a.first_air_date || 0);
            const dateB = new Date(b.release_date || b.first_air_date || 0);

            switch (sort) {
                case 'rating_desc':
                    const ratingA = parseFloat(a.rating) || 0;
                    const ratingB = parseFloat(b.rating) || 0;
                    return ratingB - ratingA;
                case 'rating_asc':
                    const ratingA2 = parseFloat(a.rating) || 0;
                    const ratingB2 = parseFloat(b.rating) || 0;
                    return ratingA2 - ratingB2;
                case 'earliest':
                    return dateA - dateB;
                case 'latest':
                default:
                    return dateB - dateA;
            }
        });

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
