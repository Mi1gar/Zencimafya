const mongoose = require('mongoose');

const achievementSchema = new mongoose.Schema({
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
            'milestone',    // Kilometre taşı
            'challenge',    // Görev
            'collection',   // Koleksiyon
            'social',       // Sosyal
            'content',      // İçerik
            'moderation',   // Moderatörlük
            'special',      // Özel
            'event',        // Etkinlik
            'seasonal',     // Sezonluk
            'custom'        // Özel
        ],
        required: true
    },
    category: {
        type: String,
        enum: [
            'general',      // Genel
            'beginner',     // Başlangıç
            'intermediate', // Orta
            'advanced',     // İleri
            'expert',       // Uzman
            'master',       // Usta
            'premium',      // Premium
            'system'        // Sistem
        ],
        required: true
    },
    difficulty: {
        type: String,
        enum: ['easy', 'medium', 'hard', 'expert', 'master'],
        default: 'medium'
    },
    points: {
        type: Number,
        required: true,
        min: 0,
        default: 0
    },
    progress: {
        type: {
            type: String,
            enum: [
                'manual',           // Manuel
                'post_count',       // Gönderi sayısı
                'topic_count',      // Konu sayısı
                'comment_count',    // Yorum sayısı
                'reputation',       // İtibar puanı
                'login_days',       // Giriş günleri
                'message_count',    // Mesaj sayısı
                'reaction_count',   // Tepki sayısı
                'report_count',     // Rapor sayısı
                'badge_count',      // Rozet sayısı
                'achievement_count',// Başarı sayısı
                'custom'           // Özel
            ],
            required: true
        },
        target: {
            type: Number,
            required: true,
            min: 1
        },
        current: {
            type: Number,
            default: 0,
            min: 0
        },
        steps: [{
            value: Number,
            reward: {
                points: Number,
                badges: [{
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'Badge'
                }],
                permissions: [String],
                custom: mongoose.Schema.Types.Mixed
            }
        }],
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
        badges: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Badge'
        }],
        permissions: [String],
        features: [String],
        reputation: Number,
        custom: mongoose.Schema.Types.Mixed
    },
    metadata: {
        isHidden: { type: Boolean, default: false },
        isRepeatable: { type: Boolean, default: false },
        maxRepeats: Number,
        cooldown: Number, // Gün cinsinden bekleme süresi
        startDate: Date,
        endDate: Date,
        prerequisites: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Achievement'
        }],
        version: String,
        tags: [String],
        customFields: mongoose.Schema.Types.Mixed
    },
    stats: {
        totalCompleted: { type: Number, default: 0 },
        currentHolders: { type: Number, default: 0 },
        lastCompleted: Date,
        averageTime: Number, // Ortalama tamamlama süresi (ms)
        completionRate: Number // Tamamlama oranı (%)
    },
    display: {
        order: { type: Number, default: 0 },
        showInProfile: { type: Boolean, default: true },
        showInProgress: { type: Boolean, default: true },
        showInLeaderboard: { type: Boolean, default: true },
        customCSS: String,
        customHTML: String
    }
}, {
    timestamps: true
});

// İndeksler
achievementSchema.index({ name: 1 });
achievementSchema.index({ slug: 1 });
achievementSchema.index({ type: 1, category: 1 });
achievementSchema.index({ difficulty: 1 });
achievementSchema.index({ points: -1 });
achievementSchema.index({ 'metadata.tags': 1 });
achievementSchema.index({ 'stats.totalCompleted': -1 });
achievementSchema.index({ 'display.order': 1 });

// Başarı arama metodu
achievementSchema.statics.search = async function(query = {}, options = {}) {
    const {
        type,
        category,
        difficulty,
        isHidden,
        limit = 50,
        skip = 0,
        sort = { 'display.order': 1, name: 1 }
    } = options;

    const searchQuery = { ...query };

    if (type) searchQuery.type = type;
    if (category) searchQuery.category = category;
    if (difficulty) searchQuery.difficulty = difficulty;
    if (typeof isHidden === 'boolean') searchQuery['metadata.isHidden'] = isHidden;

    return this.find(searchQuery)
        .populate('rewards.badges')
        .populate('metadata.prerequisites')
        .sort(sort)
        .skip(skip)
        .limit(limit);
};

