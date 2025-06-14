const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const crypto = require('crypto');

const integrationSchema = new Schema({
    // Temel Alanlar
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
            'oauth', 'api', 'webhook', 'database',
            'payment', 'notification', 'storage',
            'analytics', 'custom'
        ]
    },
    provider: {
        name: {
            type: String,
            required: true
        },
        version: String,
        documentation: String,
        website: String,
        logo: String
    },
    status: {
        type: String,
        required: true,
        enum: [
            'active', 'inactive', 'pending',
            'failed', 'suspended', 'deleted'
        ],
        default: 'pending'
    },
    credentials: {
        type: {
            type: String,
            enum: [
                'oauth2', 'api_key', 'basic_auth',
                'jwt', 'custom'
            ],
            required: true
        },
        clientId: String,
        clientSecret: {
            type: String,
            select: false
        },
        apiKey: {
            type: String,
            select: false
        },
        accessToken: {
            type: String,
            select: false
        },
        refreshToken: {
            type: String,
            select: false
        },
        tokenExpiresAt: Date,
        username: String,
        password: {
            type: String,
            select: false
        },
        custom: Schema.Types.Mixed
    },
    config: {
        endpoints: {
            type: Map,
            of: String,
            default: new Map()
        },
        scopes: [String],
        permissions: [String],
        settings: Schema.Types.Mixed,
        mappings: [{
            source: String,
            target: String,
            transform: String,
            required: {
                type: Boolean,
                default: false
            }
        }],
        webhooks: [{
            event: String,
            url: String,
            secret: String,
            enabled: {
                type: Boolean,
                default: true
            }
        }]
    },
    sync: {
        enabled: {
            type: Boolean,
            default: false
        },
        direction: {
            type: String,
            enum: ['push', 'pull', 'both'],
            default: 'both'
        },
        schedule: {
            type: {
                type: String,
                enum: ['manual', 'interval', 'cron'],
                default: 'manual'
            },
            interval: Number,
            cron: String,
            lastRun: Date,
            nextRun: Date
        },
        resources: [{
            type: {
                type: String,
                required: true
            },
            enabled: {
                type: Boolean,
                default: true
            },
            filters: Schema.Types.Mixed,
            transform: String,
            conflict: {
                strategy: {
                    type: String,
                    enum: ['skip', 'overwrite', 'merge', 'custom'],
                    default: 'skip'
                },
                custom: String
            }
        }],
        history: [{
            timestamp: Date,
            direction: {
                type: String,
                enum: ['push', 'pull']
            },
            resource: String,
            status: {
                type: String,
                enum: [
                    'success', 'failed', 'partial',
                    'skipped', 'conflict'
                ]
            },
            stats: {
                total: Number,
                processed: Number,
                succeeded: Number,
                failed: Number,
                skipped: Number
            },
            error: String,
            duration: Number
        }]
    },
    monitoring: {
        enabled: {
            type: Boolean,
            default: true
        },
        health: {
            status: {
                type: String,
                enum: [
                    'healthy', 'degraded', 'unhealthy',
                    'unknown'
                ],
                default: 'unknown'
            },
            lastCheck: Date,
            checks: [{
                type: {
                    type: String,
                    enum: [
                        'connection', 'auth', 'api',
                        'sync', 'custom'
                    ]
                },
                status: {
                    type: String,
                    enum: ['success', 'failed']
                },
                message: String,
                timestamp: Date,
                duration: Number
            }]
        },
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
            sync: {
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
                },
                lastSuccess: Date,
                lastFailure: Date
            },
            performance: {
                avgResponseTime: Number,
                maxResponseTime: Number,
                minResponseTime: Number,
                p95ResponseTime: Number,
                p99ResponseTime: Number
            }
        },
        alerts: [{
            type: {
                type: String,
                enum: [
                    'health', 'sync', 'performance',
                    'error_rate', 'custom'
                ]
            },
            condition: {
                type: String,
                enum: ['gt', 'lt', 'eq', 'gte', 'lte']
            },
            threshold: Number,
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
        }]
    },
    logs: [{
        level: {
            type: String,
            enum: ['info', 'warn', 'error', 'debug']
        },
        message: String,
        context: Schema.Types.Mixed,
        timestamp: Date
    }],
    metadata: {
        tags: [String],
        environment: {
            type: String,
            enum: ['development', 'staging', 'production'],
            default: 'development'
        },
        version: String,
        custom: Schema.Types.Mixed
    }
}, {
    timestamps: true
});

