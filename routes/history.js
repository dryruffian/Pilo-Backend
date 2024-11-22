// server/routes/history.js
import express from 'express';
import { protect } from '../middleware/protect.js';
import Product from '../Models/product.model.js';

const router = express.Router();

router.get('/', protect, async (req, res) => {
  try {
    const products = await Product.find({ by_user: req.user._id })
      .sort({ createdAt: -1 })
      .select('code product_name brands food_score food_restriction image_url createdAt');

    res.json({
      status: 'success',
      data: products
    });
  } catch (error) {
    console.error('History fetch error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch scan history'
    });
  }
});

export default router;