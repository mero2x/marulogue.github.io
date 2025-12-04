// TMDB API Configuration
const API_KEY = '5c9cef63f6816c9678256d7eb09b6ccc';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// Environment Check
const isAdmin = window.location.pathname.includes('admin.html');

// State
let watchedMovies = [];
let watchlist = []; // Not really used in public mode, but kept for admin
let searchResults = [];
let currentTab = isAdmin ? 'search' : 'watched';
let currentType = 'movie'; // 'movie', 'tv'
let currentSort = 'latest';
let currentMovieId = null;
let currentPage = 1;
const ITEMS_PER_PAGE = 30;

// DOM Elements
const searchInput = document.getElementById('movie-search-input');
const searchBtn = document.getElementById('search-btn');
const moviesGrid = document.getElementById('movies-grid');
const paginationContainer = document.getElementById('pagination');
const typeBtns = document.querySelectorAll('.type-btn');
const watchedBtn = document.getElementById('watched-btn');
const statsBtn = document.getElementById('stats-btn');
const filterBtn = document.getElementById('filter-btn');
const filterDropdown = document.getElementById('filter-dropdown');
const filterItems = document.querySelectorAll('.dropdown-item');

// Panel Elements
const panel = document.getElementById('movie-panel');
const panelOverlay = document.getElementById('panel-overlay');
const panelCloseBtn = document.getElementById('panel-close-btn');
const panelContent = document.getElementById('panel-content');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    enrichData(); // Fetch missing details (countries, directors) in background

    if (isAdmin) {
        fetchPopular();
    } else {
        sortResults(); // Ensure default sort is applied
        renderMovies();
    }

    setupEventListeners();
});

// Contentful Configuration
const CONTENTFUL_SPACE_ID = '6bzr8twttvj3';
const CONTENTFUL_ACCESS_TOKEN = 'MdfnSyUm-p9jlDCG7HCyUuokTZAhyK7UxuXdKA_vXUo';
const CONTENTFUL_ENTRY_ID = 'movieList';
const CONTENTFUL_FIELD_ID = 'contents';

async function loadData() {
    // 1. Try fetching from Contentful directly
    try {
        const url = `https://cdn.contentful.com/spaces/${CONTENTFUL_SPACE_ID}/environments/master/entries/${CONTENTFUL_ENTRY_ID}?access_token=${CONTENTFUL_ACCESS_TOKEN}`;
        const response = await fetch(url);

        if (response.ok) {
            const data = await response.json();
            // Contentful returns the field value. We expect it to be the array of movies.
            // The structure is usually data.fields[CONTENTFUL_FIELD_ID]
            if (data.fields && data.fields[CONTENTFUL_FIELD_ID]) {
                watchedMovies = data.fields[CONTENTFUL_FIELD_ID];
                console.log('Loaded data from Contentful');
                return;
            }
        }
    } catch (error) {
        console.warn('Failed to fetch from Contentful:', error);
    }

    // 2. Fallback to local JSON file
    try {
        const response = await fetch('./data/ass.json');
        if (response.ok) {
            watchedMovies = await response.json();
            console.log('Loaded data from local file');
        } else {
            console.error('Failed to load local data file');
            watchedMovies = [];
        }
    } catch (error) {
        console.error('Error loading local data:', error);
        watchedMovies = [];
    }
}

// Helper function to extract director name from movie credits
function extractDirector(credits) {
    if (!credits || !credits.crew) return null;
    const director = credits.crew.find(person => person.job === 'Director');
    return director ? director.name : null;
}

// Helper function to extract creator name from TV show
function extractCreator(createdBy) {
    if (!createdBy || !Array.isArray(createdBy) || createdBy.length === 0) return null;
    // Return the first creator's name
    return createdBy[0].name;
}