// İndeksler
integrationSchema.index({ owner: 1, status: 1 });
integrationSchema.index({ 'provider.name': 1 });
integrationSchema.index({ 'metadata.tags': 1 });
integrationSchema.index({ 'sync.schedule.nextRun': 1 });
integrationSchema.index({ 'monitoring.health.status': 1 });

// Statik Metodlar
integrationSchema.statics.search = async function(query = {}, options = {}) {
    const {
        owner,
        type,
        status,
        provider,
        environment,
        limit = 50,
        skip = 0,
        sort = { createdAt: -1 }
    } = options;

    const filter = { ...query };

    if (owner) filter.owner = owner;
    if (type) filter.type = type;
    if (status) filter.status = status;
    if (provider) filter['provider.name'] = provider;
    if (environment) filter['metadata.environment'] = environment;

    return this.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('owner', 'username email');
};

integrationSchema.statics.createIntegration = async function(data) {
    const integration = new this(data);
    await integration.save();
    return integration;
};

// Instance Metodlar
integrationSchema.methods.toPublicJSON = function() {
    return {
        id: this._id,
        name: this.name,
        description: this.description,
        type: this.type,
        provider: this.provider,
        status: this.status,
        config: {
            endpoints: Object.fromEntries(this.config.endpoints),
            scopes: this.config.scopes,
            permissions: this.config.permissions,
            settings: this.config.settings
        },
        sync: {
            enabled: this.sync.enabled,
            direction: this.sync.direction,
            schedule: this.sync.schedule,
            resources: this.sync.resources.map(r => ({
                type: r.type,
                enabled: r.enabled
            }))
        },
        monitoring: {
            enabled: this.monitoring.enabled,
            health: {
                status: this.monitoring.health.status,
                lastCheck: this.monitoring.health.lastCheck
            },
            metrics: {
                requests: this.monitoring.metrics.requests,
                sync: this.monitoring.metrics.sync
            }
        },
        metadata: {
            tags: this.metadata.tags,
            environment: this.metadata.environment,
            version: this.metadata.version
        },
        createdAt: this.createdAt,
        updatedAt: this.updatedAt
    };
};

integrationSchema.methods.rotateCredentials = async function() {
    switch (this.credentials.type) {
        case 'oauth2':
            // OAuth2 token yenileme
            await this.refreshOAuthToken();
            break;
        case 'api_key':
            // API anahtarı yenileme
            this.credentials.apiKey = crypto.randomBytes(32).toString('hex');
            break;
        case 'basic_auth':
            // Basic auth şifre yenileme
            this.credentials.password = crypto.randomBytes(16).toString('hex');
            break;
        case 'jwt':
            // JWT secret yenileme
            this.credentials.secret = crypto.randomBytes(64).toString('hex');
            break;
    }

    this.metadata.custom = {
        ...this.metadata.custom,
        credentialsRotatedAt: new Date()
    };

    await this.save();
    return this;
};

integrationSchema.methods.refreshOAuthToken = async function() {
    if (this.credentials.type !== 'oauth2') {
        throw new Error('Integration is not OAuth2 type');
    }

    if (!this.credentials.refreshToken) {
        throw new Error('No refresh token available');
    }

    try {
        const response = await fetch(this.config.endpoints.get('token'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: this.credentials.refreshToken,
                client_id: this.credentials.clientId,
                client_secret: this.credentials.clientSecret
            })
        });

        if (!response.ok) {
            throw new Error(`Token refresh failed: ${response.statusText}`);
        }

        const data = await response.json();
        this.credentials.accessToken = data.access_token;
        this.credentials.refreshToken = data.refresh_token;
        this.credentials.tokenExpiresAt = new Date(Date.now() + data.expires_in * 1000);

        await this.save();
        return this;
    } catch (error) {
        this.logs.push({
            level: 'error',
            message: 'Token refresh failed',
            context: { error: error.message },
            timestamp: new Date()
        });
        await this.save();
        throw error;
    }
};

