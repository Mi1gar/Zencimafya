const mongoose = require('mongoose');

const badgeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },
    slug: {
        type: String,
        required: true,
        trim: true,
        unique: true,
        lowercase: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    icon: {
        type: String,
        required: true,
        trim: true
    },
    color: {
        type: String,
        default: '#8b0000',
        trim: true
    },
    type: {
        type: String,
        enum: [
            'achievement',  // Başarı rozeti
            'rank',        // Rütbe rozeti
            'special',     // Özel rozet
            'event',       // Etkinlik rozeti
            'moderator',   // Moderatör rozeti
            'admin',       // Admin rozeti
            'system',      // Sistem rozeti
            'premium',     // Premium rozeti
            'seasonal',    // Sezonluk rozet
            'custom'       // Özel rozet
        ],
        required: true
    },
    category: {
        type: String,
        enum: [
            'general',     // Genel
            'activity',    // Aktivite
            'content',     // İçerik
            'social',      // Sosyal
            'moderation',  // Moderatörlük
            'premium',     // Premium
            'event',       // Etkinlik
            'system'       // Sistem
        ],
        required: true
    },
    rarity: {
        type: String,
        enum: ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'],
        default: 'common'
    },
    requirements: {
        type: {
            type: String,
            enum: [
                'manual',           // Manuel verilir
                'post_count',       // Gönderi sayısı
                'topic_count',      // Konu sayısı
                'reputation',       // İtibar puanı
                'join_date',        // Katılım tarihi
                'achievement',      // Başarı
                'role',            // Rol
                'custom'           // Özel
            ],
            required: true
        },
        value: {
            type: mongoose.Schema.Types.Mixed,
            required: true
        },
        duration: Number, // Gün cinsinden süre (örn: 30 gün)
        conditions: [{
            field: String,
            operator: {
                type: String,
                enum: ['eq', 'gt', 'lt', 'gte', 'lte', 'in', 'nin', 'regex']
            },
            value: mongoose.Schema.Types.Mixed
        }]
    },
    rewards: {
        reputation: Number,
        points: Number,
        permissions: [String],
        features: [String],
        custom: mongoose.Schema.Types.Mixed
    },
    metadata: {
        isHidden: { type: Boolean, default: false },
        isStackable: { type: Boolean, default: false },
        maxStack: Number,
        isTemporary: { type: Boolean, default: false },
        expiryDate: Date,
        isTransferable: { type: Boolean, default: false },
        isRevocable: { type: Boolean, default: true },
        version: String,
        tags: [String],
        customFields: mongoose.Schema.Types.Mixed
    },
    stats: {
        totalAwarded: { type: Number, default: 0 },
        currentHolders: { type: Number, default: 0 },
        lastAwarded: Date,
        popularity: { type: Number, default: 0 }
    },
    display: {
        order: { type: Number, default: 0 },
        showInProfile: { type: Boolean, default: true },
        showInPosts: { type: Boolean, default: true },
        showInSignature: { type: Boolean, default: false },
        customCSS: String,
        customHTML: String
    }
}, {
    timestamps: true
});

// İndeksler
badgeSchema.index({ name: 1 });
badgeSchema.index({ slug: 1 });
badgeSchema.index({ type: 1, category: 1 });
badgeSchema.index({ rarity: 1 });
badgeSchema.index({ 'metadata.tags': 1 });
badgeSchema.index({ 'stats.totalAwarded': -1 });
badgeSchema.index({ 'display.order': 1 });

// Rozet arama metodu
badgeSchema.statics.search = async function(query = {}, options = {}) {
    const {
        type,
        category,
        rarity,
        isHidden,
        limit = 50,
        skip = 0,
        sort = { 'display.order': 1, name: 1 }
    } = options;

    const searchQuery = { ...query };

    if (type) searchQuery.type = type;
    if (category) searchQuery.category = category;
    if (rarity) searchQuery.rarity = rarity;
    if (typeof isHidden === 'boolean') searchQuery['metadata.isHidden'] = isHidden;

    return this.find(searchQuery)
        .sort(sort)
        .skip(skip)
        .limit(limit);
};

// Rozet oluşturma yardımcı metodu
badgeSchema.statics.createBadge = async function(data) {
    const {
        name,
        description,
        icon,
        color,
        type,
        category,
        rarity,
        requirements,
        rewards,
        metadata = {},
        display = {}
    } = data;

    // Slug oluştur
    const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

    // Benzersiz slug kontrolü
    const existingBadge = await this.findOne({ slug });
    if (existingBadge) {
        throw new Error('Bu isimde bir rozet zaten var');
    }

    const badge = new this({
        name,
        slug,
        description,
        icon,
        color,
        type,
        category,
        rarity,
        requirements,
        rewards,
        metadata,
        display
    });

    return badge.save();
};

// Rozet güncelleme metodu
badgeSchema.methods.updateBadge = async function(updates) {
    const allowedUpdates = [
        'description',
        'icon',
        'color',
        'requirements',
        'rewards',
        'metadata',
        'display'
    ];

    Object.keys(updates).forEach(key => {
        if (allowedUpdates.includes(key)) {
            this[key] = updates[key];
        }
    });

    return this.save();
};

// Rozet silme metodu
badgeSchema.methods.deleteBadge = async function() {
    // Rozeti kullanan kullanıcıları kontrol et
    const User = mongoose.model('User');
    const usersWithBadge = await User.countDocuments({
        'badges.badge': this._id
    });

    if (usersWithBadge > 0) {
        throw new Error('Bu rozet hala kullanıcılar tarafından kullanılıyor');
    }

    return this.delete();
};

// Rozet detayları için public veri
badgeSchema.methods.toPublicJSON = function() {
    return {
        id: this._id,
        name: this.name,
        description: this.description,
        icon: this.icon,
        color: this.color,
        type: this.type,
        category: this.category,
        rarity: this.rarity,
        requirements: {
            type: this.requirements.type,
            duration: this.requirements.duration
        },
        rewards: this.rewards,
        metadata: {
            isHidden: this.metadata.isHidden,
            isStackable: this.metadata.isStackable,
            isTemporary: this.metadata.isTemporary,
            tags: this.metadata.tags
        },
        stats: {
            totalAwarded: this.stats.totalAwarded,
            currentHolders: this.stats.currentHolders,
            popularity: this.stats.popularity
        },
        display: {
            order: this.display.order,
            showInProfile: this.display.showInProfile,
            showInPosts: this.display.showInPosts,
            showInSignature: this.display.showInSignature
        },
        createdAt: this.createdAt,
        updatedAt: this.updatedAt
    };
};

// Rozet istatistiklerini güncelleme metodu
badgeSchema.methods.updateStats = async function() {
    const User = mongoose.model('User');
    
    // Mevcut sahip sayısını güncelle
    this.stats.currentHolders = await User.countDocuments({
        'badges.badge': this._id,
        'badges.revokedAt': null
    });

    // Popülerlik puanını güncelle
    this.stats.popularity = Math.floor(
        (this.stats.totalAwarded * 0.7) + 
        (this.stats.currentHolders * 0.3)
    );

    return this.save();
};

const Badge = mongoose.model('Badge', badgeSchema);

module.exports = Badge; 