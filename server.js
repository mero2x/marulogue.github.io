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
        console.log('📝 Save request received');
        console.log('Data length:', req.body ? req.body.length : 0);

        const moviesData = req.body;

        // Check if environment variables are set
        if (!SPACE_ID || !ENTRY_ID || !FIELD_ID) {
            console.error('❌ Missing environment variables:');
            console.error('SPACE_ID:', SPACE_ID ? '✓' : '✗');
            console.error('ENTRY_ID:', ENTRY_ID ? '✓' : '✗');
            console.error('FIELD_ID:', FIELD_ID ? '✓' : '✗');
            return res.status(500).json({
                success: false,
                message: 'Server configuration error: Missing Contentful credentials'
            });
        }

        console.log('🔄 Connecting to Contentful...');
        const environment = await getEnvironment();
        console.log('✓ Connected to environment');

        console.log('📖 Fetching entry:', ENTRY_ID);
        let entry = await environment.getEntry(ENTRY_ID);
        console.log('✓ Entry fetched');

        // Update the field
        if (!entry.fields[FIELD_ID]) {
            entry.fields[FIELD_ID] = {};
        }
        entry.fields[FIELD_ID]['en-US'] = moviesData;
        console.log('✓ Field updated');

        // Update and Publish
        console.log('💾 Saving to Contentful...');
        entry = await entry.update();
        console.log('✓ Entry updated');

        console.log('📤 Publishing...');
        await entry.publish();
        console.log('✅ Successfully published!');

        res.json({ success: true, message: 'Movies saved to Contentful successfully!' });
    } catch (error) {
        console.error('❌ Error saving to Contentful:');
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Full error:', error);
        res.status(500).json({ success: false, message: 'Failed to save movies: ' + error.message });
    }
});

