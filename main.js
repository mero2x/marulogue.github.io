const ITEMS_PER_PAGE = 4;
let currentPage = 1;
let galleryItems = [];

// Contentful Configuration
const SPACE_ID = '6bzr8twttvj3';
const ACCESS_TOKEN = 'rGPH1BHm2FXXDtm0XkF05sMSo9idGXJOO6QHXqsoqig';

let client;

try {
  if (window.contentful) {
    client = window.contentful.createClient({
      space: SPACE_ID,
      accessToken: ACCESS_TOKEN
    });
  }
} catch (e) {
  console.error('Error initializing Contentful client:', e);
}

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

// Data Mapping Function
function mapContentfulPost(entry) {
  const fields = entry.fields;
  const sys = entry.sys;

  return {
    id: sys.id,
    title: fields.title || 'Untitled',
    date: sys.createdAt,
    type: fields.type || 'text', // Default to text, can be expanded
    category: fields.category || 'Uncategorized',
    body: fields.body || '', // Keep as object for Rich Text, string for others
    images: fields.images ? fields.images.map(img => img.fields.file.url) : [],
    image: fields.image ? fields.image.fields.file.url : null
  };
}

async function fetchPosts() {
  try {
    // 1. Fetch Local Posts
    let localPosts = [];
    try {
      const localResponse = await fetch('./posts.json');
      if (localResponse.ok) {
        localPosts = await localResponse.json();
      }
    } catch (e) {
      console.warn('Could not load local posts:', e);
    }

    // 2. Fetch Contentful Posts
    let contentfulPosts = [];
    if (client) {
      try {
        const response = await client.getEntries({
          content_type: 'post', // Assuming 'post' is the content type ID
          order: '-sys.createdAt'
        });
        contentfulPosts = response.items.map(mapContentfulPost);
      } catch (err) {
        console.warn('Failed to fetch from Contentful:', err);
      }
    }

    // 3. Merge Posts (Contentful first)
    galleryItems = [...contentfulPosts, ...localPosts];

    // Sort by date (newest first)
    galleryItems.sort((a, b) => new Date(b.date) - new Date(a.date));

  } catch (error) {
    console.error('Error loading posts:', error);
    galleryItems = [];
  }
}

function renderGallery() {
  const grid = document.getElementById('gallery-grid');
  if (!grid) return;

  if (galleryItems.length === 0) {
    grid.innerHTML = '<p class="no-posts">No posts found.</p>';
    return;
  }

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const itemsToShow = galleryItems.slice(startIndex, endIndex);
  const totalPages = Math.ceil(galleryItems.length / ITEMS_PER_PAGE);

  grid.innerHTML = itemsToShow.map(item => {
    let thumbnail = item.url || item.image;

    // Use first image from images array if no main image
    if (!thumbnail && item.images && item.images.length > 0) {
      thumbnail = item.images[0];
    }

    let typeIcon = '';

    if (item.type === 'video') {
      typeIcon = '<div class="type-icon">▶</div>';
      if (!thumbnail && item.videoUrl) {
        const ytMatch = item.videoUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
        if (ytMatch) {
          thumbnail = `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`;
        }
      }
    } else if (item.type === 'text') {
      if (!thumbnail) {
        return `
        <article class="gallery-item text-post fade-in" onclick="window.location.href='?id=${item.id}'" style="cursor: pointer;">
          <div class="text-preview">
            <h2>${item.title}</h2>
            <span class="read-more">read more</span>
          </div>
          <div class="item-info">
            <p class="date">${formatDate(item.date)}</p>
          </div>
        </article>`;
      }
    } else if (item.type === 'photoset' || (item.images && item.images.length > 0)) {
      // Render carousel for photosets in gallery
      const slides = item.images.map((img, index) => `
        <div class="carousel-slide ${index === 0 ? 'active' : ''}">
          <img src="${img}" alt="${item.title} ${index + 1}">
        </div>
      `).join('');

      const dots = item.images.map((_, index) => `
        <div class="dot ${index === 0 ? 'active' : ''}" onclick="event.stopPropagation(); setSlideFor('${item.id}', ${index})"></div>
      `).join('');

      return `
      <article class="gallery-item fade-in" onclick="window.location.href='?id=${item.id}'" style="cursor: pointer;">
        <div class="image-container">
          <div class="carousel-container" id="carousel-${item.id}">
            ${slides}
            <button class="carousel-btn prev" onclick="event.stopPropagation(); moveSlideFor('${item.id}', -1)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </button>
            <button class="carousel-btn next" onclick="event.stopPropagation(); moveSlideFor('${item.id}', 1)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
            <div class="carousel-dots">
              ${dots}
            </div>
          </div>
        </div>
        <div class="item-info">
          <p class="date">${formatDate(item.date)}</p>
        </div>
      </article>`;
    }

    return `
    <article class="gallery-item fade-in" onclick="window.location.href='?id=${item.id}'" style="cursor: pointer;">
      <div class="image-container">
        <img src="${thumbnail}" alt="${item.title}" loading="lazy" />
      </div>
      <div class="item-info">
        <p class="date">${formatDate(item.date)}</p>
      </div>
    </article>
  `}).join('');

  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  const mainContent = document.querySelector('.main-content');
  const oldPagination = mainContent.querySelector('.pagination');
  if (oldPagination) oldPagination.remove();

  if (totalPages <= 1) return;

  let paginationHTML = '<div class="pagination">';

  if (currentPage > 1) {
    paginationHTML += `<button class="pagination-btn" onclick="window.location.href='?page=${currentPage - 1}'" aria-label="Previous Page">←</button>`;
  }

  if (currentPage < totalPages) {
    paginationHTML += `<button class="pagination-btn" onclick="window.location.href='?page=${currentPage + 1}'" aria-label="Next Page">→</button>`;
  }

  paginationHTML += '</div>';
  mainContent.insertAdjacentHTML('beforeend', paginationHTML);
}

