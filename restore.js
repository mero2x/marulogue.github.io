const fs = require('fs');
const path = require('path');

async function restore() {
    try {
        console.log('Reading imported_movies.json...');
        const dataPath = path.join(__dirname, 'data', 'imported_movies.json');
        const rawData = fs.readFileSync(dataPath, 'utf8');
        const movies = JSON.parse(rawData);

        console.log(`Found ${movies.length} movies to restore.`);

        console.log('Sending to server...');
        const response = await fetch('http://localhost:3000/api/save-movies', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(movies)
        });

        const result = await response.json();
        console.log('Restore result:', result);

    } catch (error) {
        console.error('Restore failed:', error);
    }
}

restore();
