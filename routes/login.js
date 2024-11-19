import express from 'express';
import jwt from 'jsonwebtoken';
import 'dotenv/config';
import { validate, loginUserSchema } from '../middleware/signup.validation.js';
import User from '../Models/user.models.js';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

const generateToken = (userId) => {
    return jwt.sign({ id: userId }, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN
    });
};

router.post('/login', validate(loginUserSchema), async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({
                status: 'error',
                message: 'Invalid email or password',
                success: false
            });
        }

        // Compare passwords
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({
                status: 'error',
                message: 'Invalid email or password',
                success: false
            });
        }

        // Generate JWT token
        const token = generateToken(user._id);

        // Return user details (excluding sensitive information)
        const userResponse = {
            id: user._id,
            name: user.name,
            email: user.email,
            age: user.age,
            preferences: user.preferences,
            allergies: user.allergies
        };

        res.status(200).json({
            status: 'success',
            message: 'Login successful',
            data: {
                user: userResponse,
                token
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            status: 'error',
            message: 'An error occurred during login',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

export default router;