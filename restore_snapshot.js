const contentful = require('contentful-management');
require('dotenv').config();

async function restoreSnapshot() {
    try {
        const client = contentful.createClient({
            accessToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN
        });

        const SPACE_ID = process.env.CONTENTFUL_SPACE_ID;
        const ENVIRONMENT_ID = 'master';
        const ENTRY_ID = process.env.CONTENTFUL_ENTRY_ID || 'movieList';
        const SNAPSHOT_ID = '5O0kvJ6RsJIJJ70DdoyHNV'; // 2025-12-05T08:29:15.453Z

        console.log(`Restoring Snapshot: ${SNAPSHOT_ID}`);

        const space = await client.getSpace(SPACE_ID);
        const environment = await space.getEnvironment(ENVIRONMENT_ID);
        let entry = await environment.getEntry(ENTRY_ID);

        const snapshot = await entry.getSnapshot(SNAPSHOT_ID);

        // Handle snapshot structure
        let moviesData;
        if (snapshot.snapshot && snapshot.snapshot.fields) {
            moviesData = snapshot.snapshot.fields.contents['en-US'];
        } else if (snapshot.fields) {
            moviesData = snapshot.fields.contents['en-US'];
        } else {
            throw new Error('Could not find data in snapshot');
        }

        console.log(`Found ${moviesData ? moviesData.length : 0} items in snapshot.`);

        // Restore
        entry.fields.contents['en-US'] = moviesData;

        console.log('Updating entry...');
        entry = await entry.update();

        console.log('Publishing...');
        await entry.publish();

        console.log('✅ Restoration Complete!');

    } catch (error) {
        console.error('Error:', error.message);
        console.error('Full Error:', error);
    }
}

restoreSnapshot();
