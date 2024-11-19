import data from "../testdata.js";

class ProductAnalyzer {
    constructor(productData) {
        if (!productData || !productData.product) {
            throw new Error('Valid product data is required');
        }

        const { product } = productData;

        // Core product info with fallbacks
        this.code = parseInt(product.code) || null;
        this.productName = product.product_name || product.product_name_en || '';
        this.genericName = product.generic_name || product.generic_name_en || '';
        this.productBrand = product.brands || '';
        this.nutriments = product.nutriments || {};
        this.ingredientTexts = Array.isArray(product.ingredients_text)
            ? product.ingredients_text
            : [product.ingredients_text || product.ingredients_text_en || ''];
        this.nutriscore = product.nutriscore_grade || '';
        this.nutriadvisory = product.nutrient_levels || {};

        // Handle allergens more safely
        const allergensList = [
            ...(product.allergens?.split(',') || []),
            ...(product.allergens_from_ingredients?.split(',') || [])
        ].filter(allergen => allergen?.trim());
        this.allergens = new Set(allergensList);

        this.novascore = parseInt(product.nova_group) || null;
        this.image = product.image_url || '';
        this.small_image = product.image_small_url || '';
        this.product = product; // Store reference for complex checks
    }

    isVegan() {
        const { ingredients_analysis_tags = [], ingredients = [], ingredients_analysis = {} } = this.product;

        // Direct tag check
        if (ingredients_analysis_tags.includes('en:vegan')) return true;
        if (ingredients_analysis_tags.includes('en:non-vegan')) return false;

        // Unknown status analysis
        if (ingredients_analysis_tags.includes('en:vegan-status-unknown')) {
            const unknownCount = ingredients_analysis['en:vegan-status-unknown']?.length || 0;
            const totalCount = ingredients.length;
            if (totalCount === 0) return 'unknown';

            const veganScore = ((2 * totalCount - unknownCount) / (2 * totalCount));
            return veganScore > 0.7;
        }

        // Ingredient-level analysis
        if (ingredients.length > 0) {
            const nonVeganIngredients = ingredients.filter(ing => ing.vegan === 'no');
            if (nonVeganIngredients.length > 0) return false;

            const maybeVeganCount = ingredients.filter(ing => ing.vegan === 'maybe').length;
            return maybeVeganCount === 0;
        }

        return 'unknown';
    }

    isVegetarian() {
        const { ingredients_analysis_tags = [], ingredients = [], ingredients_analysis = {} } = this.product;

        // Direct tag check
        if (ingredients_analysis_tags.includes('en:vegetarian')) return true;
        if (ingredients_analysis_tags.includes('en:non-vegetarian')) return false;

        // Unknown status analysis
        if (ingredients_analysis_tags.includes('en:vegetarian-status-unknown')) {
            const unknownCount = ingredients_analysis['en:vegetarian-status-unknown']?.length || 0;
            const totalCount = ingredients.length;
            if (totalCount === 0) return 'unknown';

            const vegetarianScore = (totalCount - unknownCount) / totalCount;
            return vegetarianScore > 0.7;
        }

        // Ingredient-level analysis
        if (ingredients.length > 0) {
            const nonVegIngredients = ingredients.filter(ing => ing.vegetarian === 'no');
            if (nonVegIngredients.length > 0) return false;

            const maybeVegCount = ingredients.filter(ing => ing.vegetarian === 'maybe').length;
            const totalCount = ingredients.length;
            return maybeVegCount / totalCount <= 0.3;
        }

        return 'unknown';
    }