let currentSlideIndex = 0;

function renderPost(id) {
  const item = galleryItems.find(i => i.id == id);
  const mainContent = document.querySelector('.main-content');

  if (!item) {
    mainContent.innerHTML = '<p>Post not found.</p>';
    return;
  }

  document.title = `${item.title} - 丸`;

  let mediaContent = '';

  if (item.images && item.images.length > 0) {
    // Dynamic Photoset Grid Layout
    const photoCount = item.images.length;
    let gridClass = `photoset-grid count-${photoCount}`;

    const photoElements = item.images.map((img, index) => `
      <div class="photoset-item" onclick="openLightbox(${index})">
        <img src="${img}" alt="${item.title} ${index + 1}" loading="lazy">
      </div>
    `).join('');

    mediaContent = `
      <div class="post-image">
        <div class="${gridClass}" data-photos='${JSON.stringify(item.images)}'>
          ${photoElements}
        </div>
      </div>
    `;
  } else if (item.type === 'video' && item.videoUrl) {
    const ytMatch = item.videoUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
    if (ytMatch) {
      mediaContent = `<div class="video-container"><iframe width="100%" height="500" src="https://www.youtube.com/embed/${ytMatch[1]}" frameborder="0" allowfullscreen></iframe></div>`;
    } else {
      mediaContent = `<div class="video-container"><a href="${item.videoUrl}" target="_blank">Watch Video</a></div>`;
    }
  } else if (item.url || item.image) {
    mediaContent = `<div class="post-image"><img src="${item.url || item.image}" alt="${item.title}" /></div>`;
  }

  // Render Body Content (Rich Text or String)
  let bodyContent = '';
  if (item.body) {
    if (typeof item.body === 'object' && window.contentfulRichText) {
      // Contentful Rich Text
      bodyContent = window.contentfulRichText.documentToHtmlString(item.body);
    } else if (typeof item.body === 'string') {
      // Plain Text / Markdown (Local)
      bodyContent = `<p>${item.body.replace(/\n/g, '<br>')}</p>`;
    }
  }

  mainContent.innerHTML = `
    <article class="post-detail fade-in">
      <button class="close-btn" onclick="window.location.href='/'" aria-label="Close">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
      <div class="post-card">
        <div class="post-header">
          <h1>${item.title}</h1>
        </div>
        ${mediaContent}
        <div class="post-content">
          ${bodyContent}
        </div>
        <div class="post-footer">
          <span class="post-tag">${item.category || 'Photography'}</span>
          <span class="post-timestamp">${formatDate(item.date)}</span>
        </div>
      </div>
    </article>
  `;
}

window.moveSlide = function (direction) {
  const slides = document.querySelectorAll('.carousel-slide');
  const dots = document.querySelectorAll('.dot');
  if (!slides.length) return;

  slides[currentSlideIndex].classList.remove('active');
  dots[currentSlideIndex].classList.remove('active');

  currentSlideIndex = (currentSlideIndex + direction + slides.length) % slides.length;

  slides[currentSlideIndex].classList.add('active');
  dots[currentSlideIndex].classList.add('active');
};

