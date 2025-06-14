const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const crypto = require('crypto');

const apiSchema = new Schema({
    // Temel Alanlar
    key: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    secret: {
        type: String,
        required: true,
        select: false
    },
    name: {
        type: String,
        required: true
    },
    description: String,
    owner: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        required: true,
        enum: [
            'public', 'private', 'internal', 'partner',
            'system', 'custom'
        ]
    },
    status: {
        type: String,
        required: true,
        enum: [
            'active', 'inactive', 'suspended', 'revoked',
            'expired', 'deleted'
        ],
        default: 'active'
    },
    version: {
        type: String,
        required: true,
        default: '1.0.0'
    },
    endpoints: [{
        path: {
            type: String,
            required: true
        },
        method: {
            type: String,
            enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
            required: true
        },
        rateLimit: {
            window: Number,
            max: Number
        },
        auth: {
            required: {
                type: Boolean,
                default: true
            },
            scopes: [String]
        },
        deprecated: {
            type: Boolean,
            default: false
        },
        deprecatedAt: Date,
        deprecatedReason: String
    }],
    permissions: {
        scopes: [{
            type: String
        }],
        roles: [{
            type: String
        }],
        restrictions: [{
            type: {
                type: String,
                enum: [
                    'ip', 'domain', 'time', 'quota',
                    'endpoint', 'method', 'custom'
                ]
            },
            value: Schema.Types.Mixed,
            reason: String
        }]
    },
    quota: {
        daily: {
            type: Number,
            default: 1000
        },
        monthly: {
            type: Number,
            default: 30000
        },
        used: {
            daily: {
                type: Number,
                default: 0
            },
            monthly: {
                type: Number,
                default: 0
            }
        },
        resetAt: {
            daily: Date,
            monthly: Date
        }
    },
    security: {
        ipWhitelist: [{
            ip: String,
            description: String,
            addedAt: Date
        }],
        domains: [{
            domain: String,
            verified: {
                type: Boolean,
                default: false
            },
            verifiedAt: Date
        }],
        webhooks: [{
            url: String,
            secret: String,
            events: [String],
            status: {
                type: String,
                enum: ['active', 'inactive', 'failed'],
                default: 'active'
            },
            lastTriggered: Date,
            failureCount: {
                type: Number,
                default: 0
            }
        }],
        oauth: {
            enabled: {
                type: Boolean,
                default: false
            },
            clientId: String,
            clientSecret: String,
            redirectUris: [String],
            grants: [{
                type: String,
                enum: ['authorization_code', 'client_credentials', 'refresh_token']
            }]
        }
    },
    monitoring: {
        enabled: {
            type: Boolean,
            default: true
        },
        alerts: [{
            type: {
                type: String,
                enum: [
                    'error_rate', 'response_time', 'quota',
                    'security', 'custom'
                ]
            },
            threshold: Number,
            condition: {
                type: String,
                enum: ['gt', 'lt', 'eq', 'gte', 'lte']
            },
            channels: [{
                type: {
                    type: String,
                    enum: ['email', 'webhook', 'slack', 'custom']
                },
                target: String,
                enabled: {
                    type: Boolean,
                    default: true
                }
            }]
        }],
        metrics: {
            requests: {
                total: {
                    type: Number,
                    default: 0
                },
                success: {
                    type: Number,
                    default: 0
                },
                failed: {
                    type: Number,
                    default: 0
                }
            },
            responseTime: {
                avg: Number,
                min: Number,
                max: Number,
                p95: Number,
                p99: Number
            },
            errors: [{
                code: String,
                message: String,
                count: Number,
                lastOccurred: Date
            }]
        }
    },
    metadata: {
        tags: [String],
        environment: {
            type: String,
            enum: ['development', 'staging', 'production'],
            default: 'development'
        },
        documentation: {
            url: String,
            version: String,
            lastUpdated: Date
        },
        custom: Schema.Types.Mixed
    },
    expiresAt: {
        type: Date,
        required: true,
        index: { expireAfterSeconds: 0 }
    }
}, {
    timestamps: true
});

// İndeksler
apiSchema.index({ owner: 1, status: 1 });
apiSchema.index({ 'security.domains.domain': 1 });
apiSchema.index({ 'metadata.tags': 1 });
apiSchema.index({ 'monitoring.metrics.requests.total': -1 });

// Statik Metodlar
apiSchema.statics.generateKeyPair = function() {
    const key = crypto.randomBytes(32).toString('hex');
    const secret = crypto.randomBytes(64).toString('hex');
    return { key, secret };
};

apiSchema.statics.search = async function(query = {}, options = {}) {
    const {
        owner,
        type,
        status,
        environment,
        limit = 50,
        skip = 0,
        sort = { createdAt: -1 }
    } = options;

    const filter = { ...query };

    if (owner) filter.owner = owner;
    if (type) filter.type = type;
    if (status) filter.status = status;
    if (environment) filter['metadata.environment'] = environment;

    return this.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('owner', 'username email');
};

apiSchema.statics.createAPI = async function(data) {
    const { key, secret } = this.generateKeyPair();
    const api = new this({
        ...data,
        key,
        secret
    });
    await api.save();
    return api;
};

apiSchema.statics.revokeAllKeys = async function(ownerId, reason = 'manual_revoke') {
    const apis = await this.find({
        owner: ownerId,
        status: 'active'
    });

    for (const api of apis) {
        api.status = 'revoked';
        api.metadata.custom = {
            ...api.metadata.custom,
            revokedAt: new Date(),
            revokedReason: reason
        };
        await api.save();
    }

    return apis;
};

