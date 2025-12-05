const contentful = require('contentful-management');

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const newMovie = req.body;

        const client = contentful.createClient({
            accessToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN
        });

        const SPACE_ID = process.env.CONTENTFUL_SPACE_ID;
        const ENVIRONMENT_ID = 'master';
        const ENTRY_ID = process.env.CONTENTFUL_ENTRY_ID || 'movieList';
        const FIELD_ID = process.env.CONTENTFUL_FIELD_ID || 'contents';

        const space = await client.getSpace(SPACE_ID);
        const environment = await space.getEnvironment(ENVIRONMENT_ID);
        let entry = await environment.getEntry(ENTRY_ID);

        let currentMovies = entry.fields[FIELD_ID]['en-US'] || [];

        // Prevent duplicates
        const exists = currentMovies.some(m => m.id === newMovie.id);
        if (exists) {
            return res.status(400).json({ success: false, message: 'Movie already exists in catalogue' });
        }

        // Add to beginning
        currentMovies.unshift(newMovie);
        entry.fields[FIELD_ID]['en-US'] = currentMovies;

        // Update and Publish
        entry = await entry.update();
        await entry.publish();

        res.status(200).json({ success: true, message: 'Movie added successfully!' });
    } catch (error) {
        console.error('Error adding movie:', error);
        res.status(500).json({ success: false, message: 'Failed to add movie: ' + error.message });
    }
};
