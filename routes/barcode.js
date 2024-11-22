import express from 'express';
import axios from 'axios';
import NodeCache from 'node-cache';
import { z } from 'zod';
import ProductAnalyzer from '../utils/ProductAnalyzer.js';
import Product from '../Models/product.model.js';
import mongoose from 'mongoose';

const router = express.Router();
const cache = new NodeCache({ stdTTL: 3600 });

// Define the ID schema
const idSchema = z.string().regex(/^\d+$/, 'Invalid barcode ID');

router.get('/:id', async (req, res, next) => {
    const { id } = req.params;

    // Validate the ID
    try {
        idSchema.parse(id);
    } catch (err) {
        return res.status(400).send({ error: err.errors[0].message });
    }

    try {
        const cachedData = cache.get(id);
        if (cachedData) {
            return res.send(cachedData);
        }

        let product = await Product.findOne({ code: id });

        if (!product) {
            // Fetch from Open Food Facts API
            const response = await axios.get(`https://world.openfoodfacts.org/api/v0/product/${id}.json`);

            if (response.status === 404 || response.data.status !== 1) {
                return res.status(404).send({ error: 'Product not found' });
            }

            const productData = new ProductAnalyzer(response.data);

            // Create new product instance using Mongoose model
            product = new Product({
                code: productData.code,
                product_name: productData.productName,
                generic_name: productData.genericName,
                brands: productData.productBrand,
                allergens: productData.getAllergens(),
                traces: productData.traces,
                ingredients_text: productData.ingredientTexts,
                nutriments: productData.nutriments,
                nutriscore_grade: productData.nutriscore || null,
                nova_group: productData.novascore || null,
                image_url: productData.image,
                image_small_url: productData.small_image,
                nutrition_advisor: productData.getNutritionAdvisory(),
                nutrition_values: productData.getNutrition(),
                food_restriction: productData.analyze(),
                by_user: req.user._id,
                food_score:req.getFoodScore()
            });

            // Save to database
            await product.save();
        }

        // Convert Mongoose document to plain object for caching
        const productObject = product.toObject({
            transform: (doc, ret) => {
                // Convert ObjectId to string
                ret._id = ret._id.toString();
                // Remove mongoose specific fields
                delete ret.__v;
                return ret;
            }
        });

        // Cache the plain object
        cache.set(id, productObject);

        // Send response
        return res.json(productObject);

    } catch (err) {
        if (err.response) {
            // Handle API response errors
            return res.status(err.response.status).send({ error: err.response.data });
        } else if (err.request) {
            // Handle no response from API server
            return res.status(503).send({ error: 'No response from API server' });
        } else if (err instanceof mongoose.Error) {
            // Better MongoDB error handling
            console.error('Database error:', err);
            return res.status(500).send({ error: 'Database error' });
        } else {
            console.error('Unexpected error:', err);
            // Pass other errors to error handling middleware
            next(err);
        }
    }
});

export default router;