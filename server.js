require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const morgan = require('morgan');
const { query, validationResult } = require('express-validator');

const app = express();
const port = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Validate required environment variables
const requiredEnvVars = ['YELP_API_KEY'];
requiredEnvVars.forEach(varName => {
    if (!process.env[varName]) {
        console.error(`FATAL ERROR: ${varName} is not defined.`);
        process.exit(1);
    }
});

// Security Middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https://*.yelp.com']
        }
    },
    hsts: isProduction
}));
app.disable('x-powered-by');

// CORS Configuration
const corsOptions = {
    origin: ['http://localhost:3000', 'http://localhost:5173'],
    methods: ['GET'],
    allowedHeaders: ['Content-Type'],
    credentials: true
};
app.use(cors(corsOptions));

// Request logging
app.use(morgan(isProduction ? 'combined' : 'dev'));

// Rate Limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isProduction ? 50 : 100,
    message: 'Too many requests from this IP, please try again later',
    standardHeaders: true,
    legacyHeaders: false
});

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'healthy',
        timestamp: new Date().toISOString()
    });
});

// Yelp API Proxy Route with input validation
app.get('/api/yelp', apiLimiter, [
    // Input validation for query parameters
    query('term')
        .trim()
        .notEmpty().withMessage('Business type is required')
        .isLength({ max: 50 }).withMessage('Business type must be less than 50 characters'),
    query('location')
        .trim()
        .notEmpty().withMessage('Location is required')
    ], async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            success: false,
            errors: errors.array()[0].msg 
        });
    }

    const { term, location } = req.query;

    try {
        // Cache control headers
        res.set({
            'Cache-Control': 'public, max-age=300',
            'X-Content-Type-Options': 'nosniff'
        });

        const response = await axios.get('https://api.yelp.com/v3/businesses/search', {
            headers: {
                'Authorization': `Bearer ${process.env.YELP_API_KEY}`,
                'Accept': 'application/json'
            },
            params: { 
                term: term.substring(0, 50),
                location: location.substring(0, 100),
                limit: 20
            },
            timeout: 5000
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
            presence_score: calculatePresenceScore(business)
        }));

        res.json({
            success: true,
            count: businesses.length,
            timestamp: new Date().toISOString(),
            data: businesses
        });

    } catch (error) {
        console.error('Yelp API Error:', error.message);
        
        let status = 500;
        let message = 'An error occurred while processing your request';
        let errorCode = 'SERVER_ERROR';

        if (error.response) {
            status = error.response.status;
            message = error.response.data.error?.description || 'Yelp API error';
            errorCode = 'YELP_API_ERROR';
        } else if (error.request) {
            status = 504;
            message = 'Request to Yelp API timed out';
            errorCode = 'REQUEST_TIMEOUT';
        } else if (error.code === 'ECONNABORTED') {
            status = 504;
            message = 'Connection to Yelp API timed out';
            errorCode = 'CONNECTION_TIMEOUT';
        }

        res.status(status).json({ 
            success: false,
            error: message,
            code: errorCode,
            timestamp: new Date().toISOString()
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
    res.status(404).json({ 
        success: false,
        error: 'Endpoint not found',
        code: 'NOT_FOUND'
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server Error:', err.stack);
    res.status(500).json({ 
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
    });
});

// Start server
const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Rate limit: ${apiLimiter.max} requests per 15 minutes`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err);
    server.close(() => process.exit(1));
});

// Graceful shutdown handlers
['SIGTERM', 'SIGINT'].forEach(signal => {
    process.on(signal, () => {
        console.log(`${signal} received. Shutting down gracefully...`);
        server.close(() => {
            console.log('Server terminated');
            process.exit(0);
        });
    });
});