// Başarı oluşturma yardımcı metodu
achievementSchema.statics.createAchievement = async function(data) {
    const {
        name,
        description,
        icon,
        color,
        type,
        category,
        difficulty,
        points,
        progress,
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
    const existingAchievement = await this.findOne({ slug });
    if (existingAchievement) {
        throw new Error('Bu isimde bir başarı zaten var');
    }

    const achievement = new this({
        name,
        slug,
        description,
        icon,
        color,
        type,
        category,
        difficulty,
        points,
        progress,
        rewards,
        metadata,
        display
    });

    return achievement.save();
};

// Başarı güncelleme metodu
achievementSchema.methods.updateAchievement = async function(updates) {
    const allowedUpdates = [
        'description',
        'icon',
        'color',
        'points',
        'progress',
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

// Başarı silme metodu
achievementSchema.methods.deleteAchievement = async function() {
    // Başarıyı kullanan kullanıcıları kontrol et
    const User = mongoose.model('User');
    const usersWithAchievement = await User.countDocuments({
        'achievements.achievement': this._id
    });

    if (usersWithAchievement > 0) {
        throw new Error('Bu başarı hala kullanıcılar tarafından kullanılıyor');
    }

    return this.delete();
};

// Başarı detayları için public veri
achievementSchema.methods.toPublicJSON = function() {
    return {
        id: this._id,
        name: this.name,
        description: this.description,
        icon: this.icon,
        color: this.color,
        type: this.type,
        category: this.category,
        difficulty: this.difficulty,
        points: this.points,
        progress: {
            type: this.progress.type,
            target: this.progress.target,
            current: this.progress.current,
            steps: this.progress.steps
        },
        rewards: {
            badges: this.rewards.badges,
            permissions: this.rewards.permissions,
            features: this.rewards.features,
            reputation: this.rewards.reputation
        },
        metadata: {
            isHidden: this.metadata.isHidden,
            isRepeatable: this.metadata.isRepeatable,
            maxRepeats: this.metadata.maxRepeats,
            cooldown: this.metadata.cooldown,
            tags: this.metadata.tags
        },
        stats: {
            totalCompleted: this.stats.totalCompleted,
            currentHolders: this.stats.currentHolders,
            averageTime: this.stats.averageTime,
            completionRate: this.stats.completionRate
        },
        display: {
            order: this.display.order,
            showInProfile: this.display.showInProfile,
            showInProgress: this.display.showInProgress,
            showInLeaderboard: this.display.showInLeaderboard
        },
        createdAt: this.createdAt,
        updatedAt: this.updatedAt
    };
};

// Başarı istatistiklerini güncelleme metodu
achievementSchema.methods.updateStats = async function() {
    const User = mongoose.model('User');
    
    // Mevcut sahip sayısını güncelle
    this.stats.currentHolders = await User.countDocuments({
        'achievements.achievement': this._id,
        'achievements.completedAt': { $ne: null }
    });

    // Tamamlama oranını güncelle
    const totalUsers = await User.countDocuments();
    this.stats.completionRate = totalUsers > 0 
        ? (this.stats.currentHolders / totalUsers) * 100 
        : 0;

    return this.save();
};

// İlerleme güncelleme metodu
achievementSchema.methods.updateProgress = async function(userId, value) {
    const User = mongoose.model('User');
    const user = await User.findById(userId);
    
    if (!user) {
        throw new Error('Kullanıcı bulunamadı');
    }

    const userAchievement = user.achievements.find(a => 
        a.achievement.toString() === this._id.toString()
    );

    if (!userAchievement) {
        // Yeni başarı kaydı oluştur
        user.achievements.push({
            achievement: this._id,
            progress: {
                current: value,
                steps: this.progress.steps.map(step => ({
                    value: step.value,
                    completed: value >= step.value
                }))
            },
            startedAt: new Date()
        });
    } else {
        // Mevcut ilerlemeyi güncelle
        userAchievement.progress.current = value;
        userAchievement.progress.steps = this.progress.steps.map(step => ({
            value: step.value,
            completed: value >= step.value
        }));

        // Tamamlanma kontrolü
        if (value >= this.progress.target && !userAchievement.completedAt) {
            userAchievement.completedAt = new Date();
            this.stats.totalCompleted++;
            this.stats.lastCompleted = new Date();

            // Ödülleri ver
            if (this.rewards.badges) {
                user.badges.push(...this.rewards.badges.map(badge => ({
                    badge,
                    awardedAt: new Date(),
                    awardedFor: `Başarı: ${this.name}`
                })));
            }

            if (this.rewards.permissions) {
                user.permissions.push(...this.rewards.permissions);
            }

            if (this.rewards.reputation) {
                user.stats.reputation += this.rewards.reputation;
            }

            // Aktivite kaydı oluştur
            const Activity = mongoose.model('Activity');
            await Activity.createActivity({
                user: userId,
                type: 'achievement_earn',
                target: {
                    type: 'achievement',
                    id: this._id
                },
                details: {
                    achievement: this.name,
                    points: this.points
                }
            });
        }
    }

    await user.save();
    await this.updateStats();

    return userAchievement;
};

const Achievement = mongoose.model('Achievement', achievementSchema);

module.exports = Achievement; 