// API endpoint to ADD a single movie (Safer)
app.post('/api/add-movie', async (req, res) => {
    try {
        const newMovie = req.body;
        console.log('📝 Add movie request:', newMovie.title);

        if (!SPACE_ID || !ENTRY_ID || !FIELD_ID) {
            return res.status(500).json({ success: false, message: 'Server config missing' });
        }

        const environment = await getEnvironment();
        let entry = await environment.getEntry(ENTRY_ID);

        let currentMovies = entry.fields[FIELD_ID]['en-US'] || [];

        // Prevent duplicates
        const exists = currentMovies.some(m => m.id === newMovie.id);
        if (exists) {
            return res.status(400).json({ success: false, message: 'Movie already exists in catalogue' });
        }

        // Add new movie
        currentMovies.unshift(newMovie); // Add to beginning
        entry.fields[FIELD_ID]['en-US'] = currentMovies;

        console.log('💾 Saving updated list...');
        entry = await entry.update();
        await entry.publish();
        console.log('✅ Movie added successfully');

        res.json({ success: true, message: 'Movie added successfully!' });
    } catch (error) {
        console.error('❌ Error adding movie:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// API endpoint to UPDATE a movie
app.post('/api/update-movie', async (req, res) => {
    try {
        const { id, updates } = req.body;
        console.log('📝 Update movie request:', id);

        if (!SPACE_ID || !ENTRY_ID || !FIELD_ID) {
            return res.status(500).json({ success: false, message: 'Server config missing' });
        }

        const environment = await getEnvironment();
        let entry = await environment.getEntry(ENTRY_ID);

        let currentMovies = entry.fields[FIELD_ID]['en-US'] || [];

        const index = currentMovies.findIndex(m => m.id === id);
        if (index === -1) {
            return res.status(404).json({ success: false, message: 'Movie not found' });
        }

        // Merge updates
        currentMovies[index] = { ...currentMovies[index], ...updates };
        entry.fields[FIELD_ID]['en-US'] = currentMovies;

        console.log('💾 Saving updated list...');
        entry = await entry.update();
        await entry.publish();
        console.log('✅ Movie updated successfully');

        res.json({ success: true, message: 'Movie updated successfully!' });
    } catch (error) {
        console.error('❌ Error updating movie:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// API endpoint for BATCH updates (Safest)
app.post('/api/batch-update', async (req, res) => {
    try {
        const { changes } = req.body;
        console.log(`📝 Batch update request: ${changes?.length || 0} changes`);

        if (!SPACE_ID || !ENTRY_ID || !FIELD_ID) {
            return res.status(500).json({ success: false, message: 'Server config missing' });
        }

        const environment = await getEnvironment();
        let entry = await environment.getEntry(ENTRY_ID);
        let currentMovies = entry.fields[FIELD_ID]['en-US'] || [];

        let added = 0, updated = 0, deleted = 0;

        for (const change of changes) {
            if (change.type === 'add') {
                if (!currentMovies.some(m => m.id === change.data.id)) {
                    currentMovies.push(change.data);
                    added++;
                }
            } else if (change.type === 'delete') {
                const initialLength = currentMovies.length;
                currentMovies = currentMovies.filter(m => m.id !== change.id);
                if (currentMovies.length < initialLength) deleted++;
            } else if (change.type === 'update') {
                const index = currentMovies.findIndex(m => m.id === change.id);
                if (index !== -1) {
                    currentMovies[index] = { ...currentMovies[index], ...change.updates };
                    updated++;
                }
            }
        }

        entry.fields[FIELD_ID]['en-US'] = currentMovies;
        entry = await entry.update();
        await entry.publish();

        console.log(`✅ Batch save success: +${added}, ~${updated}, -${deleted}`);
        res.status(200).json({ success: true, stats: { added, updated, deleted } });

    } catch (error) {
        console.error('Batch update error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// API endpoint to DELETE a movie
app.post('/api/delete-movie', async (req, res) => {
    try {
        const { id } = req.body;
        console.log('📝 Delete movie request:', id);

        if (!SPACE_ID || !ENTRY_ID || !FIELD_ID) {
            return res.status(500).json({ success: false, message: 'Server config missing' });
        }

        const environment = await getEnvironment();
        let entry = await environment.getEntry(ENTRY_ID);

        let currentMovies = entry.fields[FIELD_ID]['en-US'] || [];

        const initialLength = currentMovies.length;
        currentMovies = currentMovies.filter(m => m.id !== id);

        if (currentMovies.length === initialLength) {
            return res.status(404).json({ success: false, message: 'Movie not found' });
        }

        entry.fields[FIELD_ID]['en-US'] = currentMovies;

        console.log('💾 Saving updated list...');
        entry = await entry.update();
        await entry.publish();
        console.log('✅ Movie deleted successfully');

        res.json({ success: true, message: 'Movie deleted successfully!' });
    } catch (error) {
        console.error('❌ Error deleting movie:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// API endpoint to get movies data
app.get('/api/movies', async (req, res) => {
    try {
        const spaceId = process.env.CONTENTFUL_SPACE_ID;
        const accessToken = process.env.CONTENTFUL_ACCESS_TOKEN;
        const entryId = process.env.CONTENTFUL_ENTRY_ID;
        const fieldId = process.env.CONTENTFUL_FIELD_ID;

        const page = parseInt(req.query.page) || 1;
        const limit = 30;
        const type = req.query.type || 'movie';
        const sort = req.query.sort || 'latest';
        const searchQuery = req.query.search || '';

        if (!accessToken) {
            console.warn('No Contentful Access Token provided.');
            return res.json({ movies: [], pagination: {} });
        }

        const url = `https://cdn.contentful.com/spaces/${spaceId}/environments/master/entries/${entryId}?access_token=${accessToken}&t=${Date.now()}`; // Add cache buster

        const response = await fetch(url);

        if (response.ok) {
            const data = await response.json();
            let allItems = data.fields[fieldId] || [];

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
        } else {
            console.error('Contentful API error:', response.status);
            res.json({ movies: [], pagination: {} });
        }
    } catch (error) {
        console.error('Error fetching from Contentful:', error);
        res.json({ movies: [], pagination: {} });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Admin panel: http://localhost:${PORT}/admin.html`);
    console.log(`Public catalogue: http://localhost:${PORT}/catalogue.html`);
});
