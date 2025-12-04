const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const contentful = require('contentful-management');
require('dotenv').config();

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' })); // Increase limit for large data
app.use(express.static(__dirname));

// Contentful Configuration
const client = contentful.createClient({
    accessToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN
});

const SPACE_ID = process.env.CONTENTFUL_SPACE_ID;
const ENVIRONMENT_ID = 'master'; // Assuming master environment
const ENTRY_ID = process.env.CONTENTFUL_ENTRY_ID;
const FIELD_ID = process.env.CONTENTFUL_FIELD_ID;

// Helper to get Contentful Environment
async function getEnvironment() {
    const space = await client.getSpace(SPACE_ID);
    return await space.getEnvironment(ENVIRONMENT_ID);
}

// API endpoint to save movies data
app.post('/api/save-movies', async (req, res) => {
    try {
        const moviesData = req.body;
        const environment = await getEnvironment();
        let entry = await environment.getEntry(ENTRY_ID);

        // Update the field
        // Note: We assume 'en-US' locale. If your locale is different, change it here.
        if (!entry.fields[FIELD_ID]) {
            entry.fields[FIELD_ID] = {};
        }
        entry.fields[FIELD_ID]['en-US'] = moviesData;

        // Update and Publish
        entry = await entry.update();
        await entry.publish();

        res.json({ success: true, message: 'Movies saved to Contentful successfully!' });
    } catch (error) {
        console.error('Error saving to Contentful:', error);
        res.status(500).json({ success: false, message: 'Failed to save movies: ' + error.message });
    }
});

// API endpoint to get movies data
app.get('/api/movies', async (req, res) => {
    try {
        const spaceId = process.env.CONTENTFUL_SPACE_ID;
        const accessToken = process.env.CONTENTFUL_ACCESS_TOKEN;
        const entryId = process.env.CONTENTFUL_ENTRY_ID;
        const fieldId = process.env.CONTENTFUL_FIELD_ID;

        if (!accessToken) {
            console.warn('No Contentful Access Token provided. Returning empty list.');
            return res.json([]);
        }

        const url = `https://cdn.contentful.com/spaces/${spaceId}/environments/master/entries/${entryId}?access_token=${accessToken}`;

        const response = await fetch(url);

        if (response.ok) {
            const data = await response.json();
            // CDA returns fields with the default locale (or requested locale) merged
            const movies = data.fields[fieldId] || [];
            res.json(movies);
        } else {
            if (response.status === 404) {
                console.log('Contentful entry not found. Returning empty list.');
            } else {
                console.error('Contentful API error:', response.status, response.statusText);
            }
            res.json([]);
        }
    } catch (error) {
        console.error('Error fetching from Contentful:', error);
        res.json([]);
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Admin panel: http://localhost:${PORT}/admin.html`);
    console.log(`Public catalogue: http://localhost:${PORT}/catalogue.html`);
});
