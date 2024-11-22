// backend/routes/me.js
import express from 'express';
import { protect } from '../middleware/protect.js';

const router = express.Router();

router.get('/me', protect, (req, res) => {
    try {
        // Since the protect middleware already attaches the user to req.user
        // and excludes the password, we can directly send it
        res.status(200).json({
            status: 'success',
            message: 'User details retrieved successfully',
            data: {
                user: req.user
            }
        });
    } catch (error) {
        console.error('Get user details error:', error);
        res.status(500).json({
            status: 'error',
            message: 'An error occurred while retrieving user details',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
            success: false
        });
    }
});

export default router;