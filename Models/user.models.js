//Models/user.models.js
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, "Please enter your name"]
    },
    email: {
        type: String,
        required: [true, "Please enter your email"],
        unique: true,
        lowercase: true,
        trim: true,
        validate: {
            validator: function (v) {
                // Simple email regex for validation
                return /^\w+([\.+-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,})+$/.test(v);
            },
            message: props => `${props.value} is not a valid email!`
        }
    },
    password: {
        type: String,
        required: [true, "Please enter your password"],
        minlength: [6, "Password must be at least 6 characters long"]
    },
    age: {
        type: Number,
        required: [true, "Please enter your age"],
        min: [0, "Age cannot be negative"],
        validate: {
            validator: Number.isInteger,
            message: "{VALUE} is not an integer value"
        }
    },
    preferences: {
        type: [String],
        default: []
    },
    allergies: {
        type: [String],
        default: []
    },
    scanHistory: {
        type: [String],
        default: []
    },
    favorites: {
        type: [String], 
        default: []
    }
}, {
    timestamps: true,
    versionKey: false
});

// Hash password before saving
UserSchema.pre('save', async function (next) {
    try {
        // Only hash the password if it has been modified or is new
        if (this.isModified('password') || this.isNew) {
            const saltRounds = 10;
            const hash = await bcrypt.hash(this.password, saltRounds);
            this.password = hash;
        }
        next();
    } catch (err) {
        next(err);
    }
});

// Method to compare password during login
UserSchema.methods.comparePassword = function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', UserSchema);

export default User;
