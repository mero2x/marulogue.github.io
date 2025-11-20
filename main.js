// import { galleryItems } from './data.js'; // Deprecated

const ITEMS_PER_PAGE = 6;
let currentPage = 1;
let galleryItems = [];

document.addEventListener('DOMContentLoaded', async () => {
  await fetchPosts();

  const urlParams = new URLSearchParams(window.location.search);
  const postId = urlParams.get('id');
  const page = urlParams.get('page');

  if (page) {
    currentPage = parseInt(page);
  }

  if (postId) {
    renderPost(postId);
  } else {
    renderGallery();
  }

  setupNavigation();
});

async function fetchPosts() {
  try {
    // In a real Netlify CMS setup without a build step, we might need to fetch individual JSON files
    // or use a script to combine them. For this "no-build" setup to work immediately with the CMS,
    // we'll simulate the fetch by looking for a data.json if it exists, otherwise fallback to empty.
    // NOTE: Since we can't easily list files in client-side JS without a server index, 
    // the standard way with Netlify CMS + Static Site is to use a build tool (like Hugo/Jekyll) 
    // OR a script that runs before deploy to combine content.

    // For this specific user request of "no build tools", we will assume there is a 
    // pre-generated 'content/posts.json' or similar that the CMS updates, 
    // OR we can keep using data.js but let the CMS edit IT directly (if configured to do so).

    // However, Decap CMS usually works with collections of files. 
    // To make this work seamlessly without a build step, we'll try to fetch a master 'posts.json'
    // which would ideally be generated. 

    // FOR NOW: To keep it working while the user sets up Netlify, we will fallback to the 
    // hardcoded data if the fetch fails, but structure it to support the fetch.

    const response = await fetch('/content/posts.json');
    if (response.ok) {
      galleryItems = await response.json();
    } else {
      // Fallback to the data from data.js if we can't fetch (for local dev without the CMS setup yet)
      const { galleryItems: staticItems } = await import('./data.js');
      galleryItems = staticItems;
    }
  } catch (error) {
    console.log('Using static data fallback');
    const { galleryItems: staticItems } = await import('./data.js');
    galleryItems = staticItems;
  }
}

function renderGallery() {
  const grid = document.getElementById('gallery-grid');
  if (!grid) return;

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const itemsToShow = galleryItems.slice(startIndex, endIndex);
  const totalPages = Math.ceil(galleryItems.length / ITEMS_PER_PAGE);

  grid.innerHTML = itemsToShow.map(item => {
    let thumbnail = item.url || item.image;
    let typeIcon = '';

    if (item.type === 'video') {
      typeIcon = '<div class="type-icon">▶</div>';
      // Use a placeholder or the video thumbnail if available
      if (!thumbnail && item.videoUrl) {
        // Try to get YouTube thumbnail
        const ytMatch = item.videoUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
        if (ytMatch) {
          thumbnail = `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`;
        }
      }
    } else if (item.type === 'text') {
      typeIcon = '<div class="type-icon">T</div>';
      // Text posts might not have an image, so we show a preview of the text or a placeholder
      if (!thumbnail) {
        return `
        <article class="gallery-item text-post fade-in" onclick="window.location.href='?id=${item.id}'" style="cursor: pointer;">
          <div class="text-preview">
            <h2>${item.title}</h2>
            <p>${item.body ? item.body.substring(0, 100) + '...' : ''}</p>
            <div class="overlay">
              <span class="view-label">Read</span>
            </div>
          </div>
          <div class="item-info">
            <p class="date">${formatDate(item.date)}</p>
          </div>
        </article>`;
      }
    }

    return `
    <article class="gallery-item fade-in" onclick="window.location.href='?id=${item.id}'" style="cursor: pointer;">
      <div class="image-container">
        <img src="${thumbnail}" alt="${item.title}" loading="lazy" />
        ${typeIcon}
        <div class="overlay">
          <span class="view-label">View</span>
        </div>
      </div>
      <div class="item-info">
        <p class="date">${formatDate(item.date)}</p>
      </div>
    </article>
  `}).join('');

  // Add pagination controls
  const mainContent = document.querySelector('.main-content');
  let paginationHTML = '<div class="pagination">';

  if (currentPage > 1) {
    paginationHTML += `<button class="pagination-btn" onclick="window.location.href='?page=${currentPage - 1}'" aria-label="Previous Page">←</button>`;
  }

  if (currentPage < totalPages) {
    paginationHTML += `<button class="pagination-btn" onclick="window.location.href='?page=${currentPage + 1}'" aria-label="Next Page">→</button>`;
  }

  paginationHTML += '</div>';

  // Remove old pagination if exists
  const oldPagination = mainContent.querySelector('.pagination');
  if (oldPagination) {
    oldPagination.remove();
  }

  mainContent.insertAdjacentHTML('beforeend', paginationHTML);
}

function renderPost(id) {
  const item = galleryItems.find(i => i.id == id);
  const mainContent = document.querySelector('.main-content');

  if (!item) {
    mainContent.innerHTML = '<p>Post not found.</p>';
    return;
  }

  // Update page title
  document.title = `${item.title} - Visual Journal`;

  let mediaContent = '';
  if (item.type === 'video' && item.videoUrl) {
    const ytMatch = item.videoUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
    if (ytMatch) {
      mediaContent = `<div class="video-container"><iframe width="100%" height="500" src="https://www.youtube.com/embed/${ytMatch[1]}" frameborder="0" allowfullscreen></iframe></div>`;
    } else {
      mediaContent = `<div class="video-container"><a href="${item.videoUrl}" target="_blank">Watch Video</a></div>`;
    }
  } else if (item.url || item.image) {
    mediaContent = `<div class="post-image"><img src="${item.url || item.image}" alt="${item.title}" /></div>`;
  }

  mainContent.innerHTML = `
    <article class="post-detail fade-in">
      <button class="close-btn" onclick="window.location.href='/'" aria-label="Close">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
      <div class="post-header">
        <h1>${item.title}</h1>
        <p class="post-meta">${item.category} • ${formatDate(item.date)}</p>
      </div>
      ${mediaContent}
      <div class="post-content">
        ${item.body ? `<p>${item.body}</p>` : ''}
        <p>This is a placeholder for the journal entry text. In a real implementation, you could add a 'description' field to your data.js file and display it here.</p>
      </div>
    </article>
  `;
}

function formatDate(dateString) {
  // Handle both DD/MM/YYYY and ISO dates from CMS
  if (!dateString) return '';
  if (dateString.includes('/')) return dateString;
  try {
    const date = new Date(dateString);
    return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
  } catch (e) {
    return dateString;
  }
}

function setupNavigation() {
  const menuToggle = document.querySelector('.menu-toggle');
  const navLinks = document.querySelector('.nav-links');

  if (menuToggle && navLinks) {
    menuToggle.addEventListener('click', () => {
      const isExpanded = menuToggle.getAttribute('aria-expanded') === 'true';
      menuToggle.setAttribute('aria-expanded', !isExpanded);
      navLinks.classList.toggle('active');

      // Animate hamburger
      menuToggle.classList.toggle('open');
    });
  }
}
