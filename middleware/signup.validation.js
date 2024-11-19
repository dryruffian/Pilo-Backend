//middleware/signup.validation.js
import { z } from 'zod';

// Base user schema for shared validations
const userBaseSchema = {
    name: z.string({
        required_error: "Name is required"
    }).min(1, "Name cannot be empty"),

    email: z.string({
        required_error: "Email is required"
    }).email("Invalid email format")
        .toLowerCase()
        .trim(),

    age: z.number({
        required_error: "Age is required"
    }).int("Age must be an integer")
        .min(0, "Age cannot be negative"),

    preferences: z.array(z.string()).default([]),
    allergies: z.array(z.string()).default([]),
    scanHistory: z.array(z.string()).default([]),
    favorites: z.array(z.string()).default([])
};

// Schema for creating new user
const createUserSchema = z.object({
    body: z.object({
        ...userBaseSchema,
        password: z.string({
            required_error: "Password is required"
        }).min(6, "Password must be at least 6 characters long")
    })
});

// Schema for updating user
const updateUserSchema = z.object({
    body: z.object({
        ...userBaseSchema,
        password: z.string()
            .min(6, "Password must be at least 6 characters long")
            .optional()
    }).partial(), // Makes all fields optional for PATCH requests
    params: z.object({
        id: z.string({
            required_error: "User ID is required"
        }).regex(/^[0-9a-fA-F]{24}$/, "Invalid MongoDB ID")
    })
});

// Schema for login
const loginUserSchema = z.object({
    body: z.object({
        email: z.string({
            required_error: "Email is required"
        }).email("Invalid email format"),
        password: z.string({
            required_error: "Password is required"
        })
    })
});

// Validation middleware
const validate = (schema) => async (req, res, next) => {
    try {
        await schema.parseAsync({
            body: req.body,
            query: req.query,
            params: req.params
        });
        return next();
    } catch (error) {
        // Format Zod errors into a more readable format
        const errors = error.errors.map((err) => ({
            path: err.path.join('.'),
            message: err.message
        }));
        return res.status(400).json({
            status: 'error',
            message: 'Validation failed',
            errors
        });
    }
};

export {
    validate,
    createUserSchema,
    updateUserSchema,
    loginUserSchema
};