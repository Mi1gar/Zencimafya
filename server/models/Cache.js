const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const cacheSchema = new Schema({
    // Temel Alanlar
    key: {
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
            'data', 'view', 'query', 'session', 'token',
            'rate_limit', 'search', 'stats', 'config',
            'custom'
        ]
    },
    category: {
        type: String,
        required: true,
        enum: [
            'user', 'topic', 'post', 'comment', 'message',
            'category', 'tag', 'file', 'system', 'custom'
        ]
    },
    value: {
        type: Schema.Types.Mixed,
        required: true
    },
    metadata: {
        size: {
            type: Number,
            required: true,
            min: 0
        },
        format: {
            type: String,
            enum: ['json', 'string', 'buffer', 'number', 'boolean', 'custom'],
            default: 'json'
        },
        compression: {
            type: String,
            enum: ['none', 'gzip', 'deflate', 'custom'],
            default: 'none'
        },
        encoding: {
            type: String,
            default: 'utf-8'
        },
        version: String,
        tags: [{
            type: String,
            trim: true
        }]
    },
    target: {
        type: {
            type: String,
            enum: ['user', 'topic', 'post', 'comment', 'message', 'category', 'tag', 'file', 'system'],
            required: true
        },
        id: {
            type: Schema.Types.ObjectId,
            refPath: 'target.type'
        },
        query: Schema.Types.Mixed,
        params: Schema.Types.Mixed
    },
    dependencies: [{
        type: {
            type: String,
            enum: ['user', 'topic', 'post', 'comment', 'message', 'category', 'tag', 'file', 'system'],
            required: true
        },
        id: {
            type: Schema.Types.ObjectId,
            refPath: 'dependencies.type'
        },
        action: {
            type: String,
            enum: ['create', 'update', 'delete'],
            required: true
        }
    }],
    policy: {
        ttl: {
            type: Number,
            default: 3600 // 1 saat
        },
        maxAge: {
            type: Number,
            default: 86400 // 24 saat
        },
        staleWhileRevalidate: {
            type: Number,
            default: 300 // 5 dakika
        },
        staleIfError: {
            type: Number,
            default: 3600 // 1 saat
        },
        priority: {
            type: String,
            enum: ['low', 'medium', 'high', 'critical'],
            default: 'medium'
        },
        invalidation: {
            strategy: {
                type: String,
                enum: ['immediate', 'lazy', 'scheduled', 'custom'],
                default: 'lazy'
            },
            triggers: [{
                type: String,
                enum: ['time', 'event', 'dependency', 'manual', 'custom']
            }]
        }
    },
    stats: {
        hits: {
            type: Number,
            default: 0
        },
        misses: {
            type: Number,
            default: 0
        },
        lastHit: Date,
        lastMiss: Date,
        lastUpdate: Date,
        averageResponseTime: {
            type: Number,
            default: 0
        }
    },
    status: {
        type: String,
        enum: ['active', 'stale', 'expired', 'invalid', 'deleted'],
        default: 'active'
    },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    expiresAt: {
        type: Date,
        index: { expireAfterSeconds: 0 }
    }
}, {
    timestamps: true
});

// İndeksler
cacheSchema.index({ type: 1, category: 1 });
cacheSchema.index({ 'target.type': 1, 'target.id': 1 });
cacheSchema.index({ 'dependencies.type': 1, 'dependencies.id': 1 });
cacheSchema.index({ 'metadata.tags': 1 });
cacheSchema.index({ status: 1 });
cacheSchema.index({ 'policy.priority': 1 });

// Statik Metodlar
cacheSchema.statics.search = async function(query = {}, options = {}) {
    const {
        type,
        category,
        targetType,
        targetId,
        status,
        tags,
        limit = 50,
        skip = 0,
        sort = { createdAt: -1 }
    } = options;

    const filter = { ...query };

    if (type) filter.type = type;
    if (category) filter.category = category;
    if (targetType) filter['target.type'] = targetType;
    if (targetId) filter['target.id'] = targetId;
    if (status) filter.status = status;
    if (tags) filter['metadata.tags'] = { $in: tags };

    return this.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('target.id')
        .populate('dependencies.id');
};

