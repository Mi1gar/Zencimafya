const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const analyticsSchema = new Schema({
    // Temel Alanlar
    name: {
        type: String,
        required: true,
        trim: true
    },
    code: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        index: true
    },
    type: {
        type: String,
        required: true,
        enum: [
            'user', 'topic', 'post', 'comment', 'message', 'category', 'tag',
            'forum', 'system', 'performance', 'custom'
        ]
    },
    period: {
        type: String,
        required: true,
        enum: ['hourly', 'daily', 'weekly', 'monthly', 'yearly', 'all'],
        default: 'daily'
    },
    date: {
        type: Date,
        required: true,
        index: true
    },
    // Hedef
    target: {
        type: {
            type: String,
            enum: ['user', 'topic', 'post', 'comment', 'message', 'category', 'tag', 'forum', 'system', 'custom']
        },
        id: Schema.Types.ObjectId,
        metadata: Schema.Types.Mixed
    },
    // Metrikler
    metrics: {
        users: {
            total: { type: Number, default: 0 },
            active: { type: Number, default: 0 },
            new: { type: Number, default: 0 },
            online: { type: Number, default: 0 },
            returning: { type: Number, default: 0 },
            churned: { type: Number, default: 0 }
        },
        topics: {
            total: { type: Number, default: 0 },
            new: { type: Number, default: 0 },
            active: { type: Number, default: 0 },
            locked: { type: Number, default: 0 },
            deleted: { type: Number, default: 0 }
        },
        posts: {
            total: { type: Number, default: 0 },
            new: { type: Number, default: 0 },
            edited: { type: Number, default: 0 },
            deleted: { type: Number, default: 0 }
        },
        comments: {
            total: { type: Number, default: 0 },
            new: { type: Number, default: 0 },
            deleted: { type: Number, default: 0 }
        },
        messages: {
            total: { type: Number, default: 0 },
            new: { type: Number, default: 0 },
            deleted: { type: Number, default: 0 }
        },
        interactions: {
            likes: { type: Number, default: 0 },
            reactions: { type: Number, default: 0 },
            reports: { type: Number, default: 0 },
            thanks: { type: Number, default: 0 },
            follows: { type: Number, default: 0 },
            bookmarks: { type: Number, default: 0 }
        },
        moderation: {
            warnings: { type: Number, default: 0 },
            bans: { type: Number, default: 0 },
            mutes: { type: Number, default: 0 },
            deleted: { type: Number, default: 0 }
        },
        system: {
            uptime: { type: Number, default: 0 },
            downtime: { type: Number, default: 0 },
            errors: { type: Number, default: 0 },
            performance: { type: Number, default: 0 },
            cacheHits: { type: Number, default: 0 },
            cacheMisses: { type: Number, default: 0 }
        },
        custom: Schema.Types.Mixed
    },
    // Metadata
    metadata: {
        description: String,
        tags: [String],
        category: String,
        source: String,
        version: String,
        custom: Schema.Types.Mixed
    },
    // Zaman Damgaları
    expiresAt: {
        type: Date,
        index: { expireAfterSeconds: 0 }
    }
}, {
    timestamps: true
});

// İndeksler
analyticsSchema.index({ type: 1, period: 1, date: 1 });
analyticsSchema.index({ 'target.type': 1, 'target.id': 1 });
analyticsSchema.index({ 'metadata.tags': 1 });
analyticsSchema.index({ createdAt: -1 });

// Statik Metodlar
analyticsSchema.statics.search = async function(query = {}, options = {}) {
    const {
        type,
        period,
        date,
        target,
        tags,
        startDate,
        endDate,
        limit = 50,
        skip = 0,
        sort = { createdAt: -1 }
    } = options;

    const filter = { ...query };

    if (type) filter.type = type;
    if (period) filter.period = period;
    if (date) filter.date = date;
    if (target) {
        filter['target.type'] = target.type;
        filter['target.id'] = target.id;
    }
    if (tags) filter['metadata.tags'] = { $in: tags };
    if (startDate || endDate) {
        filter.date = {};
        if (startDate) filter.date.$gte = startDate;
        if (endDate) filter.date.$lte = endDate;
    }

    return this.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit);
};

analyticsSchema.statics.createAnalytics = async function(data) {
    const analytics = new this(data);
    await analytics.save();
    return analytics;
};

analyticsSchema.statics.aggregateAnalytics = async function(pipeline) {
    return this.aggregate(pipeline);
};

// Instance Metodlar
analyticsSchema.methods.toPublicJSON = function() {
    return {
        id: this._id,
        name: this.name,
        code: this.code,
        type: this.type,
        period: this.period,
        date: this.date,
        target: this.target,
        metrics: this.metrics,
        metadata: this.metadata,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt
    };
};

analyticsSchema.methods.updateMetrics = async function(metrics) {
    this.metrics = { ...this.metrics, ...metrics };
    await this.save();
    return this;
};

analyticsSchema.methods.archive = async function() {
    this.expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 yıl sonra arşivle
    await this.save();
    return this;
};

const Analytics = mongoose.model('Analytics', analyticsSchema);

module.exports = Analytics; 