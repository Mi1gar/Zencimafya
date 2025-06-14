const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const rateLimitSchema = new Schema({
    // Temel Alanlar
    key: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    type: {
        type: String,
        required: true,
        enum: [
            'ip', 'user', 'endpoint', 'action', 'resource',
            'api', 'auth', 'search', 'upload', 'custom'
        ]
    },
    target: {
        type: {
            type: String,
            enum: ['ip', 'user', 'endpoint', 'action', 'resource'],
            required: true
        },
        value: {
            type: String,
            required: true
        },
        metadata: {
            ip: String,
            userAgent: String,
            country: String,
            city: String,
            coordinates: {
                type: [Number],
                index: '2dsphere'
            }
        }
    },
    limits: {
        window: {
            type: Number,
            required: true,
            min: 1
        },
        max: {
            type: Number,
            required: true,
            min: 1
        },
        current: {
            type: Number,
            default: 0,
            min: 0
        },
        burst: {
            type: Number,
            default: 0,
            min: 0
        },
        cost: {
            type: Number,
            default: 1,
            min: 1
        }
    },
    policy: {
        strategy: {
            type: String,
            enum: ['fixed', 'sliding', 'token_bucket', 'leaky_bucket', 'custom'],
            default: 'sliding'
        },
        blockDuration: {
            type: Number,
            default: 3600, // 1 saat
            min: 0
        },
        resetOnSuccess: {
            type: Boolean,
            default: false
        },
        bypass: [{
            type: {
                type: String,
                enum: ['ip', 'user', 'role', 'header', 'custom'],
                required: true
            },
            value: String,
            reason: String
        }],
        fallback: {
            type: String,
            enum: ['block', 'delay', 'queue', 'custom'],
            default: 'block'
        }
    },
    stats: {
        total: {
            type: Number,
            default: 0
        },
        blocked: {
            type: Number,
            default: 0
        },
        lastRequest: Date,
        lastBlock: Date,
        averageResponseTime: {
            type: Number,
            default: 0
        }
    },
    history: [{
        timestamp: {
            type: Date,
            required: true
        },
        action: {
            type: String,
            enum: ['allow', 'block', 'bypass', 'reset'],
            required: true
        },
        cost: {
            type: Number,
            default: 1
        },
        responseTime: Number,
        metadata: Schema.Types.Mixed
    }],
    status: {
        type: String,
        enum: ['active', 'blocked', 'bypassed', 'disabled'],
        default: 'active'
    },
    blockUntil: {
        type: Date,
        index: { expireAfterSeconds: 0 }
    },
    metadata: {
        description: String,
        tags: [{
            type: String,
            trim: true
        }],
        priority: {
            type: String,
            enum: ['low', 'medium', 'high', 'critical'],
            default: 'medium'
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: 'User'
        }
    }
}, {
    timestamps: true
});

// İndeksler
rateLimitSchema.index({ type: 1, 'target.type': 1, 'target.value': 1 });
rateLimitSchema.index({ 'target.metadata.ip': 1 });
rateLimitSchema.index({ 'metadata.tags': 1 });
rateLimitSchema.index({ status: 1 });
rateLimitSchema.index({ 'metadata.priority': 1 });

// Statik Metodlar
rateLimitSchema.statics.search = async function(query = {}, options = {}) {
    const {
        type,
        targetType,
        targetValue,
        status,
        tags,
        limit = 50,
        skip = 0,
        sort = { createdAt: -1 }
    } = options;

    const filter = { ...query };

    if (type) filter.type = type;
    if (targetType) filter['target.type'] = targetType;
    if (targetValue) filter['target.value'] = targetValue;
    if (status) filter.status = status;
    if (tags) filter['metadata.tags'] = { $in: tags };

    return this.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('metadata.createdBy', 'username avatar');
};