// Instance Metodlar
apiSchema.methods.toPublicJSON = function() {
    return {
        id: this._id,
        key: this.key,
        name: this.name,
        description: this.description,
        type: this.type,
        status: this.status,
        version: this.version,
        endpoints: this.endpoints.map(endpoint => ({
            path: endpoint.path,
            method: endpoint.method,
            rateLimit: endpoint.rateLimit,
            auth: endpoint.auth,
            deprecated: endpoint.deprecated
        })),
        permissions: {
            scopes: this.permissions.scopes,
            roles: this.permissions.roles
        },
        quota: {
            daily: this.quota.daily,
            monthly: this.quota.monthly,
            used: this.quota.used
        },
        security: {
            domains: this.security.domains.map(domain => ({
                domain: domain.domain,
                verified: domain.verified
            })),
            webhooks: this.security.webhooks.map(webhook => ({
                url: webhook.url,
                events: webhook.events,
                status: webhook.status
            }))
        },
        monitoring: {
            enabled: this.monitoring.enabled,
            metrics: {
                requests: this.monitoring.metrics.requests,
                responseTime: this.monitoring.metrics.responseTime
            }
        },
        metadata: {
            tags: this.metadata.tags,
            environment: this.metadata.environment,
            documentation: this.metadata.documentation
        },
        expiresAt: this.expiresAt,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt
    };
};

apiSchema.methods.rotateSecret = async function() {
    const secret = crypto.randomBytes(64).toString('hex');
    this.secret = secret;
    this.metadata.custom = {
        ...this.metadata.custom,
        secretRotatedAt: new Date()
    };
    await this.save();
    return this;
};

apiSchema.methods.updateQuota = async function(amount) {
    const now = new Date();
    
    // Günlük kota kontrolü
    if (this.quota.resetAt.daily <= now) {
        this.quota.used.daily = 0;
        this.quota.resetAt.daily = new Date(now.setDate(now.getDate() + 1));
    }
    
    // Aylık kota kontrolü
    if (this.quota.resetAt.monthly <= now) {
        this.quota.used.monthly = 0;
        this.quota.resetAt.monthly = new Date(now.setMonth(now.getMonth() + 1));
    }
    
    this.quota.used.daily += amount;
    this.quota.used.monthly += amount;
    
    await this.save();
    return this;
};

apiSchema.methods.updateMetrics = async function(metrics) {
    const { responseTime, success, error } = metrics;
    
    // İstek sayılarını güncelle
    this.monitoring.metrics.requests.total += 1;
    if (success) {
        this.monitoring.metrics.requests.success += 1;
    } else {
        this.monitoring.metrics.requests.failed += 1;
    }
    
    // Yanıt süresi metriklerini güncelle
    if (responseTime) {
        const rt = this.monitoring.metrics.responseTime;
        rt.avg = ((rt.avg || 0) * (this.monitoring.metrics.requests.total - 1) + responseTime) / this.monitoring.metrics.requests.total;
        rt.min = Math.min(rt.min || Infinity, responseTime);
        rt.max = Math.max(rt.max || 0, responseTime);
    }
    
    // Hata kaydı
    if (error) {
        const errorIndex = this.monitoring.metrics.errors.findIndex(e => e.code === error.code);
        if (errorIndex > -1) {
            this.monitoring.metrics.errors[errorIndex].count += 1;
            this.monitoring.metrics.errors[errorIndex].lastOccurred = new Date();
        } else {
            this.monitoring.metrics.errors.push({
                code: error.code,
                message: error.message,
                count: 1,
                lastOccurred: new Date()
            });
        }
    }
    
    await this.save();
    return this;
};

apiSchema.methods.checkQuota = function() {
    const now = new Date();
    return {
        daily: {
            used: this.quota.used.daily,
            limit: this.quota.daily,
            remaining: Math.max(0, this.quota.daily - this.quota.used.daily),
            resetAt: this.quota.resetAt.daily
        },
        monthly: {
            used: this.quota.used.monthly,
            limit: this.quota.monthly,
            remaining: Math.max(0, this.quota.monthly - this.quota.used.monthly),
            resetAt: this.quota.resetAt.monthly
        }
    };
};

apiSchema.methods.verifyDomain = async function(domain) {
    const domainIndex = this.security.domains.findIndex(d => d.domain === domain);
    if (domainIndex > -1) {
        this.security.domains[domainIndex].verified = true;
        this.security.domains[domainIndex].verifiedAt = new Date();
        await this.save();
        return true;
    }
    return false;
};

apiSchema.methods.addWebhook = async function(webhookData) {
    const secret = crypto.randomBytes(32).toString('hex');
    this.security.webhooks.push({
        ...webhookData,
        secret,
        status: 'active',
        lastTriggered: null,
        failureCount: 0
    });
    await this.save();
    return this;
};

apiSchema.methods.triggerWebhook = async function(event, payload) {
    const webhooks = this.security.webhooks.filter(w => 
        w.status === 'active' && w.events.includes(event)
    );
    
    const results = await Promise.allSettled(webhooks.map(async webhook => {
        try {
            const signature = crypto
                .createHmac('sha256', webhook.secret)
                .update(JSON.stringify(payload))
                .digest('hex');
                
            const response = await fetch(webhook.url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': this.key,
                    'X-Webhook-Signature': signature
                },
                body: JSON.stringify({
                    event,
                    payload,
                    timestamp: new Date().toISOString()
                })
            });
            
            if (!response.ok) {
                throw new Error(`Webhook failed with status ${response.status}`);
            }
            
            webhook.lastTriggered = new Date();
            webhook.failureCount = 0;
            return { success: true, webhook };
        } catch (error) {
            webhook.failureCount += 1;
            if (webhook.failureCount >= 5) {
                webhook.status = 'failed';
            }
            return { success: false, webhook, error: error.message };
        }
    }));
    
    await this.save();
    return results;
};

const API = mongoose.model('API', apiSchema);

module.exports = API; 