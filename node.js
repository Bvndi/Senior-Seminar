const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = 3000;

// Geocoding function using Nominatim
async function geocodeBusiness(query) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
  const response = await axios.get(url);
  if (response.data.length > 0) {
    return response.data[0]; // Return the first result
  }
  return null;
}

// Function to check for online presence
async function checkOnlinePresence(businessName) {
  try {
    // Search for the business on Google (or another search engine)
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(businessName)}`;
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3',
      },
    });

    const $ = cheerio.load(response.data);
    const links = [];
    $('a').each((i, elem) => {
      const href = $(elem).attr('href');
      if (href && href.startsWith('/url?q=')) {
        const cleanUrl = href.replace('/url?q=', '').split('&')[0];
        links.push(cleanUrl);
      }
    });

    return links.slice(0, 5); // Return top 5 links
  } catch (error) {
    console.error('Error checking online presence:', error);
    return [];
  }
}

// API endpoint
app.get('/business-info', async (req, res) => {
  const { query } = req.query;

  if (!query) {
    return res.status(400).json({ error: 'Query parameter is required' });
  }

  try {
    // Step 1: Geocode the business
    const locationData = await geocodeBusiness(query);
    if (!locationData) {
      return res.status(404).json({ error: 'Business not found' });
    }

    // Step 2: Check for online presence
    const onlineLinks = await checkOnlinePresence(query);

    // Step 3: Return combined results
    res.json({
      name: query,
      location: {
        address: locationData.display_name,
        latitude: locationData.lat,
        longitude: locationData.lon,
      },
      onlinePresence: onlineLinks,
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});