window.setSlide = function (index) {
  const slides = document.querySelectorAll('.carousel-slide');
  const dots = document.querySelectorAll('.dot');
  if (!slides.length) return;

  slides[currentSlideIndex].classList.remove('active');
  dots[currentSlideIndex].classList.remove('active');

  currentSlideIndex = index;

  slides[currentSlideIndex].classList.add('active');
  dots[currentSlideIndex].classList.add('active');
};

// Gallery carousel functions (for individual photosets)
window.moveSlideFor = function (carouselId, direction) {
  const carousel = document.getElementById(`carousel-${carouselId}`);
  if (!carousel) return;

  const slides = carousel.querySelectorAll('.carousel-slide');
  const dots = carousel.querySelectorAll('.dot');
  if (!slides.length) return;

  let currentIndex = Array.from(slides).findIndex(slide => slide.classList.contains('active'));
  if (currentIndex === -1) currentIndex = 0;

  slides[currentIndex].classList.remove('active');
  dots[currentIndex].classList.remove('active');

  currentIndex = (currentIndex + direction + slides.length) % slides.length;

  slides[currentIndex].classList.add('active');
  dots[currentIndex].classList.add('active');
};

window.setSlideFor = function (carouselId, index) {
  const carousel = document.getElementById(`carousel-${carouselId}`);
  if (!carousel) return;

  const slides = carousel.querySelectorAll('.carousel-slide');
  const dots = carousel.querySelectorAll('.dot');
  if (!slides.length) return;

  const currentIndex = Array.from(slides).findIndex(slide => slide.classList.contains('active'));
  if (currentIndex !== -1) {
    slides[currentIndex].classList.remove('active');
    dots[currentIndex].classList.remove('active');
  }

  slides[index].classList.add('active');
  dots[index].classList.add('active');
};

function formatDate(dateString) {
  if (!dateString) return '';
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
      menuToggle.classList.toggle('open');
    });
  }
}

// Lightbox functionality for photoset grid
let currentLightboxIndex = 0;
let lightboxImages = [];

window.openLightbox = function (index) {
  const photosetGrid = document.querySelector('.photoset-grid');
  if (!photosetGrid) return;

  lightboxImages = JSON.parse(photosetGrid.dataset.photos);
  currentLightboxIndex = index;

  const lightboxHTML = `
    <div class="lightbox active" id="lightbox" onclick="closeLightboxOnOutsideClick(event)">
      <button class="lightbox-close" onclick="closeLightbox()" aria-label="Close">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
      <button class="lightbox-nav prev" onclick="navigateLightbox(-1)" aria-label="Previous">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </button>
      <button class="lightbox-nav next" onclick="navigateLightbox(1)" aria-label="Next">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      </button>
      <div class="lightbox-content">
        <img id="lightbox-image" src="${lightboxImages[index]}" alt="Photo ${index + 1}">
      </div>
      <div class="lightbox-counter">${index + 1} / ${lightboxImages.length}</div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', lightboxHTML);
  document.body.style.overflow = 'hidden';
  document.addEventListener('keydown', handleLightboxKeyboard);
};

window.closeLightbox = function () {
  const lightbox = document.getElementById('lightbox');
  if (lightbox) {
    lightbox.remove();
    document.body.style.overflow = '';
    document.removeEventListener('keydown', handleLightboxKeyboard);
  }
};

window.closeLightboxOnOutsideClick = function (event) {
  if (event.target.id === 'lightbox') {
    closeLightbox();
  }
};

window.navigateLightbox = function (direction) {
  currentLightboxIndex = (currentLightboxIndex + direction + lightboxImages.length) % lightboxImages.length;
  const img = document.getElementById('lightbox-image');
  const counter = document.querySelector('.lightbox-counter');

  if (img) {
    img.src = lightboxImages[currentLightboxIndex];
    img.alt = `Photo ${currentLightboxIndex + 1}`;
  }
  if (counter) {
    counter.textContent = `${currentLightboxIndex + 1} / ${lightboxImages.length}`;
  }
};

function handleLightboxKeyboard(event) {
  if (event.key === 'Escape') {
    closeLightbox();
  } else if (event.key === 'ArrowLeft') {
    navigateLightbox(-1);
  } else if (event.key === 'ArrowRight') {
    navigateLightbox(1);
  }
}
