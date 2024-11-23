// server/routes/history.js
import express from 'express';
import { protect } from '../middleware/protect.js';
import Product from '../Models/product.model.js';
import User from '../Models/user.models.js';
import mongoose from 'mongoose';

const router = express.Router();

router.get('/', protect, async (req, res) => {
  try {
    // Get user with populated scan history
    const user = await User.findById(req.user._id)
      .select('scanHistory')
      .lean();

    if (!user || !user.scanHistory.length) {
      return res.json({
        status: 'success',
        data: []
      });
    }

    // Fetch products from scan history
    const products = await Product.find({
      code: { $in: user.scanHistory }
    })
    .select('code product_name brands food_score food_restriction image_url createdAt')
    .sort({ createdAt: -1 })
    .lean();

    // Create a map for quick lookup of products
    const productMap = products.reduce((acc, product) => {
      acc[product.code] = product;
      return acc;
    }, {});

    // Maintain order from scanHistory and include only existing products
    const orderedProducts = user.scanHistory
      .map(code => productMap[code])
      .filter(Boolean);

    res.json({
      status: 'success',
      data: orderedProducts
    });
  } catch (error) {
    console.error('History fetch error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch scan history'
    });
  }
});

// Add route to update scan history
router.post('/add', protect, async (req, res) => {
  try {
    const { productCode } = req.body;

    if (!productCode) {
      return res.status(400).json({
        status: 'error',
        message: 'Product code is required'
      });
    }

    // Find user and update scan history
    const user = await User.findById(req.user._id);

    // Remove if exists (to move to front) and add to front
    user.scanHistory = [
      productCode,
      ...user.scanHistory.filter(code => code !== productCode)
    ].slice(0, 100); // Keep last 100 items

    await user.save();

    res.json({
      status: 'success',
      message: 'Scan history updated'
    });
  } catch (error) {
    console.error('Add to history error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update scan history'
    });
  }
});

// Clear history
router.delete('/clear', protect, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      $set: { scanHistory: [] }
    });

    res.json({
      status: 'success',
      message: 'Scan history cleared'
    });
  } catch (error) {
    console.error('Clear history error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to clear scan history'
    });
  }
});

export default router;