const express = require('express');
const axios = require('axios');

const app = express();
const PORT = 3000;

// Replace with your Google Places API key
const GOOGLE_API_KEY = 'YOUR_GOOGLE_PLACES_API_KEY';

// Proxy endpoint to fetch business data
app.get('/business-info', async (req, res) => {
  const { query, location } = req.query;

  if (!query || !location) {
    return res.status(400).json({ error: 'Query and location parameters are required' });
  }

  try {
    // Call Google Places API
    const googleResponse = await axios.get('https://maps.googleapis.com/maps/api/place/textsearch/json', {
      params: {
        query: `${query} in ${location}`,
        key: GOOGLE_API_KEY,
      },
    });

    // Extract relevant data from Google response
    const business = googleResponse.data.results[0];
    if (!business) {
      return res.status(404).json({ error: 'No businesses found' });
    }

    // Format the response
    const formattedResponse = {
      name: business.name,
      location: {
        address: business.formatted_address,
        latitude: business.geometry.location.lat,
        longitude: business.geometry.location.lng,
      },
      onlinePresence: [
        business.website || 'No website available',
      ],
    };

    // Send the response
    res.json(formattedResponse);
  } catch (error) {
    console.error('Error fetching data from Google Places:', error);
    res.status(500).json({ error: 'Failed to fetch data from Google Places' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Proxy API is running on http://localhost:${PORT}`);
});