rateLimitSchema.statics.check = async function(key, options = {}) {
    const {
        type = 'ip',
        target,
        cost = 1
    } = options;

    let rateLimit = await this.findOne({ key });

    if (!rateLimit) {
        // Varsayılan limitleri kullan
        rateLimit = new this({
            key,
            type,
            target,
            limits: {
                window: 3600, // 1 saat
                max: 1000, // 1000 istek
                current: 0,
                cost: 1
            }
        });
    }

    // Engellenmiş mi kontrol et
    if (rateLimit.status === 'blocked') {
        if (rateLimit.blockUntil && rateLimit.blockUntil > new Date()) {
            rateLimit.stats.blocked++;
            rateLimit.stats.lastBlock = new Date();
            rateLimit.history.push({
                timestamp: new Date(),
                action: 'block',
                cost,
                metadata: { reason: 'blocked' }
            });
            await rateLimit.save();
            return { allowed: false, reason: 'blocked' };
        } else {
            rateLimit.status = 'active';
        }
    }

    // Bypass kontrolü
    if (rateLimit.policy.bypass) {
        for (const bypass of rateLimit.policy.bypass) {
            if (this.checkBypass(bypass, target)) {
                rateLimit.history.push({
                    timestamp: new Date(),
                    action: 'bypass',
                    cost,
                    metadata: { reason: bypass.reason }
                });
                await rateLimit.save();
                return { allowed: true, reason: 'bypassed' };
            }
        }
    }

    // Limit kontrolü
    const now = new Date();
    const windowStart = new Date(now.getTime() - rateLimit.limits.window * 1000);

    // Eski istekleri temizle
    rateLimit.history = rateLimit.history.filter(h => h.timestamp > windowStart);
    rateLimit.limits.current = rateLimit.history.reduce((sum, h) => sum + h.cost, 0);

    if (rateLimit.limits.current + cost > rateLimit.limits.max) {
        // Limit aşıldı
        rateLimit.status = 'blocked';
        rateLimit.blockUntil = new Date(now.getTime() + rateLimit.policy.blockDuration * 1000);
        rateLimit.stats.blocked++;
        rateLimit.stats.lastBlock = now;
        rateLimit.history.push({
            timestamp: now,
            action: 'block',
            cost,
            metadata: { reason: 'limit_exceeded' }
        });
        await rateLimit.save();
        return { allowed: false, reason: 'limit_exceeded' };
    }

    // İsteğe izin ver
    rateLimit.limits.current += cost;
    rateLimit.stats.total++;
    rateLimit.stats.lastRequest = now;
    rateLimit.history.push({
        timestamp: now,
        action: 'allow',
        cost,
        metadata: { success: true }
    });

    if (rateLimit.policy.resetOnSuccess) {
        rateLimit.limits.current = 0;
    }

    await rateLimit.save();
    return { allowed: true, reason: 'allowed' };
};

rateLimitSchema.statics.checkBypass = function(bypass, target) {
    switch (bypass.type) {
        case 'ip':
            return target.metadata?.ip === bypass.value;
        case 'user':
            return target.value === bypass.value;
        case 'role':
            return target.metadata?.roles?.includes(bypass.value);
        case 'header':
            return target.metadata?.headers?.[bypass.value] !== undefined;
        default:
            return false;
    }
};

rateLimitSchema.statics.reset = async function(key) {
    const rateLimit = await this.findOne({ key });
    if (!rateLimit) return null;

    rateLimit.limits.current = 0;
    rateLimit.status = 'active';
    rateLimit.blockUntil = null;
    rateLimit.history.push({
        timestamp: new Date(),
        action: 'reset',
        metadata: { reason: 'manual_reset' }
    });

    await rateLimit.save();
    return rateLimit;
};

// Instance Metodlar
rateLimitSchema.methods.toPublicJSON = function() {
    return {
        key: this.key,
        type: this.type,
        target: {
            type: this.target.type,
            value: this.target.value,
            metadata: {
                ip: this.target.metadata.ip,
                country: this.target.metadata.country,
                city: this.target.metadata.city
            }
        },
        limits: {
            window: this.limits.window,
            max: this.limits.max,
            current: this.limits.current,
            burst: this.limits.burst,
            cost: this.limits.cost
        },
        policy: {
            strategy: this.policy.strategy,
            blockDuration: this.policy.blockDuration,
            resetOnSuccess: this.policy.resetOnSuccess,
            fallback: this.policy.fallback
        },
        stats: {
            total: this.stats.total,
            blocked: this.stats.blocked,
            lastRequest: this.stats.lastRequest,
            lastBlock: this.stats.lastBlock,
            averageResponseTime: this.stats.averageResponseTime
        },
        status: this.status,
        blockUntil: this.blockUntil,
        metadata: {
            description: this.metadata.description,
            tags: this.metadata.tags,
            priority: this.metadata.priority
        },
        createdAt: this.createdAt,
        updatedAt: this.updatedAt
    };
};

rateLimitSchema.methods.block = async function(duration = this.policy.blockDuration) {
    this.status = 'blocked';
    this.blockUntil = new Date(Date.now() + duration * 1000);
    this.stats.blocked++;
    this.stats.lastBlock = new Date();
    this.history.push({
        timestamp: new Date(),
        action: 'block',
        metadata: { reason: 'manual_block' }
    });
    await this.save();
    return this;
};

rateLimitSchema.methods.unblock = async function() {
    this.status = 'active';
    this.blockUntil = null;
    this.history.push({
        timestamp: new Date(),
        action: 'allow',
        metadata: { reason: 'manual_unblock' }
    });
    await this.save();
    return this;
};

const RateLimit = mongoose.model('RateLimit', rateLimitSchema);

module.exports = RateLimit; 