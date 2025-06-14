const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const logSchema = new Schema({
    // Temel Alanlar
    type: {
        type: String,
        required: true,
        enum: [
            'auth', 'user', 'topic', 'post', 'comment', 'message', 'category', 'tag',
            'forum', 'system', 'api', 'webhook', 'integration', 'payment', 'subscription',
            'performance', 'security', 'custom'
        ]
    },
    level: {
        type: String,
        required: true,
        enum: ['debug', 'info', 'warn', 'error', 'fatal'],
        default: 'info'
    },
    message: {
        type: String,
        required: true
    },
    source: {
        type: String,
        enum: ['web', 'mobile', 'api', 'system', 'custom']
    },
    target: {
        type: {
            type: String,
            enum: [
                'user', 'topic', 'post', 'comment', 'message', 'category', 'tag',
                'forum', 'system', 'api', 'webhook', 'integration', 'payment', 'subscription',
                'custom'
            ]
        },
        id: Schema.Types.ObjectId,
        metadata: Schema.Types.Mixed
    },
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        index: true
    },
    ip: String,
    userAgent: String,
    location: {
        country: String,
        city: String,
        coordinates: {
            type: [Number],
            index: '2dsphere'
        }
    },
    // Metadata
    metadata: {
        browser: String,
        os: String,
        device: String,
        session: String,
        request: Schema.Types.Mixed,
        response: Schema.Types.Mixed,
        error: Schema.Types.Mixed,
        performance: Schema.Types.Mixed,
        tags: [String],
        context: Schema.Types.Mixed
    },
    // Tutma Politikası
    retention: {
        period: Number, // gün cinsinden
        expiresAt: {
            type: Date,
            index: { expireAfterSeconds: 0 }
        },
        archived: {
            type: Boolean,
            default: false
        }
    }
}, {
    timestamps: true
});

// İndeksler
logSchema.index({ type: 1, level: 1, createdAt: -1 });
logSchema.index({ user: 1, createdAt: -1 });
logSchema.index({ ip: 1, createdAt: -1 });
logSchema.index({ 'target.type': 1, 'target.id': 1 });
logSchema.index({ 'metadata.tags': 1 });
logSchema.index({ 'retention.expiresAt': 1 });
logSchema.index({ createdAt: -1 });

// Statik Metodlar
logSchema.statics.search = async function(query = {}, options = {}) {
    const {
        type,
        level,
        user,
        ip,
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
    if (level) filter.level = level;
    if (user) filter.user = user;
    if (ip) filter.ip = ip;
    if (target) {
        filter['target.type'] = target.type;
        filter['target.id'] = target.id;
    }
    if (tags) filter['metadata.tags'] = { $in: tags };
    if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = startDate;
        if (endDate) filter.createdAt.$lte = endDate;
    }

    return this.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('user', 'username email');
};

logSchema.statics.createLog = async function(data) {
    const log = new this(data);
    await log.save();
    return log;
};

logSchema.statics.bulkCreate = async function(logs) {
    return this.insertMany(logs);
};

logSchema.statics.cleanup = async function(days = 90) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return this.deleteMany({ createdAt: { $lt: cutoff } });
};

logSchema.statics.getStats = async function(filter = {}) {
    return this.aggregate([
        { $match: filter },
        {
            $group: {
                _id: { type: '$type', level: '$level' },
                count: { $sum: 1 }
            }
        }
    ]);
};

// Instance Metodlar
logSchema.methods.toPublicJSON = function() {
    return {
        id: this._id,
        type: this.type,
        level: this.level,
        message: this.message,
        source: this.source,
        target: this.target,
        user: this.user,
        ip: this.ip,
        userAgent: this.userAgent,
        location: this.location,
        metadata: this.metadata,
        retention: this.retention,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt
    };
};

logSchema.methods.archive = async function() {
    this.retention.archived = true;
    await this.save();
    return this;
};

const Log = mongoose.model('Log', logSchema);

module.exports = Log; 