async function enrichData() {
    console.log('Enriching data...');
    let updated = false;

    // Create an array of promises to fetch data in parallel
    const promises = watchedMovies.map(async (item) => {
        // Check if we need to fetch details
        // For movies: need production_countries and credits (for director)
        // For TV: need origin_country (usually there) and created_by

        const isMovie = item.media_type === 'movie' || (!item.media_type && !item.first_air_date);
        const type = isMovie ? 'movie' : 'tv';

        const missingCountries = isMovie ? !item.production_countries : !item.origin_country;
        const missingCredits = isMovie ? (!item.credits || !item.credits.crew) : !item.created_by;

        if (missingCountries || missingCredits) {
            try {
                const response = await fetch(`${BASE_URL}/${type}/${item.id}?api_key=${API_KEY}&append_to_response=credits`);
                if (response.ok) {
                    const data = await response.json();

                    // Update our local item with the new details
                    if (isMovie) {
                        item.production_countries = data.production_countries;
                        // Extract and store only the director name, not the full credits object
                        item.director = extractDirector(data.credits);
                        // Delete the credits object if it exists to save space
                        delete item.credits;
                    } else {
                        item.origin_country = data.origin_country;
                        // Extract and store only the creator name
                        item.creator = extractCreator(data.created_by);
                        // Delete the created_by object to save space
                        delete item.created_by;
                    }
                    updated = true;
                }
            } catch (e) {
                console.warn(`Failed to enrich item ${item.id}:`, e);
            }
        }
    });

    await Promise.all(promises);

    if (updated) {
        console.log('Data enriched.');
        if (currentTab === 'stats') {
            renderStats();
        }
    }
}

function setupEventListeners() {
    // Search
    searchBtn.addEventListener('click', handleSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
    });

    // Type Tabs (Film/TV)
    typeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.classList.contains('active')) return;

            typeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            currentType = btn.dataset.type;

            if (isAdmin) {
                currentTab = 'search';
                searchInput.value = '';
                searchResults = [];
                fetchPopular();
            } else {
                // In public mode, just re-render to filter by type
                currentPage = 1;
                if (currentTab === 'stats') {
                    renderStats();
                } else {
                    renderMovies();
                }
            }
        });
    });

    // Watched Button
    if (watchedBtn) {
        watchedBtn.addEventListener('click', () => {
            currentTab = 'watched';
            currentPage = 1;

            // Toggle active state
            watchedBtn.classList.add('active');
            if (statsBtn) statsBtn.classList.remove('active');

            renderMovies();
        });
    }

    // Stats Button
    if (statsBtn) {
        statsBtn.addEventListener('click', () => {
            currentTab = 'stats';

            // Toggle active state
            statsBtn.classList.add('active');
            if (watchedBtn) watchedBtn.classList.remove('active');

            renderStats();
        });
    }

    // Export Button (Admin Only)
    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportData);
    }

    // Filter Dropdown
    filterItems.forEach(item => {
        item.addEventListener('click', () => {
            currentSort = item.dataset.sort;
            sortResults();
            renderMovies();
        });
    });

    // Panel Close
    panelCloseBtn.addEventListener('click', closePanel);
    panelOverlay.addEventListener('click', closePanel);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closePanel();
    });
}

async function fetchPopular() {
    if (!isAdmin) return; // Public doesn't fetch popular

    try {
        const response = await fetch(`${BASE_URL}/${currentType}/popular?api_key=${API_KEY}`);
        const data = await response.json();
        searchResults = data.results;
        renderMovies();
    } catch (error) {
        console.error('Error fetching popular items:', error);
    }
}

async function handleSearch() {
    const query = searchInput.value.trim();

    if (isAdmin) {
        // Admin: Search TMDB
        if (!query) {
            fetchPopular();
            return;
        }

        try {
            const response = await fetch(`${BASE_URL}/search/${currentType}?api_key=${API_KEY}&query=${encodeURIComponent(query)}`);
            const data = await response.json();
            searchResults = data.results;
            currentTab = 'search';
            currentPage = 1;
            renderMovies();
        } catch (error) {
            console.error('Error searching:', error);
        }
    } else {
        // Public: Filter Local List
        if (!query) {
            currentTab = 'watched';
            renderMovies();
            return;
        }

        const lowerQuery = query.toLowerCase();
        searchResults = watchedMovies.filter(m => {
            const title = m.title || m.name || '';
            return title.toLowerCase().includes(lowerQuery);
        });

        currentTab = 'search';
        currentPage = 1;
        renderMovies();
    }
}