cacheSchema.statics.get = async function(key, options = {}) {
    const cache = await this.findOne({ key });
    
    if (!cache) {
        return null;
    }

    if (cache.status === 'expired' || cache.status === 'invalid') {
        if (options.allowStale && cache.status === 'expired') {
            // Stale-while-revalidate stratejisi
            this.revalidate(cache).catch(console.error);
            return cache;
        }
        return null;
    }

    // Hit istatistiklerini güncelle
    cache.stats.hits++;
    cache.stats.lastHit = new Date();
    cache.stats.averageResponseTime = (
        (cache.stats.averageResponseTime * (cache.stats.hits - 1) + Date.now() - cache.updatedAt) /
        cache.stats.hits
    );
    await cache.save();

    return cache;
};

cacheSchema.statics.set = async function(key, value, options = {}) {
    const {
        type = 'data',
        category = 'custom',
        target,
        dependencies = [],
        policy = {},
        metadata = {}
    } = options;

    const cache = await this.findOne({ key }) || new this({ key });

    // Değeri güncelle
    cache.type = type;
    cache.category = category;
    cache.value = value;
    cache.target = target;
    cache.dependencies = dependencies;
    cache.policy = { ...cache.policy, ...policy };
    cache.metadata = { ...cache.metadata, ...metadata };
    cache.status = 'active';
    cache.stats.lastUpdate = new Date();

    // TTL ve maxAge hesapla
    const now = new Date();
    if (cache.policy.ttl) {
        cache.expiresAt = new Date(now.getTime() + cache.policy.ttl * 1000);
    }
    if (cache.policy.maxAge) {
        const maxAgeDate = new Date(now.getTime() + cache.policy.maxAge * 1000);
        if (!cache.expiresAt || maxAgeDate < cache.expiresAt) {
            cache.expiresAt = maxAgeDate;
        }
    }

    await cache.save();
    return cache;
};

cacheSchema.statics.invalidate = async function(options = {}) {
    const {
        type,
        category,
        targetType,
        targetId,
        tags,
        dependencies
    } = options;

    const filter = {};

    if (type) filter.type = type;
    if (category) filter.category = category;
    if (targetType) filter['target.type'] = targetType;
    if (targetId) filter['target.id'] = targetId;
    if (tags) filter['metadata.tags'] = { $in: tags };
    if (dependencies) {
        filter['dependencies'] = {
            $elemMatch: {
                type: dependencies.type,
                id: dependencies.id
            }
        };
    }

    const result = await this.updateMany(
        filter,
        {
            $set: {
                status: 'invalid',
                'stats.lastUpdate': new Date()
            }
        }
    );

    return result;
};

cacheSchema.statics.cleanup = async function(options = {}) {
    const {
        before,
        status,
        type,
        category
    } = options;

    const filter = {};

    if (before) filter.createdAt = { $lt: before };
    if (status) filter.status = status;
    if (type) filter.type = type;
    if (category) filter.category = category;

    return this.deleteMany(filter);
};

// Instance Metodlar
cacheSchema.methods.toPublicJSON = function() {
    return {
        key: this.key,
        type: this.type,
        category: this.category,
        metadata: {
            size: this.metadata.size,
            format: this.metadata.format,
            compression: this.metadata.compression,
            version: this.metadata.version,
            tags: this.metadata.tags
        },
        target: {
            type: this.target.type,
            id: this.target.id
        },
        policy: {
            ttl: this.policy.ttl,
            maxAge: this.policy.maxAge,
            priority: this.policy.priority,
            invalidation: {
                strategy: this.policy.invalidation.strategy
            }
        },
        stats: {
            hits: this.stats.hits,
            misses: this.stats.misses,
            lastHit: this.stats.lastHit,
            lastUpdate: this.stats.lastUpdate,
            averageResponseTime: this.stats.averageResponseTime
        },
        status: this.status,
        expiresAt: this.expiresAt,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt
    };
};

cacheSchema.methods.revalidate = async function() {
    // Önbelleği yeniden doğrula
    // Bu kısım gerçek yeniden doğrulama mantığını içerecek
    this.status = 'active';
    this.stats.lastUpdate = new Date();
    await this.save();
    return this;
};

cacheSchema.methods.invalidate = async function() {
    this.status = 'invalid';
    this.stats.lastUpdate = new Date();
    await this.save();
    return this;
};

const Cache = mongoose.model('Cache', cacheSchema);

module.exports = Cache; 