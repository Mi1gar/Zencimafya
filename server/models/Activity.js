const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        enum: [
            'login',           // Giriş yapma
            'logout',          // Çıkış yapma
            'register',        // Kayıt olma
            'profile_update',  // Profil güncelleme
            'topic_create',    // Konu oluşturma
            'topic_update',    // Konu güncelleme
            'topic_delete',    // Konu silme
            'post_create',     // Gönderi oluşturma
            'post_update',     // Gönderi güncelleme
            'post_delete',     // Gönderi silme
            'comment_create',  // Yorum oluşturma
            'comment_update',  // Yorum güncelleme
            'comment_delete',  // Yorum silme
            'message_send',    // Mesaj gönderme
            'message_read',    // Mesaj okuma
            'file_upload',     // Dosya yükleme
            'file_delete',     // Dosya silme
            'report_create',   // Rapor oluşturma
            'report_update',   // Rapor güncelleme
            'report_resolve',  // Rapor çözümleme
            'ban_user',        // Kullanıcı yasaklama
            'unban_user',      // Kullanıcı yasağını kaldırma
            'warn_user',       // Kullanıcı uyarısı
            'role_change',     // Rol değişikliği
            'setting_change',  // Ayar değişikliği
            'password_change', // Şifre değişikliği
            'email_change',    // E-posta değişikliği
            'avatar_change',   // Avatar değişikliği
            'badge_earn',      // Rozet kazanma
            'achievement_earn' // Başarı kazanma
        ],
        required: true
    },
    target: {
        type: {
            type: String,
            enum: ['user', 'topic', 'post', 'comment', 'message', 'file', 'report', 'setting', 'badge', 'achievement'],
            required: true
        },
        id: {
            type: mongoose.Schema.Types.ObjectId,
            required: true
        }
    },
    details: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    ip: {
        type: String,
        trim: true
    },
    userAgent: {
        type: String,
        trim: true
    },
    location: {
        country: String,
        city: String,
        coordinates: {
            type: [Number], // [longitude, latitude]
            index: '2dsphere'
        }
    },
    metadata: {
        browser: String,
        os: String,
        device: String,
        isMobile: Boolean,
        isBot: Boolean,
        referrer: String,
        sessionId: String,
        duration: Number, // İşlem süresi (ms)
        status: {
            type: String,
            enum: ['success', 'failed', 'pending'],
            default: 'success'
        },
        error: String,
        tags: [String]
    },
    visibility: {
        type: String,
        enum: ['public', 'private', 'system'],
        default: 'public'
    },
    importance: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium'
    }
}, {
    timestamps: true
});

// İndeksler
activitySchema.index({ user: 1, createdAt: -1 });
activitySchema.index({ type: 1, createdAt: -1 });
activitySchema.index({ 'target.type': 1, 'target.id': 1 });
activitySchema.index({ 'metadata.status': 1 });
activitySchema.index({ visibility: 1 });
activitySchema.index({ importance: 1 });
activitySchema.index({ 'location.coordinates': '2dsphere' });

// Aktivite arama metodu
activitySchema.statics.search = async function(query = {}, options = {}) {
    const {
        user,
        type,
        targetType,
        targetId,
        startDate,
        endDate,
        status,
        visibility,
        importance,
        limit = 50,
        skip = 0,
        sort = { createdAt: -1 }
    } = options;

    const searchQuery = { ...query };

    if (user) searchQuery.user = user;
    if (type) searchQuery.type = type;
    if (targetType) searchQuery['target.type'] = targetType;
    if (targetId) searchQuery['target.id'] = targetId;
    if (startDate || endDate) {
        searchQuery.createdAt = {};
        if (startDate) searchQuery.createdAt.$gte = startDate;
        if (endDate) searchQuery.createdAt.$lte = endDate;
    }
    if (status) searchQuery['metadata.status'] = status;
    if (visibility) searchQuery.visibility = visibility;
    if (importance) searchQuery.importance = importance;

    return this.find(searchQuery)
        .populate('user', 'username avatar')
        .sort(sort)
        .skip(skip)
        .limit(limit);
};

// Kullanıcı aktivite özeti
activitySchema.statics.getUserActivitySummary = async function(userId, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const activities = await this.aggregate([
        {
            $match: {
                user: mongoose.Types.ObjectId(userId),
                createdAt: { $gte: startDate }
            }
        },
        {
            $group: {
                _id: {
                    type: '$type',
                    date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
                },
                count: { $sum: 1 }
            }
        },
        {
            $group: {
                _id: '$_id.type',
                dailyActivity: {
                    $push: {
                        date: '$_id.date',
                        count: '$count'
                    }
                },
                totalCount: { $sum: '$count' }
            }
        }
    ]);

    return activities;
};

// Aktivite detayları için public veri
activitySchema.methods.toPublicJSON = function() {
    return {
        id: this._id,
        type: this.type,
        target: this.target,
        details: this.details,
        metadata: {
            browser: this.metadata.browser,
            os: this.metadata.os,
            device: this.metadata.device,
            isMobile: this.metadata.isMobile,
            status: this.metadata.status,
            tags: this.metadata.tags
        },
        visibility: this.visibility,
        importance: this.importance,
        createdAt: this.createdAt
    };
};

// Aktivite oluşturma yardımcı metodu
activitySchema.statics.createActivity = async function(data) {
    const {
        user,
        type,
        target,
        details = {},
        ip,
        userAgent,
        location,
        metadata = {},
        visibility = 'public',
        importance = 'medium'
    } = data;

    const activity = new this({
        user,
        type,
        target,
        details,
        ip,
        userAgent,
        location,
        metadata,
        visibility,
        importance
    });

    return activity.save();
};

// Toplu aktivite silme metodu
activitySchema.statics.bulkDelete = async function(query, userId) {
    const activities = await this.find(query);
    
    // Silme işlemi için yeni aktivite oluştur
    await this.createActivity({
        user: userId,
        type: 'activity_delete',
        target: {
            type: 'activity',
            id: null
        },
        details: {
            deletedCount: activities.length,
            query
        },
        visibility: 'system',
        importance: 'high'
    });

    return this.deleteMany(query);
};

const Activity = mongoose.model('Activity', activitySchema);

module.exports = Activity; 