function sortResults() {
    const list = currentTab === 'watched' ? watchedMovies : searchResults;

    list.sort((a, b) => {
        const dateA = new Date(a.release_date || a.first_air_date || 0);
        const dateB = new Date(b.release_date || b.first_air_date || 0);

        if (currentSort === 'rating_desc') {
            const ratingA = parseFloat(a.rating) || 0;
            const ratingB = parseFloat(b.rating) || 0;
            return ratingB - ratingA;
        }
        if (currentSort === 'rating_asc') {
            const ratingA = parseFloat(a.rating) || 0;
            const ratingB = parseFloat(b.rating) || 0;
            return ratingA - ratingB;
        }
        if (currentSort === 'earliest') return dateA - dateB;

        // Default: latest release date
        return dateB - dateA;
    });
}

function renderMovies() {
    moviesGrid.innerHTML = '';
    if (paginationContainer) paginationContainer.innerHTML = '';

    let list = currentTab === 'watched' ? watchedMovies : searchResults;

    // Filter by type
    // In Admin Search, results are already typed. 
    // In Public Watched/Search, we need to filter.
    if (currentTab === 'watched' || (!isAdmin && currentTab === 'search')) {
        list = list.filter(item => {
            // Check explicit media_type or infer
            const type = item.media_type || (item.first_air_date ? 'tv' : 'movie');
            return type === currentType;
        });
    }

    if (list.length === 0) {
        moviesGrid.innerHTML = `<div class="empty-state"><p>No ${currentType === 'movie' ? 'movies' : 'TV shows'} found.</p></div>`;
        return;
    }

    // Pagination
    const totalItems = list.length;
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

    if (currentPage > totalPages) currentPage = 1;

    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const paginatedList = list.slice(start, end);

    paginatedList.forEach(item => {
        const card = createMovieCard(item);
        moviesGrid.appendChild(card);
    });

    renderPagination(totalPages);
}

