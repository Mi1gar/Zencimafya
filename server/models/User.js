const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        minlength: 3,
        maxlength: 30
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    avatar: {
        type: String,
        default: '/uploads/avatars/default.png'
    },
    bio: {
        type: String,
        maxlength: 500,
        default: ''
    },
    role: {
        type: String,
        enum: ['user', 'moderator', 'admin'],
        default: 'user'
    },
    status: {
        type: String,
        enum: ['active', 'banned', 'inactive'],
        default: 'active'
    },
    lastSeen: {
        type: Date,
        default: Date.now
    },
    settings: {
        notifications: {
            email: { type: Boolean, default: true },
            push: { type: Boolean, default: true },
            messages: { type: Boolean, default: true },
            mentions: { type: Boolean, default: true }
        },
        privacy: {
            showOnline: { type: Boolean, default: true },
            showLastSeen: { type: Boolean, default: true },
            allowMessages: { type: Boolean, default: true }
        },
        theme: {
            type: String,
            enum: ['light', 'dark', 'system'],
            default: 'system'
        }
    },
    stats: {
        topics: { type: Number, default: 0 },
        posts: { type: Number, default: 0 },
        reputation: { type: Number, default: 0 },
        thanks: { type: Number, default: 0 }
    },
    badges: [{
        name: String,
        description: String,
        icon: String,
        earnedAt: Date
    }],
    friends: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    blockedUsers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }]
}, {
    timestamps: true
});

// Şifre hashleme middleware
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Şifre karşılaştırma metodu
userSchema.methods.comparePassword = async function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

// Kullanıcı profili için public veri
userSchema.methods.toPublicJSON = function() {
    return {
        id: this._id,
        username: this.username,
        avatar: this.avatar,
        bio: this.bio,
        role: this.role,
        status: this.status,
        lastSeen: this.lastSeen,
        stats: this.stats,
        badges: this.badges,
        createdAt: this.createdAt
    };
};

// Kullanıcı arama metodu
userSchema.statics.search = async function(query) {
    return this.find({
        $or: [
            { username: { $regex: query, $options: 'i' } },
            { bio: { $regex: query, $options: 'i' } }
        ],
        status: 'active'
    }).select('username avatar bio stats badges');
};

const User = mongoose.model('User', userSchema);

module.exports = User; 