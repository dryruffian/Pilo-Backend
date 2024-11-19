//signup.js
import express from 'express';
import jwt from 'jsonwebtoken';
import 'dotenv/config';
import { validate, createUserSchema } from '../middleware/signup.validation.js';
import User from '../Models/user.models.js'

const router = express.Router();

// Environment variables - in practice, these should be in your .env file
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// Generate JWT token
const generateToken = (userId) => {
    return jwt.sign({ id: userId }, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN
    });
};

// Signup route
router.post('/signup', validate(createUserSchema), async (req, res) => {
    try {
        const { email, password, name, age, preferences, allergies } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({
                status: 'error',
                message: 'User with this email already exists',
                success: false,
            });
        }

        // Create new user
        const user = new User({
            email,
            password,
            name,
            age,
            preferences: preferences || [],
            allergies: allergies || [],
            scanHistory: [],
            favorites: []
        });
        // Save user - password will be hashed by the pre-save middleware
        await user.save();

        // Generate JWT token
        const token = generateToken(user._id);

        // Return success response with token
        // Exclude sensitive information from the response
        const userResponse = {
            id: user._id,
            name: user.name,
            email: user.email,
            age: user.age,
            preferences: user.preferences,
            allergies: user.allergies,
            createdAt: user.createdAt
        };

        res.status(201).json({
            status: 'success',
            message: 'User created successfully',
            data: {
                user: userResponse,
                token
            }
        });

    } catch (error) {
        // Log the error for debugging (in production, use proper logging)
        console.error('Signup error:', error);

        // Check if it's a validation error
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                status: 'error',
                message: 'Validation failed',
                errors: Object.values(error.errors).map(err => ({
                    field: err.path,
                    message: err.message
                }))
            });
        }

        // Generic error response
        res.status(500).json({
            status: 'error',
            message: 'An error occurred during signup',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});


export default router;