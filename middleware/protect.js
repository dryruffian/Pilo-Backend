import jwt from 'jsonwebtoken';
import User from '../Models/user.models.js';
import '../config/env.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Middleware to protect routes
export const protect = async (req, res, next) => {
    try {
        // Check if token exists in header
        let token;
        if (req.headers.authorization &&
            req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return res.status(401).json({
                status: 'error',
                message: 'Not authorized, no token provided',
                success: false
            });
        }

        // Verify token
        const decoded = jwt.verify(token, JWT_SECRET);

        // Find user and attach to request
        const currentUser = await User.findById(decoded.id).select('-password');

        if (!currentUser) {
            return res.status(401).json({
                status: 'error',
                message: 'User no longer exists',
                success: false
            });
        }

        // Attach user to request object
        req.user = currentUser;
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                status: 'error',
                message: 'Invalid token, please login again',
                success: false
            });
        }

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                status: 'error',
                message: 'Token expired, please login again',
                success: false
            });
        }

        console.error('Authentication error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Authentication failed',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Middleware to extend token expiration on active use
export const extendTokenExpiration = (req, res, next) => {
    if (req.user) {
        const token = jwt.sign(
            { id: req.user._id },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Optional: You can send this token back to the client
        // for them to update their stored token
        res.set('X-Refresh-Token', token);
    }
    next();
};