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

        // Update the field
        if (!entry.fields[FIELD_ID]) {
            entry.fields[FIELD_ID] = {};
        }

        const moviesData = req.body;

        entry.fields[FIELD_ID]['en-US'] = moviesData;

        // Update and Publish
        entry = await entry.update();
        await entry.publish();

        res.status(200).json({ success: true, message: 'Movies saved to Contentful successfully!' });
    } catch (error) {
        console.error('Error saving to Contentful:', error);
        res.status(500).json({ success: false, message: 'Failed to save movies: ' + error.message });
    }
};