function renderPagination(totalPages) {
    if (totalPages <= 1 || !paginationContainer) return;

    const prevBtn = document.createElement('button');
    prevBtn.className = 'pagination-btn';
    prevBtn.textContent = '←';
    prevBtn.disabled = currentPage === 1;
    prevBtn.onclick = () => {
        if (currentPage > 1) {
            currentPage--;
            renderMovies();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const nextBtn = document.createElement('button');
    nextBtn.className = 'pagination-btn';
    nextBtn.textContent = '→';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.onclick = () => {
        if (currentPage < totalPages) {
            currentPage++;
            renderMovies();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const pageInfo = document.createElement('span');
    pageInfo.className = 'pagination-info';
    pageInfo.style.alignSelf = 'center';
    pageInfo.style.color = 'var(--text-secondary)';
    pageInfo.style.fontSize = '14px';
    pageInfo.textContent = `${currentPage} / ${totalPages}`;

    paginationContainer.appendChild(prevBtn);
    paginationContainer.appendChild(pageInfo);
    paginationContainer.appendChild(nextBtn);
}

function createMovieCard(item) {
    const div = document.createElement('div');
    div.className = 'movie-card fade-in';
    div.onclick = () => openMoviePanel(item.id);

    // Handle poster path - ensure it starts with / and construct full URL
    let posterPath = 'https://via.placeholder.com/500x750?text=No+Poster';
    if (item.poster_path) {
        const path = item.poster_path.startsWith('/') ? item.poster_path : `/${item.poster_path}`;
        posterPath = `${IMAGE_BASE_URL}${path}`;
    }

    const title = item.title || item.name;
    const date = item.release_date || item.first_air_date;
    const year = date ? date.split('-')[0] : '';
    const tooltipText = year ? `${title} (${year})` : title;

    // Add data-title attribute for tooltip
    div.setAttribute('data-title', tooltipText);

    div.innerHTML = `
        <img src="${posterPath}" alt="${title}" class="movie-poster" loading="lazy">
        <div class="movie-overlay">
            <div class="movie-title">${title}</div>
        </div>
    `;

    return div;
}

async function openMoviePanel(id) {
    currentMovieId = id;
    panel.classList.add('active');
    panelOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    panelContent.innerHTML = '<div class="panel-loading">Loading details...</div>';

    // In Public mode, we might not want to fetch from API if we have data in JSON.
    // But JSON might be minimal. Let's try to find in local first.
    let item = watchedMovies.find(m => m.id === id);
    if (!item && isAdmin) {
        item = searchResults.find(m => m.id === id);
    }

    try {
        let data = item;
        let posterImages = [];

        // Fetch details and images
        const detailsResponse = await fetch(`${BASE_URL}/${currentType}/${id}?api_key=${API_KEY}&append_to_response=credits,images`);
        if (detailsResponse.ok) {
            data = await detailsResponse.json();

            // Extract poster images for admin mode
            if (isAdmin && data.images && data.images.posters) {
                posterImages = data.images.posters; // Show all posters
            }
        }

        // Extract Data
        const title = data.title || data.name;
        const date = data.release_date || data.first_air_date;
        const year = date ? date.split('-')[0] : 'N/A';
        const country = data.production_countries && data.production_countries.length > 0
            ? getCountryName(data.production_countries[0].name)
            : (data.origin_country ? getCountryName(data.origin_country[0]) : 'Unknown');

        let creatorOrDirector = 'Unknown';
        if (currentType === 'movie') {
            const director = data.credits?.crew?.find(p => p.job === 'Director');
            if (director) creatorOrDirector = director.name;
        } else {
            if (data.created_by && data.created_by.length > 0) {
                creatorOrDirector = data.created_by.map(c => c.name).join(', ');
            }
        }

        // User Data (from watchedMovies)
        const watchedData = watchedMovies.find(m => m.id === id);
        const isWatched = !!watchedData;
        const userRating = watchedData ? (watchedData.rating || 0) : 0;
        const userReview = watchedData ? (watchedData.review || '') : '';

        const posterPath = data.poster_path
            ? `${IMAGE_BASE_URL}${data.poster_path}`
            : 'https://via.placeholder.com/500x750?text=No+Poster';

        // Render Panel Content
        let actionsHtml = '';
        let reviewHtml = '';

        if (isAdmin) {
            // Admin Controls
            actionsHtml = `
                <div class="panel-actions">
                    <button class="action-btn ${isWatched ? 'active' : ''}" onclick="toggleWatched(${id})" title="Mark as Watched">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20 6L9 17l-5-5"></path>
                        </svg>
                    </button>
                </div>
            `;

            if (isWatched) {
                reviewHtml = `
                    <div class="panel-section fade-in">
                        <h3>Rating</h3>
                        <div class="panel-rating">
                            ${renderStarRating(id, userRating, true)}
                        </div>
                    </div>
                    <div class="panel-section fade-in">
                        <h3>Review</h3>
                        <textarea class="review-input" id="review-input" placeholder="Write your review here...">${userReview}</textarea>
                        <div class="save-status" id="save-status"></div>
                    </div>
                `;
            }
        } else {
            // Public View (Read Only)
            if (isWatched) {
                reviewHtml = `
                    <div class="panel-section fade-in">
                        <h3>Rating</h3>
                        <div class="panel-rating">
                            ${renderStarRating(id, userRating, false)}
                        </div>
                    </div>
                    ${userReview ? `
                    <div class="panel-section fade-in">
                        <h3>Review</h3>
                        <p class="post-content">${userReview}</p>
                    </div>
                    ` : ''}
                `;
            }
        }

        // Poster Selector (Admin Only)
        let posterSelectorHtml = '';
        if (isAdmin && posterImages.length > 0) {
            posterSelectorHtml = `
                <div class="panel-section fade-in">
                    <h3>Choose Poster</h3>
                    <div class="poster-gallery">
                        ${posterImages.map((poster, index) => `
                            <img 
                                src="${IMAGE_BASE_URL}${poster.file_path}" 
                                alt="Poster ${index + 1}"
                                class="poster-option ${poster.file_path === (item?.poster_path || data.poster_path) ? 'selected' : ''}"
                                onclick="selectPoster(${id}, '${poster.file_path}')"
                            />
                        `).join('')}
                    </div>
                </div>
            `;
        }

        panelContent.innerHTML = `
            <div class="panel-header">
                <img src="${posterPath}" alt="${title}" class="panel-poster" id="current-poster">
                <div class="panel-info">
                    <div class="panel-title">${title}</div>
                    <div class="panel-meta">
                        <span>${year}</span>
                        <span>${creatorOrDirector}</span>
                        <span>${country}</span>
                        ${currentType === 'tv' && data.number_of_seasons ? `<span>${data.number_of_seasons} Seasons</span>` : ''}
                    </div>
                    ${actionsHtml}
                </div>
            </div>
            ${reviewHtml}
            ${posterSelectorHtml}
        `;

        if (isAdmin && isWatched) {
            const reviewInput = document.getElementById('review-input');
            if (reviewInput) {
                reviewInput.addEventListener('input', debounce(() => saveReview(id, reviewInput.value), 1000));
            }
        }

    } catch (error) {
        console.error('Error loading details:', error);
        panelContent.innerHTML = '<div class="panel-loading">Error loading details.</div>';
    }
}

function closePanel() {
    panel.classList.remove('active');
    panelOverlay.classList.remove('active');
    document.body.style.overflow = '';
    currentMovieId = null;
}

// Global Handlers (Admin Only)
window.toggleWatched = function (id) {
    if (!isAdmin) return;

    const index = watchedMovies.findIndex(m => m.id === id);
    if (index === -1) {
        // Add
        const item = searchResults.find(m => m.id === id);
        if (item) {
            watchedMovies.push({
                ...item,
                media_type: currentType,
                rating: 0,
                review: '',
                dateWatched: new Date().toISOString()
            });
        }
    } else {
        // Remove
        watchedMovies.splice(index, 1);
    }
    // No explicit save to localStorage needed if we rely on Export, 
    // but saving to localStorage is good for persistence during editing session.
    // We can implement a simple localStorage backup.
    renderMovies();
    if (currentMovieId === id) openMoviePanel(id);
};

window.rateMovie = function (id, rating) {
    if (!isAdmin) return;
    const index = watchedMovies.findIndex(m => m.id === id);
    if (index !== -1) {
        watchedMovies[index].rating = rating;
        openMoviePanel(id);
    }
};

function saveReview(id, text) {
    if (!isAdmin) return;
    const index = watchedMovies.findIndex(m => m.id === id);
    if (index !== -1) {
        watchedMovies[index].review = text;
        const status = document.getElementById('save-status');
        if (status) {
            status.textContent = 'Saved';
            setTimeout(() => status.textContent = '', 2000);
        }
    }
}

window.selectPoster = function (id, posterPath) {
    if (!isAdmin) return;

    const index = watchedMovies.findIndex(m => m.id === id);
    if (index !== -1) {
        watchedMovies[index].poster_path = posterPath;

        // Update the main poster image
        const currentPoster = document.getElementById('current-poster');
        if (currentPoster) {
            currentPoster.src = `${IMAGE_BASE_URL}${posterPath} `;
        }

        // Update selected state
        document.querySelectorAll('.poster-option').forEach(img => {
            img.classList.remove('selected');
        });
        event.target.classList.add('selected');
    }
};

async function exportData() {
    try {
        const response = await fetch('http://localhost:3000/api/save-movies', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(watchedMovies)
        });

        const result = await response.json();

        if (result.success) {
            alert('✓ Changes saved successfully!');
        } else {
            alert('✗ Failed to save changes: ' + result.message);
        }
    } catch (error) {
        console.error('Error saving data:', error);
        alert('✗ Failed to save changes. Make sure the server is running.');
    }
}

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}
function getCountryName(name) {
    if (name === 'United States of America') return 'USA';
    if (name === 'United Kingdom') return 'UK';
    return name;
}

function renderStats() {
    moviesGrid.innerHTML = '';
    if (paginationContainer) paginationContainer.innerHTML = '';

    // Filter data based on current type (Film/TV)
    const list = watchedMovies.filter(item => {
        const type = item.media_type || (item.first_air_date ? 'tv' : 'movie');
        return type === currentType;
    });

    if (list.length === 0) {
        moviesGrid.innerHTML = `<div class="empty-state"><p>No watched ${currentType === 'movie' ? 'movies' : 'TV shows'} to analyze.</p></div>`;
        return;
    }

    // --- Calculate Stats ---

    // 1. Total Watched
    const totalWatched = list.length;

    // 2. Countries
    const countryMap = {};
    list.forEach(item => {
        let countries = [];
        if (item.production_countries && item.production_countries.length > 0) {
            countries = item.production_countries.map(c => getCountryName(c.name));
        } else if (item.origin_country && item.origin_country.length > 0) {
            countries = item.origin_country.map(c => getCountryName(c));
        }

        countries.forEach(c => {
            countryMap[c] = (countryMap[c] || 0) + 1;
        });
    });
    const totalCountries = Object.keys(countryMap).length;

    // 3. Directors / Creators
    const personMap = {};
    list.forEach(item => {
        let people = [];
        if (currentType === 'movie') {
            // For movies, we need 'director'. 
            // Note: watchedMovies might not have full credits unless we fetched them.
            // If we don't have credits, we can't count directors yet.
            // We'll check if 'credits' or 'director' field exists.
            if (item.credits && item.credits.crew) {
                const directors = item.credits.crew.filter(c => c.job === 'Director');
                people = directors.map(d => d.name);
            }
        } else {
            // For TV, 'created_by'
            if (item.created_by && item.created_by.length > 0) {
                people = item.created_by.map(p => p.name);
            }
        }

        people.forEach(p => {
            personMap[p] = (personMap[p] || 0) + 1;
        });
    });
    const totalPeople = Object.keys(personMap).length;
    const personLabel = currentType === 'movie' ? 'Directors' : 'Creators';

    // --- Generate Top 10 Lists ---

    const topCountries = Object.entries(countryMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    const topPeople = Object.entries(personMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    // --- Render HTML ---

    const statsHtml = `
        <div class="stats-container fade-in">
            <div class="stats-overview">
                <div class="stat-card">
                    <div class="stat-number">${totalWatched}</div>
                    <div class="stat-label">${currentType === 'movie' ? 'Films' : 'Shows'} Watched</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${totalCountries}</div>
                    <div class="stat-label">Countries</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${totalPeople}</div>
                    <div class="stat-label">${personLabel}</div>
                </div>
            </div>

            <div class="stats-lists">
                <div class="list-section">
                    <h3>Top 10 Countries</h3>
                    ${renderBarChart(topCountries, totalWatched)}
                </div>
                <div class="list-section">
                    <h3>Top 10 ${personLabel}</h3>
                    ${renderBarChart(topPeople, totalWatched)}
                </div>
            </div>
        </div>
    `;

    moviesGrid.innerHTML = statsHtml;
}

function renderBarChart(data, total) {
    if (data.length === 0) {
        return '<p class="empty-list">No data available.</p>';
    }

    // Find max value to scale bars relative to the highest item, not total
    const maxVal = Math.max(...data.map(d => d[1]));

    const listItems = data.map(item => {
        const [label, count] = item;
        const percentage = (count / maxVal) * 100;

        return `
            <li class="list-item">
                <div class="list-label" title="${label}">${label}</div>
                <div class="bar-container">
                    <div class="bar" style="width: ${percentage}%"></div>
                </div>
                <div class="count-label">${count}</div>
            </li>
        `;
    }).join('');

    return `<ul class="top-list">${listItems}</ul>`;
}

function renderStarRating(id, rating, interactive) {
    let html = '';
    for (let i = 1; i <= 5; i++) {
        const fullStar = i <= rating;
        const halfStar = i - 0.5 === rating;

        // For interactive, we need two click zones per star
        if (interactive) {
            let style = `color: ${fullStar ? '#ffd700' : '#555'};`;
            if (halfStar) {
                style = `background: linear-gradient(90deg, #ffd700 50%, #555 50%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;`;
            }

            html += `
            <div class="star-container" style="position: relative; display: inline-block; width: 24px; height: 24px; cursor: pointer;">
                <span class="star-icon" style="${style} font-size: 24px;">★</span>
                <div class="click-left" onclick="rateMovie(${id}, ${i - 0.5})" style="position: absolute; left: 0; top: 0; width: 50%; height: 100%; z-index: 2;"></div>
                <div class="click-right" onclick="rateMovie(${id}, ${i})" style="position: absolute; right: 0; top: 0; width: 50%; height: 100%; z-index: 2;"></div>
            </div>`;
        } else {
            // Read only
            let color = '#555';
            if (fullStar) color = '#ffd700';
            else if (halfStar) color = '#ffd700'; // Simplify half star visual for now, or use a gradient

            // Better half-star visual using gradient
            const style = halfStar
                ? `background: linear-gradient(90deg, #ffd700 50%, #555 50%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;`
                : `color: ${color};`;

            html += `<span class="star-btn" style="font-size: 24px; cursor: default; ${style}">★</span>`;
        }
    }
    return html;
}

