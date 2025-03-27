require('dotenv').config();

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const morgan = require('morgan');
const { body, validationResult } = require('express-validator');

const app = express();
const port = process.env.PORT || 3000;

// Validate required environment variables
if (!process.env.YELP_API_KEY) {
    console.error('FATAL ERROR: YELP_API_KEY is not defined.');
    process.exit(1);
}

// Security Middleware
app.use(helmet()); // Adds various security headers
app.disable('x-powered-by'); // Remove Express header

// CORS Configuration
const corsOptions = {
    origin: process.env.NODE_ENV === 'production' 
        ? ['https://your-production-domain.com'] 
        : ['http://localhost:3000'],
    methods: ['GET'],
    allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));

// Request logging
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per window
    message: 'Too many requests from this IP, please try again later',
    standardHeaders: true,
    legacyHeaders: false
});
app.use('/api/yelp', limiter);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy' });
});

// Yelp API Proxy Route with input validation
app.get('/api/yelp', [
    // Input validation
    body('term').trim().notEmpty().withMessage('Business type is required'),
    body('location').trim().notEmpty().withMessage('Location is required')
], async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { term, location } = req.query;

    try {
        // Validate parameters
        if (term || location) {
            return res.status(400).json({ 
                error: 'Both "term" and "location" query parameters are required.' });
        }

        // Cache control headers
        res.set('Cache-Control', 'public, max-age=300'); // 5 minute cache

        const response = await axios.get('https://api.yelp.com/v3/businesses/search', {
            headers: {
                'Authorization': `Bearer ${process.env.YELP_API_KEY}`,
                'Accept': 'application/json'
            },
            params: { 
                term: term.substring(0, 50), // Limit length
                location: location.substring(0, 100),
                limit: 20 // Limit results to prevent excessive data transfer
            },
            timeout: 5000 // 5 second timeout
        });

        // Filter and format response data
        const businesses = response.data.businesses.map(business => ({
            id: business.id,
            name: business.name,
            rating: business.rating,
            review_count: business.review_count,
            url: business.url,
            phone: business.phone,
            categories: business.categories,
            coordinates: business.coordinates,
            location: business.location,
            // Add additional fields as needed
            presence_score: calculatePresenceScore(business)
        }));

        res.json({
            success: true,
            count: businesses.length,
            businesses
        });

    } catch (error) {
        console.error('Yelp API Error:', error.message);
        
        let status = 500;
        let message = 'An error occurred while processing your request';

        if (error.response) {
            status = error.response.status;
            message = error.response.data.error?.description || 'Yelp API error';
        } else if (error.request) {
            status = 504;
            message = 'Request to Yelp API timed out';
        }

        res.status(status).json({ 
            success: false,
            error: message
        });
    }
});

// Helper function to calculate presence score
function calculatePresenceScore(business) {
    let score = 0;
    if (business.url) score += 1;
    if (business.phone) score += 1;
    if (business.facebook_url || business.instagram_url) score += 1;
    return score;
}

// 404 Handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server Error:', err.stack);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err);
    server.close(() => process.exit(1));
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully');
    server.close(() => {
        console.log('Process terminated');
    });
});