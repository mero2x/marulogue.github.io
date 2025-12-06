const contentful = require('contentful-management');

const client = contentful.createClient({
    accessToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN
});

module.exports = async (req, res) => {
    // CORS headers
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
        const { changes } = req.body;

        if (!changes || !Array.isArray(changes) || changes.length === 0) {
            return res.status(400).json({ message: 'No changes provided' });
        }

        console.log(`Processing ${changes.length} changes`);

        const spaceId = process.env.CONTENTFUL_SPACE_ID;
        const entryId = process.env.CONTENTFUL_ENTRY_ID;
        const fieldId = process.env.CONTENTFUL_FIELD_ID;

        const space = await client.getSpace(spaceId);
        const environment = await space.getEnvironment('master');
        let entry = await environment.getEntry(entryId);

        let currentMovies = entry.fields[fieldId]['en-US'] || [];

        // Track stats
        let added = 0, updated = 0, deleted = 0;

        // Apply changes
        for (const change of changes) {
            if (change.type === 'add') {
                // Check if already exists
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

        // Save back to Contentful
        entry.fields[fieldId]['en-US'] = currentMovies;
        entry = await entry.update();
        await entry.publish();

        console.log(`Batch success: +${added}, ~${updated}, -${deleted}`);

        res.status(200).json({
            success: true,
            message: `Saved: ${added} added, ${updated} updated, ${deleted} deleted`,
            stats: { added, updated, deleted }
        });

    } catch (error) {
        console.error('Batch update failed:', error);
        res.status(500).json({ message: 'Failed to apply batch updates', error: error.message });
    }
};
