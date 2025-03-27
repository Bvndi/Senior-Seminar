require('dotenv').config();

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
const port = process.env.PORT || 3000;

// Use environment variables
const YELP_API_KEY = process.env.YELP_API_KEY;

// CORS Configuration (restrict to trusted domains in production)
const corsOptions = {
    origin: ['http://localhost:3000', 'https://your-production-domain.com'],
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));
app.use(express.json());

// Rate Limiting (apply before the routes)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 100                   // limit each IP to 100 requests per window
});
app.use(limiter);

// Route for root to test server
app.get('/', (req, res) => {
    res.send('Server is running');
});

// Yelp API Proxy Route
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
        // Improved error handling
        if (error.response) {
            console.error('Yelp API Error:', error.response.data);
            res.status(error.response.status).json({ error: error.response.data });
        } else if (error.request) {
            console.error('No response received:', error.request);
            res.status(500).json({ error: 'No response received from Yelp' });
        } else {
            console.error('Request failed:', error.message);
            res.status(500).json({ error: 'An unexpected error occurred' });
        }
    }
});

// Start server
app.listen(port, () => console.log(`Server running on port ${port}`));