    isGlutenFree() {
        const { allergens_hierarchy = [] } = this.product;

        // Check for gluten in allergens
        if (allergens_hierarchy.includes('en:gluten')) return false;

        // Known gluten-containing ingredients
        const glutenSources = new Set([
            'wheat', 'barley', 'rye', 'triticale', 'spelt',
            'kamut', 'farro', 'bulgur', 'semolina'
        ]);

        // Check ingredients text
        const hasGlutenIngredient = this.ingredientTexts.some(text =>
            text && glutenSources.has(text.toLowerCase().trim())
        );

        if (hasGlutenIngredient) return false;

        // If we have ingredient texts but found no gluten sources, likely gluten-free
        return this.ingredientTexts.some(text => text?.trim()) ? true : 'unknown';
    }

    isLactoseFree() {
        const { allergens_hierarchy = [] } = this.product;

        // Check for milk in allergens
        if (allergens_hierarchy.includes('en:milk')) return false;

        // Known dairy ingredients
        const dairyIngredients = new Set([
            'milk', 'cheese', 'butter', 'yogurt', 'cream',
            'whey', 'casein', 'lactose', 'curd', 'ghee'
        ]);

        // Check ingredients text
        const hasDairyIngredient = this.ingredientTexts.some(text =>
                text && [...dairyIngredients].some(dairy =>
                    text.toLowerCase().includes(dairy)
                )
        );

        if (hasDairyIngredient) return false;

        // If we have ingredient texts but found no dairy, likely lactose-free
        return this.ingredientTexts.some(text => text?.trim()) ? true : 'unknown';
    }

    analyze() {
        return {
            isVegan: this.isVegan(),
            isVegetarian: this.isVegetarian(),
            isGlutenFree: this.isGlutenFree(),
            isLactoseFree: this.isLactoseFree(),
        };
    }

    getProtein() {
        const proteinContent = this.nutriments?.proteins_100g;
        if (typeof proteinContent !== 'number') return "Unknown";

        if (proteinContent > 10) return "High";
        if (proteinContent > 5) return "Medium";
        return "Low";
    }

    getNutritionAdvisory() {
        try {
            return {
                ...this.nutriadvisory,
                Protein: this.getProtein()
            };
        } catch (error) {
            console.error('Error generating nutrition advisory:', error);
            return { error: 'Failed to generate nutrition advisory' };
        }
    }

    getAllergens() {
        const knownAllergens = new Set([
            'en:gluten', 'en:milk', 'en:eggs', 'en:fish', 'en:peanuts',
            'en:soybeans', 'en:nuts', 'en:celery', 'en:mustard',
            'en:sesame-seeds', 'en:sulphur-dioxide-and-sulphites',
            'en:pork', 'en:gelatin', 'en:beef', 'en:crustaceans',
            'en:molluscs', 'en:lupin', 'en:banana', 'en:kiwi',
            'en:peach', 'en:coconut'
        ]);

        const allergensList = new Set();

        // Check allergens hierarchy
        if (Array.isArray(this.product.allergens_hierarchy)) {
            this.product.allergens_hierarchy
                .filter(allergen => knownAllergens.has(allergen))
                .forEach(allergen => allergensList.add(allergen.split(':')[1]));
        }

        // Check for Agar agar
        if (this.ingredientTexts.some(text =>
            text?.toLowerCase().includes('agar agar')
        )) {
            allergensList.add('Agar agar');
        }

        // Add explicitly listed allergens
        this.allergens.forEach(allergen => {
            const trimmed = allergen.trim();
            if (trimmed) allergensList.add(trimmed);
        });

        return allergensList.size > 0
            ? Array.from(allergensList)
            : ['Unknown'];
    }

    getNutrition() {
        const { nutriments } = this;
        return {
            energy: nutriments.energy_100g,
            fat: nutriments.fat_100g,
            sugar: nutriments.sugars_100g,
            salt: nutriments.salt,
            sodium: nutriments.sodium,
            fiber: nutriments.fiber_100g,
            protein: nutriments.proteins_100g,
        };
    }
}
const q = new ProductAnalyzer(data);
console.log(q.getAllergens());
console.log(q.getNutrition());
console.log(q.getNutritionAdvisory());
console.log(q.analyze());
export default ProductAnalyzer;