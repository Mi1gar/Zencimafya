const mongoose = require('mongoose');

const statsSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: [
            'user',          // Kullanıcı istatistikleri
            'topic',         // Konu istatistikleri
            'category',      // Kategori istatistikleri
            'forum',         // Forum istatistikleri
            'system',        // Sistem istatistikleri
            'activity',      // Aktivite istatistikleri
            'content',       // İçerik istatistikleri
            'moderation',    // Moderatörlük istatistikleri
            'performance',   // Performans istatistikleri
            'custom'         // Özel istatistikler
        ],
        required: true
    },
    target: {
        type: {
            type: String,
            enum: ['user', 'topic', 'category', 'forum', 'system'],
            required: true
        },
        id: {
            type: mongoose.Schema.Types.ObjectId,
            required: true
        }
    },
    period: {
        type: String,
        enum: ['hourly', 'daily', 'weekly', 'monthly', 'yearly', 'all'],
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    metrics: {
        // Kullanıcı metrikleri
        users: {
            total: { type: Number, default: 0 },
            active: { type: Number, default: 0 },
            new: { type: Number, default: 0 },
            online: { type: Number, default: 0 },
            banned: { type: Number, default: 0 },
            verified: { type: Number, default: 0 },
            premium: { type: Number, default: 0 }
        },
        // Konu metrikleri
        topics: {
            total: { type: Number, default: 0 },
            active: { type: Number, default: 0 },
            new: { type: Number, default: 0 },
            locked: { type: Number, default: 0 },
            deleted: { type: Number, default: 0 },
            byCategory: { type: Map, of: Number, default: new Map() }
        },
        // Gönderi metrikleri
        posts: {
            total: { type: Number, default: 0 },
            new: { type: Number, default: 0 },
            edited: { type: Number, default: 0 },
            deleted: { type: Number, default: 0 },
            byCategory: { type: Map, of: Number, default: new Map() }
        },
        // Yorum metrikleri
        comments: {
            total: { type: Number, default: 0 },
            new: { type: Number, default: 0 },
            edited: { type: Number, default: 0 },
            deleted: { type: Number, default: 0 }
        },
        // Mesaj metrikleri
        messages: {
            total: { type: Number, default: 0 },
            new: { type: Number, default: 0 },
            read: { type: Number, default: 0 },
            unread: { type: Number, default: 0 }
        },
        // Etkileşim metrikleri
        interactions: {
            likes: { type: Number, default: 0 },
            dislikes: { type: Number, default: 0 },
            reactions: { type: Number, default: 0 },
            reports: { type: Number, default: 0 },
            mentions: { type: Number, default: 0 },
            quotes: { type: Number, default: 0 }
        },
        // Moderatörlük metrikleri
        moderation: {
            reports: {
                total: { type: Number, default: 0 },
                pending: { type: Number, default: 0 },
                resolved: { type: Number, default: 0 },
                rejected: { type: Number, default: 0 }
            },
            actions: {
                warnings: { type: Number, default: 0 },
                bans: { type: Number, default: 0 },
                unbans: { type: Number, default: 0 },
                deletions: { type: Number, default: 0 },
                edits: { type: Number, default: 0 }
            }
        },
        // Sistem metrikleri
        system: {
            performance: {
                responseTime: { type: Number, default: 0 },
                cpuUsage: { type: Number, default: 0 },
                memoryUsage: { type: Number, default: 0 },
                diskUsage: { type: Number, default: 0 }
            },
            errors: {
                total: { type: Number, default: 0 },
                critical: { type: Number, default: 0 },
                warnings: { type: Number, default: 0 }
            },
            cache: {
                hits: { type: Number, default: 0 },
                misses: { type: Number, default: 0 },
                size: { type: Number, default: 0 }
            }
        },
        // Özel metrikler
        custom: {
            type: Map,
            of: mongoose.Schema.Types.Mixed,
            default: new Map()
        }
    },
    metadata: {
        isAggregated: { type: Boolean, default: false },
        aggregationMethod: String,
        source: String,
        tags: [String],
        notes: String,
        customFields: mongoose.Schema.Types.Mixed
    }
}, {
    timestamps: true
});

// İndeksler
statsSchema.index({ type: 1, 'target.type': 1, 'target.id': 1, period: 1, date: 1 });
statsSchema.index({ period: 1, date: 1 });
statsSchema.index({ 'metadata.tags': 1 });
statsSchema.index({ 'metadata.isAggregated': 1 });

