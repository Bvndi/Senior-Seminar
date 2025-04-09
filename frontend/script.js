const searchBtn = document.getElementById('search-btn');
const businessTypeInput = document.getElementById('business-type');
const locationInput = document.getElementById('location');
const resultsDiv = document.getElementById('results');
const totalCountSpan = document.getElementById('total-count');
const helpCountSpan = document.getElementById('help-count');
const tutorialModal = document.getElementById('tutorial-modal');
const startBtn = document.getElementById('start-btn');

// Initializing the map
const map = L.map('map').setView([40.7128, -74.0060], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Show tutorial modal on first visit
if (!localStorage.getItem('tutorialShown')) {
    tutorialModal.style.display = 'flex';
    localStorage.setItem('tutorialShown', 'true');
}

// Event Listeners
startBtn.addEventListener('click', function() {
    console.log('Start button clicked');
    tutorialModal.style.display = 'none';
});

searchBtn.addEventListener('click', searchBusinesses);

document.querySelectorAll('.demo-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        businessTypeInput.value = this.dataset.term;
        locationInput.value = this.dataset.location;
        searchBusinesses();
    });
});

// Main Search Function
async function searchBusinesses() {
    const term = businessTypeInput.value.trim();
    const location = locationInput.value.trim();

    if (!term || !location) {
        showError('Please enter both a business type and location');
        return;
    }

    setLoading(true);
    clearResults();

    try {
        // Make a request to my server's proxy endpoint
        const response = await fetch(`/api/yelp?term=${term}&location=${location}`);
        const data = await response.json();

        if (data.error) {
            showError(data.error);
        } else {
            displayResults(data.data || []); // Adjusted to match the server's response structure
        }
    } catch (error) {
        console.error('API Error:', error);
        showError('Failed to connect. Please try again later.');
    } finally {
        setLoading(false);
    }
}


function displayResults(businesses) {
    clearResults();
    
    if (!businesses || businesses.length === 0) {
        showEmptyState();
        return;
    }

    // Update stats
    totalCountSpan.textContent = businesses.length;
    const needsHelp = businesses.filter(b => calculatePresenceScore(b) <= 1).length;
    helpCountSpan.textContent = needsHelp;

    // Center map on first result
    if (businesses[0].coordinates) {
        map.setView([businesses[0].coordinates.latitude, businesses[0].coordinates.longitude], 13);
    }

    // Process each business
    businesses.forEach(business => {
        const presenceScore = calculatePresenceScore(business);
        const needsHelp = presenceScore <= 1;

        // Create business card
        const card = document.createElement('div');
        card.className = `business-card ${needsHelp ? '' : 'good-presence'}`;
        
        card.innerHTML = `
            <h3>${business.name}</h3>
            <div class="rating">
                ${'★'.repeat(Math.floor(business.rating || 0))} 
                ${business.rating ? business.rating.toFixed(1) : 'No'} 
                (${business.review_count || 0} reviews)
            </div>
            <div class="categories">${business.categories?.map(cat => cat.title).join(', ') || 'Uncategorized'}</div>
            <div class="address">📍 ${business.location?.display_address?.join(', ') || 'Address not available'}</div>
            ${business.phone ? `<div class="phone">📞 ${business.phone}</div>` : ''}
            <div class="online-presence">
                ${business.url ? `<a href="${business.url}" target="_blank">🌐 Website</a>` : '<span class="no-presence">No website</span>'}
                ${business.phone ? `<a href="tel:${business.phone}">📞 Call</a>` : ''}
            </div>
            <div class="presence-score ${needsHelp ? '' : 'good-presence'}">
                Online Presence: ${presenceScore}/3 ${needsHelp ? '(needs help)' : '(good)'}
            </div>
        `;
        resultsDiv.appendChild(card);

        // Add marker to map if coordinates exist
        if (business.coordinates) {
            const marker = L.marker(
                [business.coordinates.latitude, business.coordinates.longitude],
                {
                    icon: needsHelp ? 
                        L.divIcon({ className: 'poor-presence-marker', html: '📍' }) :
                        L.divIcon({ className: 'good-presence-marker', html: '🏢' })
                }
            )
            .addTo(map)
            .bindPopup(`
                <b>${business.name}</b><br>
                ${business.rating ? `${business.rating} ★` : 'No ratings'}<br>
                ${business.location?.display_address?.[0] || ''}
            `);
        }
    });
}

function calculatePresenceScore(business) {
    let score = 0;
    if (business.url) score += 1;
    if (business.phone) score += 1;
    if (business.facebook_url || business.instagram_url) score += 1;
    return score;
}

function setLoading(isLoading) {
    if (isLoading) {
        searchBtn.classList.add('loading');
        resultsDiv.innerHTML = `
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <p>Searching for local businesses...</p>
            </div>
        `;
    } else {
        searchBtn.classList.remove('loading');
    }
}

function clearResults() {
    resultsDiv.innerHTML = '';
    map.eachLayer(layer => {
        if (layer instanceof L.Marker) {
            map.removeLayer(layer);
        }
    });
}

function showError(message) {
    resultsDiv.innerHTML = `
        <div class="error-state">
            <h3>⚠️ Error</h3>
            <p>${message}</p>
            <p>Please try again later.</p>
        </div>
    `;
}

function showEmptyState() {
    resultsDiv.innerHTML = `
        <div class="empty-state">
            <p>No businesses found matching your search.</p>
            <p>Try a different location or business type.</p>
        </div>
    `;
}

//Custom marker styles
const markerStyle = document.createElement('style');
markerStyle.textContent = `
    .poor-presence-marker {
        color: #e74c3c;
        font-size: 24px;
        text-shadow: 0 0 3px white;
    }
    .good-presence-marker {
        color: #2ecc71;
        font-size: 24px;
        text-shadow: 0 0 3px white;
    }
`;
document.head.appendChild(markerStyle);