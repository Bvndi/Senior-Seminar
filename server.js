const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();
const PORT = 3000;

// Yelp API Key (keep it secret here)
const YELP_API_KEY = 'YOUR_YELP_API_KEY';

app.use(cors());
app.use(express.json());

// Yelp API Proxy
app.get('/api/yelp', async (req, res) => {
    const { term, location } = req.query;

    if (!term || !location) {
        return res.status(400).json({ error: 'Missing term or location' });
    }

    try {
        const response = await axios.get('https://api.yelp.com/v3/businesses/search', {
            headers: {
                Authorization: `Bearer ${YELP_API_KEY}`
            },
            params: { term, location }
        });

        res.json(response.data);
    } catch (error) {
        console.error('Yelp API Error:', error);
        res.status(500).json({ error: 'Failed to fetch Yelp data' });
    }
});
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));


const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per window
});
app.use(limiter);