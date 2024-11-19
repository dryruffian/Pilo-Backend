import express from 'express';
import Product from '../Models/product.model.js';

const router = express.Router();

router.get('/list',async (req,res) => {
    try {
        const products = await Product.find({by_user: req.user._id})
        res.status(200).json(products)
        
    } catch (error) {
        console.error(`Error Fetching user product:${error}`)
        res.status(500).json({error: 'Error Fetching product'})
    }
})

export default router;