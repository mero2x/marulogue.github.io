const contentful = require('contentful-management');

const API_TOKEN = 'MdfnSyUm-p9jlDCG7HCyUuokTZAhyK7UxuXdKA_vXUo'; // This looks like CDA token, NOT Management token?
// server.js uses process.env.CONTENTFUL_MANAGEMENT_TOKEN
// I need the management token.
// Env vars are in .env. I cannot read .env directly.
// But I can run this script with `node -r dotenv/config list_snapshots.js` if dotenv is installed.
// Or copy the token if I saw it. I haven't seen the Management token value, only variable name.
// Wait, Step 354 log says "[dotenv@17.2.3] injecting env".
// I can rely on `dotenv`.

require('dotenv').config();

async function listSnapshots() {
    try {
        const client = contentful.createClient({
            accessToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN
        });

        const SPACE_ID = process.env.CONTENTFUL_SPACE_ID;
        const ENVIRONMENT_ID = 'master';
        const ENTRY_ID = process.env.CONTENTFUL_ENTRY_ID || 'movieList';

        console.log(`Checking snapshots for Entry: ${ENTRY_ID} in Space: ${SPACE_ID}`);

        const space = await client.getSpace(SPACE_ID);
        const environment = await space.getEnvironment(ENVIRONMENT_ID);
        const entry = await environment.getEntry(ENTRY_ID);

        const snapshots = await entry.getSnapshots({ limit: 5 });

        console.log(`Found ${snapshots.items.length} snapshots.`);

        snapshots.items.slice(0, 10).forEach((s, index) => {
            const length = s.fields?.contents?.['en-US']?.length || 'N/A';
            console.log(`[${index}] ID: ${s.sys.id} | Date: ${s.sys.updatedAt} | Size: ${length} items`);
        });

    } catch (error) {
        console.error('Error:', error.message);
    }
}

listSnapshots();