integrationSchema.methods.checkHealth = async function() {
    const checks = [];

    // Bağlantı kontrolü
    try {
        const startTime = Date.now();
        const response = await fetch(this.config.endpoints.get('health'), {
            method: 'GET',
            headers: this.getAuthHeaders()
        });
        const duration = Date.now() - startTime;

        checks.push({
            type: 'connection',
            status: response.ok ? 'success' : 'failed',
            message: response.ok ? 'Connection successful' : `Connection failed: ${response.statusText}`,
            timestamp: new Date(),
            duration
        });
    } catch (error) {
        checks.push({
            type: 'connection',
            status: 'failed',
            message: `Connection error: ${error.message}`,
            timestamp: new Date()
        });
    }

    // Kimlik doğrulama kontrolü
    try {
        const startTime = Date.now();
        const response = await fetch(this.config.endpoints.get('auth'), {
            method: 'GET',
            headers: this.getAuthHeaders()
        });
        const duration = Date.now() - startTime;

        checks.push({
            type: 'auth',
            status: response.ok ? 'success' : 'failed',
            message: response.ok ? 'Authentication successful' : `Authentication failed: ${response.statusText}`,
            timestamp: new Date(),
            duration
        });
    } catch (error) {
        checks.push({
            type: 'auth',
            status: 'failed',
            message: `Authentication error: ${error.message}`,
            timestamp: new Date()
        });
    }

    // API kontrolü
    try {
        const startTime = Date.now();
        const response = await fetch(this.config.endpoints.get('api'), {
            method: 'GET',
            headers: this.getAuthHeaders()
        });
        const duration = Date.now() - startTime;

        checks.push({
            type: 'api',
            status: response.ok ? 'success' : 'failed',
            message: response.ok ? 'API check successful' : `API check failed: ${response.statusText}`,
            timestamp: new Date(),
            duration
        });
    } catch (error) {
        checks.push({
            type: 'api',
            status: 'failed',
            message: `API check error: ${error.message}`,
            timestamp: new Date()
        });
    }

    // Sağlık durumunu güncelle
    const failedChecks = checks.filter(check => check.status === 'failed');
    this.monitoring.health = {
        status: failedChecks.length === 0 ? 'healthy' :
                failedChecks.length === checks.length ? 'unhealthy' : 'degraded',
        lastCheck: new Date(),
        checks
    };

    // Metrikleri güncelle
    this.updateMetrics({
        requests: {
            total: 1,
            success: checks.filter(check => check.status === 'success').length,
            failed: failedChecks.length
        },
        performance: {
            avgResponseTime: checks.reduce((sum, check) => sum + (check.duration || 0), 0) / checks.length
        }
    });

    await this.save();
    return this.monitoring.health;
};

integrationSchema.methods.getAuthHeaders = function() {
    const headers = new Map();

    switch (this.credentials.type) {
        case 'oauth2':
            if (this.credentials.accessToken) {
                headers.set('Authorization', `Bearer ${this.credentials.accessToken}`);
            }
            break;
        case 'api_key':
            if (this.credentials.apiKey) {
                headers.set('X-API-Key', this.credentials.apiKey);
            }
            break;
        case 'basic_auth':
            if (this.credentials.username && this.credentials.password) {
                const auth = Buffer.from(
                    `${this.credentials.username}:${this.credentials.password}`
                ).toString('base64');
                headers.set('Authorization', `Basic ${auth}`);
            }
            break;
        case 'jwt':
            if (this.credentials.accessToken) {
                headers.set('Authorization', `Bearer ${this.credentials.accessToken}`);
            }
            break;
    }

    return Object.fromEntries(headers);
};

integrationSchema.methods.syncData = async function(resource, direction = 'both') {
    if (!this.sync.enabled) {
        throw new Error('Sync is not enabled for this integration');
    }

    const resourceConfig = this.sync.resources.find(r => r.type === resource);
    if (!resourceConfig || !resourceConfig.enabled) {
        throw new Error(`Resource ${resource} is not enabled for sync`);
    }

    const syncStart = Date.now();
    const stats = {
        total: 0,
        processed: 0,
        succeeded: 0,
        failed: 0,
        skipped: 0
    };

    try {
        // Push sync
        if (direction === 'push' || direction === 'both') {
            const pushResult = await this.pushData(resource, resourceConfig);
            Object.keys(stats).forEach(key => {
                stats[key] += pushResult.stats[key];
            });
        }

        // Pull sync
        if (direction === 'pull' || direction === 'both') {
            const pullResult = await this.pullData(resource, resourceConfig);
            Object.keys(stats).forEach(key => {
                stats[key] += pullResult.stats[key];
            });
        }

        // Sync kaydı oluştur
        const syncRecord = {
            timestamp: new Date(),
            direction,
            resource,
            status: stats.failed === 0 ? 'success' :
                    stats.succeeded === 0 ? 'failed' : 'partial',
            stats,
            duration: Date.now() - syncStart
        };

        this.sync.history.push(syncRecord);

        // Metrikleri güncelle
        this.updateMetrics({
            sync: {
                total: 1,
                success: stats.failed === 0 ? 1 : 0,
                failed: stats.failed > 0 ? 1 : 0
            }
        });

        await this.save();
        return syncRecord;

    } catch (error) {
        const syncRecord = {
            timestamp: new Date(),
            direction,
            resource,
            status: 'failed',
            stats,
            error: error.message,
            duration: Date.now() - syncStart
        };

        this.sync.history.push(syncRecord);
        this.logs.push({
            level: 'error',
            message: `Sync failed for resource ${resource}`,
            context: { error: error.message, direction, resource },
            timestamp: new Date()
        });

        await this.save();
        throw error;
    }
};

