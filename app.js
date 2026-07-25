const BASE_VIDEO_URL = "https://nxplayer.com";
const TOTAL_FILES = 7;

// Exact record counts per file
const FILE_COUNTS = [44540, 44881, 45671, 48703, 50843, 51964, 8891];

// Pre-compute starting serial number offsets for each file
const FILE_OFFSETS = [1];
for (let i = 0; i < FILE_COUNTS.length - 1; i++) {
    FILE_OFFSETS.push(FILE_OFFSETS[i] + FILE_COUNTS[i]);
}

let currentFile = 1;
let loading = false;
let observer;

// Data Storage
let loadedVideos = []; // Array of { ...video, globalIndex }
let searchTimeout = null;

// DOM Elements
const gallery = document.getElementById("gallery");
const loadingDiv = document.getElementById("loading");
const fileSelect = document.getElementById("fileSelect");
const searchInput = document.getElementById("searchInput");

// Initialize Dropdown Options
function initDropdown() {
    for (let i = 1; i <= TOTAL_FILES; i++) {
        const option = document.createElement("option");
        option.value = i;
        option.textContent = `File ${i} (${FILE_COUNTS[i - 1].toLocaleString()} videos)`;
        fileSelect.appendChild(option);
    }

    fileSelect.addEventListener("change", handleFileSelect);
    searchInput.addEventListener("input", handleSearchInput);
}

// Load JSON File
async function loadFile(fileNumber, append = true) {
    if (fileNumber > TOTAL_FILES || loading) return;

    loading = true;
    loadingDiv.innerHTML = `<div class="spinner-border text-light"></div> <div class="mt-2">Loading batch ${fileNumber}...</div>`;

    if (!append) {
        gallery.innerHTML = "";
        loadedVideos = [];
    }

    const fileName = `data/videos_${String(fileNumber).padStart(5, '0')}.json`;
    console.log("Loading", fileName);

    try {
        const response = await fetch(fileName);
        const data = await response.json();

        // Attach global serial number to each video item
        const startingIndex = FILE_OFFSETS[fileNumber - 1];
        const indexedData = data.map((item, idx) => ({
            ...item,
            globalIndex: startingIndex + idx
        }));

        if (append) {
            loadedVideos = loadedVideos.concat(indexedData);
        } else {
            loadedVideos = indexedData;
        }

        applyFilterAndRender();
    } catch (error) {
        console.error("Failed to load file:", error);
        loadingDiv.innerHTML = `<h5 class="text-danger">Error loading file ${fileNumber}</h5>`;
    }

    loading = false;
    currentFile = fileNumber + 1;

    if (fileSelect.value === "all" && currentFile <= TOTAL_FILES) {
        loadingDiv.innerHTML = `<div class="spinner-border text-light"></div>`;
    } else {
        loadingDiv.innerHTML = "<h4>Finished Loading</h4>";
    }
}

// Render cards in chunks to keep mobile UI fluid
function renderCardsInChunks(videosToRender) {
    gallery.innerHTML = "";

    if (videosToRender.length === 0) {
        loadingDiv.innerHTML = "<h5>No videos found matching your search.</h5>";
        return;
    }

    const CHUNK_SIZE = 200; // Batch size to prevent UI freeze
    let index = 0;

    function renderNextChunk() {
        const fragment = document.createDocumentFragment();
        const limit = Math.min(index + CHUNK_SIZE, videosToRender.length);

        for (; index < limit; index++) {
            const video = videosToRender[index];
            const col = document.createElement("div");

            // col-6 sets 2 cards per row on mobile screens (<576px)
            col.className = "col-6 col-sm-6 col-md-4 col-lg-3 col-xl-2";

            col.innerHTML = `
        <div class="card shadow bg-secondary text-white position-relative h-100">
          <!-- Serial Number Badge -->
          <span class="position-absolute top-0 start-0 badge bg-danger m-1 m-sm-2 shadow-sm" style="z-index: 10; font-size: 0.75rem;">
            #${video.globalIndex.toLocaleString()}
          </span>

          <a href="${BASE_VIDEO_URL}${video.url}" target="_blank">
            <img
              loading="lazy"
              src="${video.preview_image}"
              class="card-img-top"
              alt="${video.title || 'Video'}">
          </a>
          
          <div class="card-body p-2 d-flex flex-column justify-content-between">
            <h6 class="card-title m-0" style="font-size: 0.85rem; line-height: 1.2;">
              <a href="${BASE_VIDEO_URL}${video.url}" target="_blank" class="text-white text-decoration-none">
                ${video.title || 'Untitled Video'}
              </a>
            </h6>
          </div>
        </div>
      `;

            fragment.appendChild(col);
        }

        gallery.appendChild(fragment);

        if (index < videosToRender.length) {
            requestAnimationFrame(renderNextChunk);
        }
    }

    renderNextChunk();
}

// Filter loaded videos based on search keyword
function applyFilterAndRender() {
    const query = searchInput.value.trim().toLowerCase();

    let filtered = loadedVideos;
    if (query) {
        filtered = loadedVideos.filter(video =>
            video.title && video.title.toLowerCase().includes(query)
        );
    }

    renderCardsInChunks(filtered);
}

// Debounce search input to avoid lag while typing
function handleSearchInput() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        applyFilterAndRender();
    }, 300);
}

// File Selection Handler
function handleFileSelect(e) {
    const selected = e.target.value;
    searchInput.value = ""; // Clear search on file switch

    if (selected === "all") {
        gallery.innerHTML = "";
        currentFile = 1;
        loadedVideos = [];
        observer.observe(loadingDiv);
        loadFile(currentFile, true);
    } else {
        // Disable infinite scrolling when inspecting a single file
        observer.unobserve(loadingDiv);
        const fileNum = parseInt(selected, 10);
        loadFile(fileNum, false);
    }
}

// Intersection Observer for Infinite Scroll
observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (entry.isIntersecting && fileSelect.value === "all" && !loading) {
            loadFile(currentFile, true);
        }
    });
}, {
    rootMargin: "800px"
});

// Setup Initial Page Load
initDropdown();
observer.observe(loadingDiv);
loadFile(currentFile, true);