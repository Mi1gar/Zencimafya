const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },
    slug: {
        type: String,
        required: true,
        unique: true,
        lowercase: true
    },
    description: {
        type: String,
        trim: true
    },
    icon: {
        type: String,
        default: 'folder'
    },
    color: {
        type: String,
        default: '#8b0000'
    },
    parent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category'
    },
    order: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['active', 'hidden', 'locked'],
        default: 'active'
    },
    permissions: {
        view: {
            type: String,
            enum: ['all', 'members', 'moderators'],
            default: 'all'
        },
        post: {
            type: String,
            enum: ['all', 'members', 'moderators'],
            default: 'members'
        },
        reply: {
            type: String,
            enum: ['all', 'members', 'moderators'],
            default: 'members'
        }
    },
    moderators: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    stats: {
        topics: { type: Number, default: 0 },
        posts: { type: Number, default: 0 },
        views: { type: Number, default: 0 }
    },
    lastActivity: {
        topic: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Topic'
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        date: Date
    },
    rules: [{
        title: String,
        description: String,
        order: Number
    }],
    metadata: {
        isAnnouncement: { type: Boolean, default: false },
        isPrivate: { type: Boolean, default: false },
        requireApproval: { type: Boolean, default: false },
        allowedTags: [String],
        maxAttachments: { type: Number, default: 5 },
        maxAttachmentSize: { type: Number, default: 5242880 } // 5MB
    }
}, {
    timestamps: true
});

// İndeksler
categorySchema.index({ slug: 1 });
categorySchema.index({ parent: 1, order: 1 });
categorySchema.index({ status: 1 });

// Slug oluşturma middleware
categorySchema.pre('save', function(next) {
    if (!this.isModified('name')) return next();
    
    this.slug = this.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    
    next();
});

// Kategori arama metodu
categorySchema.statics.search = async function(query) {
    return this.find({
        $or: [
            { name: { $regex: query, $options: 'i' } },
            { description: { $regex: query, $options: 'i' } }
        ],
        status: 'active'
    })
    .populate('parent', 'name slug')
    .populate('lastActivity.user', 'username avatar')
    .populate('lastActivity.topic', 'title')
    .sort({ order: 1, name: 1 });
};

// Kategori ağacı oluşturma metodu
categorySchema.statics.getTree = async function() {
    const categories = await this.find({ status: 'active' })
        .populate('parent', 'name slug')
        .sort({ order: 1, name: 1 });

    const categoryMap = new Map();
    const tree = [];

    // Önce tüm kategorileri map'e ekle
    categories.forEach(category => {
        categoryMap.set(category._id.toString(), {
            ...category.toObject(),
            children: []
        });
    });

    // Ağaç yapısını oluştur
    categories.forEach(category => {
        const categoryObj = categoryMap.get(category._id.toString());
        
        if (category.parent) {
            const parent = categoryMap.get(category.parent._id.toString());
            if (parent) {
                parent.children.push(categoryObj);
            }
        } else {
            tree.push(categoryObj);
        }
    });

    return tree;
};

// Kategori detayları için public veri
categorySchema.methods.toPublicJSON = function() {
    return {
        id: this._id,
        name: this.name,
        slug: this.slug,
        description: this.description,
        icon: this.icon,
        color: this.color,
        parent: this.parent,
        order: this.order,
        status: this.status,
        permissions: this.permissions,
        stats: this.stats,
        lastActivity: this.lastActivity,
        rules: this.rules,
        metadata: this.metadata,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt
    };
};

// İstatistikleri güncelleme metodu
categorySchema.methods.updateStats = async function() {
    const Topic = mongoose.model('Topic');
    const Post = mongoose.model('Post');

    const [topicCount, postCount, viewCount] = await Promise.all([
        Topic.countDocuments({ category: this._id, status: 'active' }),
        Post.countDocuments({ 'topic.category': this._id, status: 'active' }),
        Topic.aggregate([
            { $match: { category: this._id, status: 'active' } },
            { $group: { _id: null, totalViews: { $sum: '$stats.views' } } }
        ])
    ]);

    this.stats = {
        topics: topicCount,
        posts: postCount,
        views: viewCount[0]?.totalViews || 0
    };

    return this.save();
};

const Category = mongoose.model('Category', categorySchema);

module.exports = Category; 