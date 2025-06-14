const mongoose = require('mongoose');

const tagSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        unique: true,
        lowercase: true
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
    color: {
        type: String,
        default: '#8b0000'
    },
    icon: {
        type: String
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category'
    },
    status: {
        type: String,
        enum: ['active', 'hidden', 'restricted'],
        default: 'active'
    },
    type: {
        type: String,
        enum: ['normal', 'system', 'moderator', 'premium'],
        default: 'normal'
    },
    permissions: {
        create: {
            type: String,
            enum: ['all', 'members', 'moderators'],
            default: 'members'
        },
        use: {
            type: String,
            enum: ['all', 'members', 'moderators'],
            default: 'all'
        }
    },
    stats: {
        usageCount: { type: Number, default: 0 },
        lastUsed: Date,
        createdTopics: { type: Number, default: 0 },
        createdPosts: { type: Number, default: 0 }
    },
    metadata: {
        synonyms: [String],           // Eş anlamlı etiketler
        relatedTags: [{              // İlişkili etiketler
            tag: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Tag'
            },
            weight: { type: Number, default: 1 }
        }],
        isOfficial: { type: Boolean, default: false },
        isFeatured: { type: Boolean, default: false },
        requiresApproval: { type: Boolean, default: false },
        maxUsagePerUser: { type: Number, default: 0 }, // 0 = sınırsız
        maxUsagePerTopic: { type: Number, default: 5 }
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    lastModifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

// İndeksler
tagSchema.index({ slug: 1 });
tagSchema.index({ name: 'text', description: 'text' });
tagSchema.index({ category: 1, status: 1 });
tagSchema.index({ 'stats.usageCount': -1 });
tagSchema.index({ type: 1, status: 1 });

// Slug oluşturma middleware
tagSchema.pre('save', function(next) {
    if (!this.isModified('name')) return next();
    
    this.slug = this.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    
    next();
});

// Etiket arama metodu
tagSchema.statics.search = async function(query, options = {}) {
    const {
        category,
        status = 'active',
        type,
        limit = 20,
        skip = 0,
        sort = { 'stats.usageCount': -1 }
    } = options;

    const searchQuery = {
        $or: [
            { name: { $regex: query, $options: 'i' } },
            { description: { $regex: query, $options: 'i' } }
        ],
        status
    };

    if (category) searchQuery.category = category;
    if (type) searchQuery.type = type;

    return this.find(searchQuery)
        .populate('category', 'name slug')
        .populate('createdBy', 'username avatar')
        .populate('lastModifiedBy', 'username avatar')
        .sort(sort)
        .skip(skip)
        .limit(limit);
};

// Popüler etiketleri getirme metodu
tagSchema.statics.getPopularTags = async function(options = {}) {
    const {
        category,
        limit = 10,
        days = 30,
        minUsage = 1
    } = options;

    const query = {
        status: 'active',
        'stats.usageCount': { $gte: minUsage }
    };

    if (category) query.category = category;
    if (days) {
        query['stats.lastUsed'] = { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) };
    }

    return this.find(query)
        .populate('category', 'name slug')
        .sort({ 'stats.usageCount': -1 })
        .limit(limit);
};

// Etiket kullanımını güncelleme metodu
tagSchema.methods.incrementUsage = async function(userId, topicId) {
    const Topic = mongoose.model('Topic');
    
    // Kullanıcı limitini kontrol et
    if (this.metadata.maxUsagePerUser > 0) {
        const userUsageCount = await Topic.countDocuments({
            tags: this._id,
            author: userId,
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        });

        if (userUsageCount >= this.metadata.maxUsagePerUser) {
            throw new Error('Günlük etiket kullanım limitine ulaşıldı');
        }
    }

    // Konu başına limiti kontrol et
    if (this.metadata.maxUsagePerTopic > 0) {
        const topicTagCount = await Topic.countDocuments({
            _id: topicId,
            tags: this._id
        });

        if (topicTagCount >= this.metadata.maxUsagePerTopic) {
            throw new Error('Konu başına etiket kullanım limitine ulaşıldı');
        }
    }

    // İstatistikleri güncelle
    this.stats.usageCount += 1;
    this.stats.lastUsed = new Date();
    await this.save();

    return this;
};

// Etiket detayları için public veri
tagSchema.methods.toPublicJSON = function() {
    return {
        id: this._id,
        name: this.name,
        slug: this.slug,
        description: this.description,
        color: this.color,
        icon: this.icon,
        category: this.category,
        status: this.status,
        type: this.type,
        permissions: this.permissions,
        stats: this.stats,
        metadata: {
            synonyms: this.metadata.synonyms,
            isOfficial: this.metadata.isOfficial,
            isFeatured: this.metadata.isFeatured,
            maxUsagePerTopic: this.metadata.maxUsagePerTopic
        },
        createdAt: this.createdAt,
        updatedAt: this.updatedAt
    };
};

const Tag = mongoose.model('Tag', tagSchema);

module.exports = Tag; 