integrationSchema.methods.pushData = async function(resource, config) {
    // Veri gönderme işlemi
    // Bu metod, entegrasyon tipine göre özelleştirilmeli
    return {
        stats: {
            total: 0,
            processed: 0,
            succeeded: 0,
            failed: 0,
            skipped: 0
        }
    };
};

integrationSchema.methods.pullData = async function(resource, config) {
    // Veri çekme işlemi
    // Bu metod, entegrasyon tipine göre özelleştirilmeli
    return {
        stats: {
            total: 0,
            processed: 0,
            succeeded: 0,
            failed: 0,
            skipped: 0
        }
    };
};

integrationSchema.methods.updateMetrics = function(metrics) {
    const { requests, sync, performance } = metrics;

    // İstek metriklerini güncelle
    if (requests) {
        this.monitoring.metrics.requests.total += requests.total;
        this.monitoring.metrics.requests.success += requests.success;
        this.monitoring.metrics.requests.failed += requests.failed;
    }

    // Sync metriklerini güncelle
    if (sync) {
        this.monitoring.metrics.sync.total += sync.total;
        this.monitoring.metrics.sync.success += sync.success;
        this.monitoring.metrics.sync.failed += sync.failed;

        if (sync.success) {
            this.monitoring.metrics.sync.lastSuccess = new Date();
        }
        if (sync.failed) {
            this.monitoring.metrics.sync.lastFailure = new Date();
        }
    }

    // Performans metriklerini güncelle
    if (performance) {
        const perf = this.monitoring.metrics.performance;
        if (performance.avgResponseTime) {
            perf.avgResponseTime = perf.avgResponseTime ?
                (perf.avgResponseTime + performance.avgResponseTime) / 2 :
                performance.avgResponseTime;
        }
        if (performance.maxResponseTime) {
            perf.maxResponseTime = Math.max(perf.maxResponseTime || 0, performance.maxResponseTime);
        }
        if (performance.minResponseTime) {
            perf.minResponseTime = Math.min(perf.minResponseTime || Infinity, performance.minResponseTime);
        }
    }

    // Uyarıları kontrol et
    this.checkAlerts();
};

integrationSchema.methods.checkAlerts = async function() {
    const metrics = this.monitoring.metrics;
    const alerts = this.monitoring.alerts;

    for (const alert of alerts) {
        if (!alert.enabled) continue;

        let value;
        switch (alert.type) {
            case 'health':
                value = this.monitoring.health.status === 'healthy' ? 1 : 0;
                break;
            case 'sync':
                value = metrics.sync.failed / metrics.sync.total;
                break;
            case 'performance':
                value = metrics.performance.avgResponseTime;
                break;
            case 'error_rate':
                value = metrics.requests.failed / metrics.requests.total;
                break;
            default:
                continue;
        }

        const triggered = this.evaluateAlertCondition(alert, value);
        if (triggered) {
            await this.triggerAlert(alert, value);
        }
    }
};

integrationSchema.methods.evaluateAlertCondition = function(alert, value) {
    switch (alert.condition) {
        case 'gt':
            return value > alert.threshold;
        case 'lt':
            return value < alert.threshold;
        case 'eq':
            return value === alert.threshold;
        case 'gte':
            return value >= alert.threshold;
        case 'lte':
            return value <= alert.threshold;
        default:
            return false;
    }
};

integrationSchema.methods.triggerAlert = async function(alert, value) {
    for (const channel of alert.channels) {
        if (!channel.enabled) continue;

        try {
            const message = this.formatAlertMessage(alert, value);
            switch (channel.type) {
                case 'email':
                    // Email gönderme işlemi
                    break;
                case 'webhook':
                    // Webhook tetikleme
                    break;
                case 'slack':
                    // Slack mesajı gönderme
                    break;
                default:
                    // Özel kanal işleme
                    break;
            }
        } catch (error) {
            this.logs.push({
                level: 'error',
                message: `Alert channel ${channel.type} failed`,
                context: { error: error.message, alert, value },
                timestamp: new Date()
            });
        }
    }
};

integrationSchema.methods.formatAlertMessage = function(alert, value) {
    return {
        integration: this.name,
        type: alert.type,
        value,
        threshold: alert.threshold,
        condition: alert.condition,
        timestamp: new Date()
    };
};

const Integration = mongoose.model('Integration', integrationSchema);

module.exports = Integration; 