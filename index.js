//index.js
import express from 'express';
import morgan from 'morgan';
import mongoose from 'mongoose';
import { loadEnvConfig } from './config/env.js';
import { connectWithRetry } from './config/database.js';
import { setupSecurityMiddleware } from './middleware/security.js';
import { notFoundHandler, errorHandler } from './middleware/error.js';
import barcodeRouter from './routes/barcode.js';
import healthRouter from './routes/health.js';
import signupRouter from './routes/signup.js';
import login from './routes/login.js';
import listRouter from './routes/list.js'
import me from './routes/me.js'
import {protect,extendTokenExpiration} from "./middleware/protect.js";

// Load environment configuration
loadEnvConfig();

// Initialize express
const app = express();

// Setup security middleware
setupSecurityMiddleware(app);

// Request parsing & logging
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'combined'));

// Connect to database
connectWithRetry();

// Routes
app.use('/health', healthRouter);
app.use('/api/v1/barcode',protect,extendTokenExpiration, barcodeRouter);
app.use('/auth',signupRouter);
app.use('/auth',login);
app.use('/auth',me)
app.use('/data',protect,extendTokenExpiration,listRouter)
app.use('/data/history', protect, historyRouter);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    mongoose.connection.close(false, () => {
        console.log('MongoDB connection closed.');
        process.exit(0);
    });
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;