// İstatistik arama metodu
statsSchema.statics.search = async function(query = {}, options = {}) {
    const {
        type,
        targetType,
        targetId,
        period,
        startDate,
        endDate,
        isAggregated,
        limit = 50,
        skip = 0,
        sort = { date: -1 }
    } = options;

    const searchQuery = { ...query };

    if (type) searchQuery.type = type;
    if (targetType) searchQuery['target.type'] = targetType;
    if (targetId) searchQuery['target.id'] = targetId;
    if (period) searchQuery.period = period;
    if (typeof isAggregated === 'boolean') searchQuery['metadata.isAggregated'] = isAggregated;
    if (startDate || endDate) {
        searchQuery.date = {};
        if (startDate) searchQuery.date.$gte = startDate;
        if (endDate) searchQuery.date.$lte = endDate;
    }

    return this.find(searchQuery)
        .sort(sort)
        .skip(skip)
        .limit(limit);
};

// İstatistik oluşturma yardımcı metodu
statsSchema.statics.createStats = async function(data) {
    const {
        type,
        target,
        period,
        date,
        metrics,
        metadata = {}
    } = data;

    const stats = new this({
        type,
        target,
        period,
        date,
        metrics,
        metadata
    });

    return stats.save();
};

// İstatistik güncelleme metodu
statsSchema.methods.updateStats = async function(updates) {
    const allowedUpdates = ['metrics', 'metadata'];

    Object.keys(updates).forEach(key => {
        if (allowedUpdates.includes(key)) {
            if (key === 'metrics') {
                // Metrikleri birleştir
                Object.keys(updates.metrics).forEach(metricKey => {
                    if (this.metrics[metricKey]) {
                        if (typeof this.metrics[metricKey] === 'object') {
                            this.metrics[metricKey] = {
                                ...this.metrics[metricKey],
                                ...updates.metrics[metricKey]
                            };
                        } else {
                            this.metrics[metricKey] = updates.metrics[metricKey];
                        }
                    } else {
                        this.metrics[metricKey] = updates.metrics[metricKey];
                    }
                });
            } else {
                this[key] = updates[key];
            }
        }
    });

    return this.save();
};

// İstatistik toplama metodu
statsSchema.statics.aggregateStats = async function(query, options = {}) {
    const {
        period,
        startDate,
        endDate,
        groupBy = ['type', 'target.type', 'target.id'],
        metrics = []
    } = options;

    const matchStage = { ...query };
    if (period) matchStage.period = period;
    if (startDate || endDate) {
        matchStage.date = {};
        if (startDate) matchStage.date.$gte = startDate;
        if (endDate) matchStage.date.$lte = endDate;
    }

    const groupStage = {
        _id: {}
    };

    // Gruplama alanlarını ekle
    groupBy.forEach(field => {
        groupStage._id[field] = `$${field}`;
    });

    // Metrikleri ekle
    metrics.forEach(metric => {
        const path = metric.split('.');
        const field = path[path.length - 1];
        groupStage[field] = { $sum: `$metrics.${metric}` };
    });

    const result = await this.aggregate([
        { $match: matchStage },
        { $group: groupStage },
        { $sort: { '_id.date': -1 } }
    ]);

    return result;
};

// İstatistik detayları için public veri
statsSchema.methods.toPublicJSON = function() {
    return {
        id: this._id,
        type: this.type,
        target: this.target,
        period: this.period,
        date: this.date,
        metrics: this.metrics,
        metadata: {
            isAggregated: this.metadata.isAggregated,
            aggregationMethod: this.metadata.aggregationMethod,
            source: this.metadata.source,
            tags: this.metadata.tags
        },
        createdAt: this.createdAt,
        updatedAt: this.updatedAt
    };
};

// Toplu istatistik güncelleme
statsSchema.statics.bulkUpdate = async function(query, updates) {
    const result = await this.updateMany(query, { $set: updates });
    
    // Aktivite kaydı oluştur
    const Activity = mongoose.model('Activity');
    await Activity.createActivity({
        type: 'stats_bulk_update',
        target: {
            type: 'system',
            id: null
        },
        details: {
            query,
            updates,
            modifiedCount: result.nModified
        },
        visibility: 'system'
    });

    return result;
};

// Eski istatistikleri temizleme
statsSchema.statics.cleanup = async function(options = {}) {
    const {
        period,
        olderThan,
        keepAggregated = true
    } = options;

    const query = {};
    if (period) query.period = period;
    if (olderThan) query.date = { $lt: olderThan };
    if (keepAggregated) query['metadata.isAggregated'] = false;

    const result = await this.deleteMany(query);
    
    // Aktivite kaydı oluştur
    const Activity = mongoose.model('Activity');
    await Activity.createActivity({
        type: 'stats_cleanup',
        target: {
            type: 'system',
            id: null
        },
        details: {
            query,
            deletedCount: result.deletedCount
        },
        visibility: 'system'
    });

    return result;
};

const Stats = mongoose.model('Stats', statsSchema);

module.exports = Stats; 