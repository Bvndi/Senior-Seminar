// Initialize the map
const map = L.map('map').setView([40.7128, -74.0060], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Yelp API Configuration
const YELP_API_KEY = 'toY0q6whX7_wBO9zdfdkymlgnWCHolOjsUjVtmRnAFcJhwDUC5IMuwwfxFsL8f_onGwrrcg7BMjrZUTLUClp_HmZhGTkKaX-fnezPnMy1OHnKpAhAVUAScIRHYvhZ3Yx';

// DOM Elements
const searchBtn = document.getElementById('search-btn');
const businessTypeInput = document.getElementById('business-type');
const locationInput = document.getElementById('location');
const radiusSelect = document.getElementById('radius');
const sortBySelect = document.getElementById('sort-by');
const resultsDiv = document.getElementById('results');

// Search for businesses
searchBtn.addEventListener('click', searchBusinesses);

async function searchBusinesses() {
    const term = businessTypeInput.value.trim();
    const location = locationInput.value.trim();
    const radius = radiusSelect.value;
    const sortBy = sortBySelect.value;

    if (!term || !location) {
        showError('Please enter both a business type and location');
        return;
    }

    // Show loading state
    resultsDiv.innerHTML = '<div class="loading">Searching for businesses...</div>';

    try {
        // Using CORS proxy to avoid direct frontend issues
        const proxyUrl = 'https://cors-anywhere.herokuapp.com/';
        const yelpUrl = `https://api.yelp.com/v3/businesses/search?term=${term}&location=${location}&radius=${radius}&sort_by=${sortBy}`;
        
        const response = await fetch(proxyUrl + yelpUrl, {
            headers: {
                'Authorization': `Bearer ${YELP_API_KEY}`,
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.description || 'Failed to fetch data');
        }

        const data = await response.json();
        
        if (data.error) {
            showError(data.error.description);
        } else {
            displayResults(data.businesses || []);
        }
    } catch (error) {
        console.error('Search error:', error);
        showError(error.message);
    }
}

function showError(message) {
    resultsDiv.innerHTML = `<div class="error">Error: ${message}</div>`;
}

function displayResults(businesses) {
    // Clear previous results
    resultsDiv.innerHTML = '';
    map.eachLayer(layer => {
        if (layer instanceof L.Marker) {
            map.removeLayer(layer);
        }
    });

    if (!businesses || businesses.length === 0) {
        resultsDiv.innerHTML = '<p>No businesses found. Try a different search.</p>';
        return;
    }

    // Center map on first result
    if (businesses[0].coordinates) {
        map.setView([businesses[0].coordinates.latitude, businesses[0].coordinates.longitude], 13);
    }

    // Process each business
    businesses.forEach(business => {
        // Create business card
        const card = document.createElement('div');
        card.className = 'business-card';
        
        // Determine online presence strength
        const hasWebsite = business.url ? 1 : 0;
        const hasPhone = business.phone ? 1 : 0;
        const hasSocial = (business.facebook_url || business.instagram_url) ? 1 : 0;
        const onlinePresenceScore = hasWebsite + hasPhone + hasSocial;
        
        // Only show businesses with limited online presence (score <= 1)
        if (onlinePresenceScore <= 1) {
            card.innerHTML = `
                <h3>${business.name}</h3>
                <div class="rating">${business.rating || 'No'} ★ (${business.review_count || 0} reviews)</div>
                <div class="categories">${business.categories?.map(cat => cat.title).join(', ') || 'Uncategorized'}</div>
                <div class="address">${business.location?.display_address?.join(', ') || 'Address not available'}</div>
                ${business.phone ? `<div class="phone">📞 ${business.phone}</div>` : ''}
                <div class="online-presence">
                    ${business.url ? `<a href="${business.url}" target="_blank">Website</a>` : '<span class="no-presence">No website</span>'}
                    ${business.phone ? `<a href="tel:${business.phone}">Call</a>` : ''}
                </div>
                <div class="presence-score">Online Presence: ${onlinePresenceScore}/3 (low)</div>
            `;
            resultsDiv.appendChild(card);

            // Add marker to map if coordinates exist
            if (business.coordinates) {
                const marker = L.marker([business.coordinates.latitude, business.coordinates.longitude])
                    .addTo(map)
                    .bindPopup(`<b>${business.name}</b><br>${business.location?.display_address?.[0] || ''}`);
            }
        }
    });

    if (resultsDiv.children.length === 0) {
        resultsDiv.innerHTML = '<p>All businesses in this area have good online presence. Try a different location.</p>';
    }
}