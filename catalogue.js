// TMDB API Configuration
const API_KEY = '5c9cef63f6816c9678256d7eb09b6ccc';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// Environment Check
const isAdmin = window.location.pathname.includes('admin');

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

// Temporary storage for rating/review before movie is added
let pendingEdits = {};

// Queue for BATCH SAVING (Safest way)
let changeQueue = []; // Array of { type: 'add'|'update'|'delete', id: ..., data: ..., updates: ... }

// Update UI to show/hide Save Button
function updateSaveButton() {
    let saveBtn = document.getElementById('save-changes-btn');

    // Create button if it doesn't exist
    if (!saveBtn) {
        saveBtn = document.createElement('button');
        saveBtn.id = 'save-changes-btn';
        saveBtn.className = 'save-fab';
        saveBtn.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                <polyline points="17 21 17 13 7 13 7 21"></polyline>
                <polyline points="7 3 7 8 15 8"></polyline>
            </svg>
            <span>Save Changes</span>
        `;
        saveBtn.onclick = saveAllChanges;
        document.body.appendChild(saveBtn);
    }

    // Show if there are unsaved changes
    if (changeQueue.length > 0) {
        saveBtn.classList.add('visible');
        saveBtn.querySelector('span').textContent = `Save Changes (${changeQueue.length})`;

        // Add navigation warning
        window.onbeforeunload = () => "You have unsaved changes. Are you sure you want to leave?";
    } else {
        saveBtn.classList.remove('visible');
        window.onbeforeunload = null;
    }
}

// Save all queued changes
async function saveAllChanges() {
    const saveBtn = document.getElementById('save-changes-btn');
    if (!saveBtn || changeQueue.length === 0) return;

    saveBtn.classList.add('saving');
    saveBtn.querySelector('span').textContent = 'Saving...';
    saveBtn.disabled = true;

    try {
        const response = await fetch('/api/batch-update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ changes: changeQueue })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message || 'Save failed');
        }

        const result = await response.json();
        console.log('Batch save successful:', result);

        // Success animation
        saveBtn.classList.remove('saving');
        saveBtn.classList.add('success');
        saveBtn.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>Saved!</span>
        `;

        // Clear queue
        changeQueue = [];
        window.onbeforeunload = null;

        // Reset button after delay
        setTimeout(() => {
            updateSaveButton(); // Will hide it since queue is empty
            saveBtn.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                    <polyline points="17 21 17 13 7 13 7 21"></polyline>
                    <polyline points="7 3 7 8 15 8"></polyline>
                </svg>
                <span>Save Changes</span>
            `;
            saveBtn.classList.remove('success');
            saveBtn.disabled = false;
        }, 2000);

    } catch (error) {
        console.error('Save failed:', error);
        alert(`Failed to save changes: ${error.message}`);
        saveBtn.classList.remove('saving');
        saveBtn.querySelector('span').textContent = 'Retry Save';
        saveBtn.disabled = false;
    }
}

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
    // Initialize page from URL
    const urlParams = new URLSearchParams(window.location.search);
    const pageParam = parseInt(urlParams.get('page'));
    if (!isNaN(pageParam) && pageParam > 0) {
        currentPage = pageParam;
    }

    // Load data with pagination
    await loadData(currentPage, currentType);

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

// Cache for stats to improve performance
const statsCache = {};

// Store pagination metadata
let paginationMeta = {
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    hasNextPage: false,
    hasPrevPage: false
};

async function loadData(page = 1, type = 'movie') {
    try {
        // Fetch from serverless API with pagination and sort
        const apiUrl = `/api/movies?page=${page}&type=${type}&sort=${currentSort}`;
        const response = await fetch(apiUrl);

        if (response.ok) {
            const data = await response.json();
            watchedMovies = data.movies || [];
            paginationMeta = data.pagination || paginationMeta;
            console.log(`Loaded ${watchedMovies.length} movies for page ${page}`);
            return;
        } else {
            console.error('Failed to fetch from API:', response.statusText);
        }
    } catch (error) {
        console.warn('Failed to fetch from API:', error);
    }

    // Fallback: try local file (will load all, but better than nothing)
    try {
        const response = await fetch('./data/ass.json');
        if (response.ok) {
            const allMovies = await response.json();
            // Filter by type
            const filtered = allMovies.filter(item => {
                const itemType = item.media_type || (item.first_air_date ? 'tv' : 'movie');
                return itemType === type;
            });
            // Manually paginate
            const startIndex = (page - 1) * ITEMS_PER_PAGE;
            watchedMovies = filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE);
            paginationMeta = {
                currentPage: page,
                totalPages: Math.ceil(filtered.length / ITEMS_PER_PAGE),
                totalItems: filtered.length,
                hasNextPage: page < Math.ceil(filtered.length / ITEMS_PER_PAGE),
                hasPrevPage: page > 1
            };
            console.log('Loaded data from local file (fallback)');
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

async function enrichData(itemsToEnrich = []) {
    if (!itemsToEnrich || itemsToEnrich.length === 0) return;

    console.log(`Enriching ${itemsToEnrich.length} items...`);
    let updated = false;

    // Process items sequentially to avoid rate limits (429 errors)
    for (const item of itemsToEnrich) {
        // Check if we need to fetch details
        const isMovie = item.media_type === 'movie' || (!item.media_type && !item.first_air_date);
        const type = isMovie ? 'movie' : 'tv';

        const missingCountries = isMovie ? !item.production_countries : !item.origin_country;
        const missingCredits = isMovie ? !item.director : !item.creator;

        if (missingCountries || missingCredits) {
            try {
                const response = await fetch(`${BASE_URL}/${type}/${item.id}?api_key=${API_KEY}&append_to_response=credits`);

                if (response.status === 429) {
                    console.warn(`Rate limit hit for item ${item.id}. Skipping...`);
                    continue;
                }

                if (response.ok) {
                    const data = await response.json();

                    // Update our local item with the new details
                    if (isMovie) {
                        item.production_countries = data.production_countries;
                        item.director = extractDirector(data.credits);
                        delete item.credits;
                    } else {
                        item.origin_country = data.origin_country;
                        item.creator = extractCreator(data.created_by);
                        delete item.created_by;
                    }
                    updated = true;
                }
            } catch (e) {
                console.warn(`Failed to enrich item ${item.id}:`, e);
            }

            // Add a small delay between requests
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

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
        btn.addEventListener('click', async () => {
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
                // In public mode, reload data with new type
                currentPage = 1;
                await loadData(1, currentType);
                if (currentTab === 'stats') {
                    renderStats();
                } else {
                    updatePage(1);
                }
            }
        });
    });

    // Watched Button
    if (watchedBtn) {
        watchedBtn.addEventListener('click', () => {
            currentTab = 'watched';

            // Toggle active state
            watchedBtn.classList.add('active');
            if (statsBtn) statsBtn.classList.remove('active');

            updatePage(1);
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
        item.addEventListener('click', async () => {
            currentSort = item.dataset.sort;
            // Reload from server with new sort
            await loadData(currentPage, currentType);
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
        // Public: Search entire database via API
        if (!query) {
            currentTab = 'watched';
            currentPage = 1;
            await loadData(1, currentType);
            renderMovies();
            return;
        }

        try {
            const timestamp = new Date().getTime();
            const response = await fetch(`/api/movies?type=${currentType}&search=${encodeURIComponent(query)}&_t=${timestamp}`);
            const data = await response.json();

            if (response.ok) {
                searchResults = data.movies || [];
                currentTab = 'search';
                currentPage = 1;
                renderMovies();
            }
        } catch (error) {
            console.error('Search failed:', error);
        }
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

    // For admin search, list is already filtered by TMDB
    // For watched tab, list is already filtered by server
    // No need for client-side filtering when using server pagination

    if (list.length === 0) {
        moviesGrid.innerHTML = `<div class="empty-state"><p>No ${currentType === 'movie' ? 'movies' : 'TV shows'} found.</p></div>`;
        return;
    }

    // Render all items (server already sent only the page we need)
    list.forEach(item => {
        const card = createMovieCard(item);
        moviesGrid.appendChild(card);
    });

    console.log(`Rendering page ${paginationMeta.currentPage}: ${list.length} items`);

    // Only show pagination for watched tab (not for admin search results)
    if (currentTab === 'watched') {
        renderPagination(paginationMeta.totalPages, paginationMeta.totalItems);
    }
}

async function updatePage(newPage) {
    currentPage = newPage;

    // Update URL without reloading
    const url = new URL(window.location);
    url.searchParams.set('page', newPage);
    window.history.pushState({ page: newPage }, '', url);

    // Reload data from server for the new page (with current sort)
    await loadData(newPage, currentType);

    renderMovies();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderPagination(totalPages, totalItems) {
    if (totalPages <= 1 || !paginationContainer) return;

    const prevBtn = document.createElement('button');
    prevBtn.className = 'pagination-btn';
    prevBtn.textContent = '←';
    prevBtn.disabled = currentPage === 1;
    prevBtn.onclick = () => updatePage(currentPage - 1);

    const nextBtn = document.createElement('button');
    nextBtn.className = 'pagination-btn';
    nextBtn.textContent = '→';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.onclick = () => updatePage(currentPage + 1);

    const startItem = (currentPage - 1) * ITEMS_PER_PAGE + 1;
    const endItem = Math.min(currentPage * ITEMS_PER_PAGE, totalItems);

    const pageInfo = document.createElement('span');
    pageInfo.className = 'pagination-info';
    pageInfo.style.alignSelf = 'center';
    pageInfo.style.color = 'var(--text-secondary)';
    pageInfo.style.fontSize = '14px';
    pageInfo.textContent = `${startItem}-${endItem} of ${totalItems}`;

    paginationContainer.appendChild(prevBtn);
    paginationContainer.appendChild(pageInfo);
    paginationContainer.appendChild(nextBtn);
}

// Handle browser back/forward buttons
window.addEventListener('popstate', (event) => {
    const urlParams = new URLSearchParams(window.location.search);
    const pageParam = parseInt(urlParams.get('page')) || 1;
    currentPage = pageParam;
    renderMovies();
});

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

            // Always show rating/review in admin mode (use pending edits if not yet added)
            const pending = pendingEdits[id] || {};
            const displayRating = isWatched ? userRating : (pending.rating || 0);
            const displayReview = isWatched ? userReview : (pending.review || '');

            reviewHtml = `
                <div class="panel-section fade-in">
                    <h3>Rating</h3>
                    <div class="panel-rating">
                        ${renderStarRating(id, displayRating, true)}
                    </div>
                </div>
                <div class="panel-section fade-in">
                    <h3>Review</h3>
                    <textarea class="review-input" id="review-input" placeholder="Write your review here...">${displayReview}</textarea>
                    <div class="save-status" id="save-status"></div>
                </div>
            `;
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


        // Set up review input listener for admin mode
        if (isAdmin) {
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
let isTogglingWatched = false;

window.toggleWatched = async function (id) {
    if (!isAdmin || isTogglingWatched) return;

    isTogglingWatched = true;

    const index = watchedMovies.findIndex(m => m.id === id);

    if (index === -1) {
        // Add Movie
        const item = searchResults.find(m => m.id === id);
        if (item) {
            // Get any pending rating/review/poster from the panel
            const pending = pendingEdits[id] || {};

            const newMovie = {
                ...item,
                media_type: currentType,
                rating: pending.rating || 0,
                review: pending.review || '',
                poster_path: pending.poster_path || item.poster_path,
                dateWatched: new Date().toISOString()
            };

            // Clear pending edits
            delete pendingEdits[id];

            // Optimistic update
            watchedMovies.push(newMovie);
            renderMovies();
            if (currentMovieId === id) openMoviePanel(id);

            // Queue Change
            changeQueue.push({ type: 'add', data: newMovie });
            updateSaveButton();
            console.log('Queued add:', newMovie.title);
        }
    } else {
        // Remove Movie
        const idToDelete = watchedMovies[index].id;
        const movieTitle = watchedMovies[index].title || watchedMovies[index].name;

        // Optimistic update
        watchedMovies.splice(index, 1);
        renderMovies();
        if (currentMovieId === id) openMoviePanel(id);

        // Queue Change
        changeQueue.push({ type: 'delete', id: idToDelete });
        updateSaveButton();
        console.log('Queued delete:', movieTitle);
    }

    // Small delay to prevent double-clicks
    setTimeout(() => { isTogglingWatched = false; }, 300);
};

window.rateMovie = async function (id, rating) {
    if (!isAdmin) return;
    const index = watchedMovies.findIndex(m => m.id === id);

    // Optimistic Update
    if (index !== -1) {
        watchedMovies[index].rating = rating;
        openMoviePanel(id);

        // Queue Change
        changeQueue.push({ type: 'update', id, updates: { rating } });
        updateSaveButton();
        console.log('Queued rating update');
    } else {
        // Movie not yet added - store in pending edits
        if (!pendingEdits[id]) pendingEdits[id] = {};
        pendingEdits[id].rating = rating;
        openMoviePanel(id);
        console.log('Stored pending rating');
    }
};

async function saveReview(id, text) {
    if (!isAdmin) return;
    const index = watchedMovies.findIndex(m => m.id === id);
    if (index !== -1) {
        // Optimistic Update
        watchedMovies[index].review = text;

        // Show saving status
        const status = document.getElementById('save-status');
        if (status) {
            status.textContent = 'Pending save...';
            status.style.color = '#ff9800'; // Orange for pending
        }

        // Queue Change
        changeQueue.push({ type: 'update', id, updates: { review: text } });
        updateSaveButton();
        console.log('Queued review update');

    } else {
        // Movie not yet added - store in pending edits
        if (!pendingEdits[id]) pendingEdits[id] = {};
        pendingEdits[id].review = text;
        const status = document.getElementById('save-status');
        if (status) {
            status.textContent = 'Will save when you add this to library';
            setTimeout(() => status.textContent = '', 2000);
        }
    }
}

window.selectPoster = async function (id, posterPath) {
    if (!isAdmin) return;

    const index = watchedMovies.findIndex(m => m.id === id);
    if (index !== -1) {
        // Optimistic Update
        watchedMovies[index].poster_path = posterPath;

        // Update the main poster image
        const currentPoster = document.getElementById('current-poster');
        if (currentPoster) {
            currentPoster.src = `${IMAGE_BASE_URL}${posterPath}`;
        }

        // Update selected state
        document.querySelectorAll('.poster-option').forEach(img => {
            img.classList.remove('selected');
        });
        const target = event.target;
        if (target) target.classList.add('selected');

        // Queue Change
        changeQueue.push({ type: 'update', id, updates: { poster_path: posterPath } });
        updateSaveButton();
        console.log('Queued poster update');

    } else {
        // Movie not yet added - store in pending edits
        if (!pendingEdits[id]) pendingEdits[id] = {};
        pendingEdits[id].poster_path = posterPath;

        // Update the main poster image
        const currentPoster = document.getElementById('current-poster');
        if (currentPoster) {
            currentPoster.src = `${IMAGE_BASE_URL}${posterPath}`;
        }

        // Update selected state
        document.querySelectorAll('.poster-option').forEach(img => {
            img.classList.remove('selected');
        });
        const target = event.target;
        if (target) target.classList.add('selected');
    }
};

async function exportData() {
    try {
        const response = await fetch('/api/save-movies', {
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
    const countryMap = {
        'United States of America': 'USA',
        'United Kingdom': 'UK',
        'US': 'USA',
        'GB': 'UK',
        'JP': 'Japan',
        'KR': 'South Korea',
        'CN': 'China',
        'FR': 'France',
        'DE': 'Germany',
        'CA': 'Canada',
        'AU': 'Australia',
        'IT': 'Italy',
        'ES': 'Spain',
        'IN': 'India'
    };
    return countryMap[name] || name;
}

async function renderStats() {
    moviesGrid.innerHTML = '';
    if (paginationContainer) paginationContainer.innerHTML = '';

    // Show loading state
    moviesGrid.innerHTML = `<div class="empty-state"><p>Loading stats...</p></div>`;

    try {
        let stats;

        // Check cache first
        if (statsCache[currentType]) {
            stats = statsCache[currentType];
        } else {
            // Fetch stats from API
            const response = await fetch(`/api/stats?type=${currentType}`);

            if (!response.ok) {
                throw new Error('Failed to fetch stats');
            }

            stats = await response.json();
            // Cache the result
            statsCache[currentType] = stats;
        }

        const personLabel = currentType === 'movie' ? 'Directors' : 'Creators';

        // Check if data seems incomplete
        const dataCompleteness = (stats.totalDirectors / stats.totalWatched) * 100;
        const showWarning = dataCompleteness < 50; // If less than 50% have director data

        // --- Render HTML ---
        const statsHtml = `
            <div class="stats-container fade-in">
                ${showWarning ? `
                    <div class="empty-state" style="background: rgba(255, 193, 7, 0.1); border: 1px solid rgba(255, 193, 7, 0.3); margin-bottom: 2rem;">
                        <p style="color: #ffc107; margin: 0;">
                            ⚠️ Director and country data is incomplete. Only movies with enriched metadata are counted in the statistics below.
                        </p>
                    </div>
                ` : ''}
                <div class="stats-overview">
                    <div class="stat-card">
                        <div class="stat-number">${stats.totalWatched}</div>
                        <div class="stat-label">${currentType === 'movie' ? 'Films' : 'Shows'} Watched</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${stats.totalCountries}</div>
                        <div class="stat-label">Countries</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${stats.totalDirectors}</div>
                        <div class="stat-label">${personLabel}</div>
                    </div>
                </div>

                <div class="stats-lists">
                    <div class="list-section">
                        <h3>Top 10 Countries</h3>
                        ${renderBarChart(stats.topCountries.map(c => [getCountryName(c.name), c.count]), stats.totalWatched)}
                    </div>
                    <div class="list-section">
                        <h3>Top 10 ${personLabel}</h3>
                        ${renderBarChart(stats.topDirectors.map(d => [d.name, d.count]), stats.totalWatched)}
                    </div>
                </div>
            </div>
        `;

        moviesGrid.innerHTML = statsHtml;

    } catch (error) {
        console.error('Error loading stats:', error);
        moviesGrid.innerHTML = `<div class="empty-state"><p>Failed to load stats. Please try again.</p></div>`;
    }
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
        const countText = `${count} ${currentType === 'movie' ? 'films' : 'shows'}`;

        return `
            <li class="list-item">
                <div class="list-label" title="${label}">${label}</div>
                <div class="bar-container" data-tooltip="${countText}">
                    <div class="bar" style="width: ${percentage}%"></div>
                </div>
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

