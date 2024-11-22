import mongoose from 'mongoose';
import { number } from 'zod';
const Schema = mongoose.Schema;

const ProductSchema = new Schema({
    code: {
        type: Number,
        required: true,
        unique: true,
        index: true
    },
    product_name: {
        type: String,
        required: true
    },
    by_user:{
        type: Schema.Types.ObjectId,
        required: true
    }
    ,
    generic_name: {
        type: String
    },
    brands: {
        type: String
    },
    allergens: [{
        type: String
    }],
    traces: {
        type: String
    },
    ingredients_text: {
        type: [String]
    },
    nutriments: {
        energy_100g: Number,
        fat_100g: Number,
        sugars_100g: Number,
        salt: Number,
        sodium: Number,
        fiber_100g: Number,
        proteins_100g: Number
    },
    nutriscore_grade: {
        type: String,
        enum: ['a', 'b', 'c', 'd', 'e', null]
    },
    nova_group: {
        type: Number,
        min: 1,
        max: 4
    },
    image_url: {
        type: String,
        validate: {
            validator: function(v) {
                return /^https?:\/\/.+/.test(v);
            },
            message: 'Image URL must be a valid URL'
        }
    },
    image_small_url: {
        type: String,
        validate: {
            validator: function(v) {
                return /^https?:\/\/.+/.test(v);
            },
            message: 'Small image URL must be a valid URL'
        }
    },
    nutrition_advisor: {
        fat: {
            type: String,
            enum: ['low', 'moderate', 'high']
        },
        saturated_fat: {
            type: String,
            enum: ['low', 'moderate', 'high']
        },
        sugars: {
            type: String,
            enum: ['low', 'moderate', 'high']
        },
        salt: {
            type: String,
            enum: ['low', 'moderate', 'high']
        },
        Protein: {
            type: String,
            enum: ['Low', 'Medium', 'High', 'Unknown']
        }
    },
    nutrition_values: {
        energy: Number,
        fat: Number,
        sugar: Number,
        salt: Number,
        sodium: Number,
        fiber: Number,
        protein: Number
    },
    food_restriction: {
        isVegan: {
            type: Schema.Types.Mixed,  // Can be boolean or string ('unknown')
            default: 'unknown'
        },
        isVegetarian: {
            type: Schema.Types.Mixed,  // Can be boolean or string ('unknown')
            default: 'unknown'
        },
        isGlutenFree: {
            type: Schema.Types.Mixed,  // Can be boolean or string ('unknown')
            default: 'unknown'
        },
        isLactoseFree: {
            type: Schema.Types.Mixed,  // Can be boolean or string ('unknown')
            default: 'unknown'
        }
    },
    foodscore:{
        type: Number,
        default:0
    }
}, {
    timestamps: true,
    collection: 'products'
});


const Product = mongoose.model('Product', ProductSchema);

export default Product;