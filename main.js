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
  await applyTheme();
});

async function applyTheme() {
  try {
    const response = await fetch('/theme.json');
    if (response.ok) {
      const theme = await response.json();
      const root = document.documentElement;

      if (theme.bgColor) root.style.setProperty('--bg-color', theme.bgColor);
      if (theme.textColor) root.style.setProperty('--text-color', theme.textColor);
      if (theme.accentColor) root.style.setProperty('--accent-color', theme.accentColor);

      if (theme.font) {
        root.style.setProperty('--font-main', `"${theme.font}", sans-serif`);
        // Dynamically load font if not already loaded (simplified for common Google Fonts)
        const fontLink = document.createElement('link');
        fontLink.href = `https://fonts.googleapis.com/css2?family=${theme.font.replace(' ', '+')}:wght@300;400;500;600&display=swap`;
        fontLink.rel = 'stylesheet';
        document.head.appendChild(fontLink);
      }

      if (theme.sidebarPosition === 'right') {
        document.body.classList.add('sidebar-right');
        // Add CSS for right sidebar dynamically or use a class in style.css
        const style = document.createElement('style');
        style.textContent = `
          .sidebar-right .site-header { left: auto; right: 0; border-right: none; border-left: 1px solid var(--accent-color); }
          .sidebar-right .main-content { margin-left: 0; margin-right: var(--sidebar-width); }
          .sidebar-right .site-footer { margin-left: 0; margin-right: var(--sidebar-width); }
          @media (max-width: 768px) {
            .sidebar-right .site-header { left: 0; right: auto; }
            .sidebar-right .main-content { margin-right: 0; }
            .sidebar-right .site-footer { margin-right: 0; }
          }
        `;
        document.head.appendChild(style);
      }

      if (theme.customCss) {
        const style = document.createElement('style');
        style.textContent = theme.customCss;
        document.head.appendChild(style);
      }
    }
  } catch (e) {
    console.error('Error applying theme:', e);
  }
}

async function fetchPosts() {
  try {
    const response = await fetch('/posts.json');
    if (response.ok) {
      galleryItems = await response.json();
    } else {
      console.error('Failed to load posts:', response.status);
      galleryItems = [];
    }
  } catch (error) {
    console.error('Error fetching posts:', error);
    galleryItems = [];
  }
}

function renderGallery() {
  const grid = document.getElementById('gallery-grid');
  if (!grid) return;

  if (galleryItems.length === 0) {
    grid.innerHTML = '<p class="no-posts">No posts found. Create one in the admin panel!</p>';
    return;
  }

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const itemsToShow = galleryItems.slice(startIndex, endIndex);
  const totalPages = Math.ceil(galleryItems.length / ITEMS_PER_PAGE);

  grid.innerHTML = itemsToShow.map(item => {
    let thumbnail = item.url || item.image;
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
      typeIcon = '<div class="type-icon">T</div>';
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

function renderPost(id) {
  const item = galleryItems.find(i => i.id == id);
  const mainContent = document.querySelector('.main-content');

  if (!item) {
    mainContent.innerHTML = '<p>Post not found.</p>';
    return;
  }

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
        <p class="post-meta">${item.category || 'Journal'} • ${formatDate(item.date)}</p>
      </div>
      ${mediaContent}
      <div class="post-content">
        ${item.body ? `<p>${item.body.replace(/\n/g, '<br>')}</p>` : ''}
      </div>
    </article>
  `;
}

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
