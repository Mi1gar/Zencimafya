const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const crypto = require('crypto');

const webhookSchema = new Schema({
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
            'system', 'user', 'content', 'notification',
            'payment', 'integration', 'custom'
        ]
    },
    status: {
        type: String,
        required: true,
        enum: [
            'active', 'inactive', 'suspended', 'failed',
            'deleted'
        ],
        default: 'active'
    },
    url: {
        type: String,
        required: true
    },
    secret: {
        type: String,
        required: true,
        select: false
    },
    events: [{
        type: {
            type: String,
            required: true
        },
        description: String,
        enabled: {
            type: Boolean,
            default: true
        },
        filters: Schema.Types.Mixed
    }],
    delivery: {
        method: {
            type: String,
            enum: ['POST', 'PUT', 'PATCH'],
            default: 'POST'
        },
        headers: {
            type: Map,
            of: String,
            default: new Map()
        },
        timeout: {
            type: Number,
            default: 10000
        },
        retry: {
            enabled: {
                type: Boolean,
                default: true
            },
            maxAttempts: {
                type: Number,
                default: 3
            },
            backoff: {
                type: String,
                enum: ['linear', 'exponential'],
                default: 'exponential'
            },
            maxDelay: {
                type: Number,
                default: 3600000
            }
        },
        batch: {
            enabled: {
                type: Boolean,
                default: false
            },
            maxSize: {
                type: Number,
                default: 100
            },
            maxDelay: {
                type: Number,
                default: 5000
            }
        }
    },
    security: {
        ipWhitelist: [{
            ip: String,
            description: String,
            addedAt: Date
        }],
        ssl: {
            verify: {
                type: Boolean,
                default: true
            },
            cert: String
        },
        auth: {
            type: {
                type: String,
                enum: ['none', 'basic', 'bearer', 'custom'],
                default: 'none'
            },
            credentials: {
                username: String,
                password: String,
                token: String
            }
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
                    'failure_rate', 'response_time',
                    'error_rate', 'custom'
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
            deliveries: {
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
                retried: {
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
    history: [{
        event: {
            type: String,
            required: true
        },
        payload: Schema.Types.Mixed,
        status: {
            type: String,
            enum: [
                'pending', 'delivered', 'failed',
                'retrying', 'dropped'
            ],
            required: true
        },
        attempts: [{
            timestamp: Date,
            status: {
                type: String,
                enum: [
                    'success', 'failed', 'timeout',
                    'network_error', 'invalid_response'
                ]
            },
            response: {
                status: Number,
                headers: Schema.Types.Mixed,
                body: String
            },
            error: String,
            duration: Number
        }],
        signature: String,
        metadata: {
            ip: String,
            userAgent: String,
            requestId: String
        }
    }],
    metadata: {
        tags: [String],
        environment: {
            type: String,
            enum: ['development', 'staging', 'production'],
            default: 'development'
        },
        custom: Schema.Types.Mixed
    }
}, {
    timestamps: true
});

// İndeksler
webhookSchema.index({ owner: 1, status: 1 });
webhookSchema.index({ 'events.type': 1 });
webhookSchema.index({ 'security.ipWhitelist.ip': 1 });
webhookSchema.index({ 'metadata.tags': 1 });
webhookSchema.index({ 'monitoring.metrics.deliveries.total': -1 });
webhookSchema.index({ 'history.event': 1, 'history.status': 1 });

// Statik Metodlar
webhookSchema.statics.generateSecret = function() {
    return crypto.randomBytes(32).toString('hex');
};

webhookSchema.statics.search = async function(query = {}, options = {}) {
    const {
        owner,
        type,
        status,
        event,
        environment,
        limit = 50,
        skip = 0,
        sort = { createdAt: -1 }
    } = options;

    const filter = { ...query };

    if (owner) filter.owner = owner;
    if (type) filter.type = type;
    if (status) filter.status = status;
    if (event) filter['events.type'] = event;
    if (environment) filter['metadata.environment'] = environment;

    return this.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('owner', 'username email');
};

webhookSchema.statics.createWebhook = async function(data) {
    const secret = this.generateSecret();
    const webhook = new this({
        ...data,
        secret
    });
    await webhook.save();
    return webhook;
};

// Instance Metodlar
webhookSchema.methods.toPublicJSON = function() {
    return {
        id: this._id,
        name: this.name,
        description: this.description,
        type: this.type,
        status: this.status,
        url: this.url,
        events: this.events.map(event => ({
            type: event.type,
            description: event.description,
            enabled: event.enabled
        })),
        delivery: {
            method: this.delivery.method,
            timeout: this.delivery.timeout,
            retry: {
                enabled: this.delivery.retry.enabled,
                maxAttempts: this.delivery.retry.maxAttempts
            },
            batch: {
                enabled: this.delivery.batch.enabled,
                maxSize: this.delivery.batch.maxSize
            }
        },
        security: {
            ssl: {
                verify: this.security.ssl.verify
            },
            auth: {
                type: this.security.auth.type
            }
        },
        monitoring: {
            enabled: this.monitoring.enabled,
            metrics: {
                deliveries: this.monitoring.metrics.deliveries,
                responseTime: this.monitoring.metrics.responseTime
            }
        },
        metadata: {
            tags: this.metadata.tags,
            environment: this.metadata.environment
        },
        createdAt: this.createdAt,
        updatedAt: this.updatedAt
    };
};

webhookSchema.methods.rotateSecret = async function() {
    const secret = this.constructor.generateSecret();
    this.secret = secret;
    this.metadata.custom = {
        ...this.metadata.custom,
        secretRotatedAt: new Date()
    };
    await this.save();
    return this;
};

webhookSchema.methods.trigger = async function(event, payload, metadata = {}) {
    // Event kontrolü
    const eventConfig = this.events.find(e => e.type === event && e.enabled);
    if (!eventConfig) {
        throw new Error(`Event ${event} is not enabled for this webhook`);
    }

    // Event filtrelerini kontrol et
    if (eventConfig.filters) {
        const passes = this.checkFilters(eventConfig.filters, payload);
        if (!passes) {
            return {
                status: 'dropped',
                reason: 'filtered'
            };
        }
    }

    // İmza oluştur
    const signature = crypto
        .createHmac('sha256', this.secret)
        .update(JSON.stringify(payload))
        .digest('hex');

    // Delivery kaydı oluştur
    const delivery = {
        event,
        payload,
        status: 'pending',
        attempts: [],
        signature,
        metadata
    };

    // Batch modunda ise kuyruğa ekle
    if (this.delivery.batch.enabled) {
        this.history.push(delivery);
        await this.save();
        return {
            status: 'queued',
            deliveryId: delivery._id
        };
    }

    // Direkt gönder
    try {
        const result = await this.deliver(delivery);
        this.history.push(result);
        await this.save();
        return result;
    } catch (error) {
        delivery.status = 'failed';
        delivery.attempts.push({
            timestamp: new Date(),
            status: 'failed',
            error: error.message
        });
        this.history.push(delivery);
        await this.save();
        throw error;
    }
};

webhookSchema.methods.deliver = async function(delivery, attempt = 1) {
    const startTime = Date.now();
    let response;

    try {
        // İstek başlıklarını hazırla
        const headers = new Map(this.delivery.headers);
        headers.set('Content-Type', 'application/json');
        headers.set('X-Webhook-Signature', delivery.signature);
        headers.set('X-Webhook-Event', delivery.event);
        headers.set('X-Webhook-Delivery', delivery._id.toString());

        // Auth bilgilerini ekle
        if (this.security.auth.type !== 'none') {
            const authHeader = this.generateAuthHeader();
            headers.set('Authorization', authHeader);
        }

        // İsteği gönder
        response = await fetch(this.url, {
            method: this.delivery.method,
            headers: Object.fromEntries(headers),
            body: JSON.stringify({
                event: delivery.event,
                payload: delivery.payload,
                timestamp: new Date().toISOString()
            }),
            timeout: this.delivery.timeout,
            ...(this.security.ssl.verify ? {} : { rejectUnauthorized: false })
        });

        const duration = Date.now() - startTime;

        // Başarılı yanıt
        if (response.ok) {
            delivery.status = 'delivered';
            delivery.attempts.push({
                timestamp: new Date(),
                status: 'success',
                response: {
                    status: response.status,
                    headers: Object.fromEntries(response.headers),
                    body: await response.text()
                },
                duration
            });

            // Metrikleri güncelle
            this.updateMetrics({
                success: true,
                duration
            });

            return delivery;
        }

        // Başarısız yanıt
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);

    } catch (error) {
        const duration = Date.now() - startTime;

        // Retry kontrolü
        if (
            this.delivery.retry.enabled &&
            attempt < this.delivery.retry.maxAttempts
        ) {
            const delay = this.calculateRetryDelay(attempt);
            delivery.status = 'retrying';
            delivery.attempts.push({
                timestamp: new Date(),
                status: 'failed',
                error: error.message,
                duration
            });

            // Metrikleri güncelle
            this.updateMetrics({
                success: false,
                duration,
                retried: true
            });

            // Retry zamanla
            setTimeout(() => {
                this.deliver(delivery, attempt + 1).catch(console.error);
            }, delay);

            return delivery;
        }

        // Maksimum deneme sayısına ulaşıldı
        delivery.status = 'failed';
        delivery.attempts.push({
            timestamp: new Date(),
            status: 'failed',
            error: error.message,
            duration
        });

        // Metrikleri güncelle
        this.updateMetrics({
            success: false,
            duration
        });

        return delivery;
    }
};

webhookSchema.methods.generateAuthHeader = function() {
    switch (this.security.auth.type) {
        case 'basic':
            const credentials = Buffer.from(
                `${this.security.auth.credentials.username}:${this.security.auth.credentials.password}`
            ).toString('base64');
            return `Basic ${credentials}`;

        case 'bearer':
            return `Bearer ${this.security.auth.credentials.token}`;

        default:
            return '';
    }
};

webhookSchema.methods.calculateRetryDelay = function(attempt) {
    const baseDelay = 1000 * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 1000;
    const delay = baseDelay + jitter;

    return Math.min(delay, this.delivery.retry.maxDelay);
};

webhookSchema.methods.checkFilters = function(filters, payload) {
    // Basit filtre kontrolü
    // Daha karmaşık filtreler için özel bir filtre motoru eklenebilir
    return Object.entries(filters).every(([key, value]) => {
        const payloadValue = key.split('.').reduce((obj, k) => obj?.[k], payload);
        return payloadValue === value;
    });
};

webhookSchema.methods.updateMetrics = function(metrics) {
    const { success, duration, retried } = metrics;

    // İstek sayılarını güncelle
    this.monitoring.metrics.deliveries.total += 1;
    if (success) {
        this.monitoring.metrics.deliveries.success += 1;
    } else {
        this.monitoring.metrics.deliveries.failed += 1;
        if (retried) {
            this.monitoring.metrics.deliveries.retried += 1;
        }
    }

    // Yanıt süresi metriklerini güncelle
    if (duration) {
        const rt = this.monitoring.metrics.responseTime;
        rt.avg = ((rt.avg || 0) * (this.monitoring.metrics.deliveries.total - 1) + duration) / this.monitoring.metrics.deliveries.total;
        rt.min = Math.min(rt.min || Infinity, duration);
        rt.max = Math.max(rt.max || 0, duration);
    }

    // Uyarıları kontrol et
    this.checkAlerts();
};

webhookSchema.methods.checkAlerts = async function() {
    const metrics = this.monitoring.metrics;
    const alerts = this.monitoring.alerts;

    for (const alert of alerts) {
        if (!alert.enabled) continue;

        let value;
        switch (alert.type) {
            case 'failure_rate':
                value = (metrics.deliveries.failed / metrics.deliveries.total) * 100;
                break;
            case 'response_time':
                value = metrics.responseTime.avg;
                break;
            case 'error_rate':
                value = metrics.deliveries.failed / metrics.deliveries.total;
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

webhookSchema.methods.evaluateAlertCondition = function(alert, value) {
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

webhookSchema.methods.triggerAlert = async function(alert, value) {
    for (const channel of alert.channels) {
        if (!channel.enabled) continue;

        try {
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
            console.error(`Alert channel ${channel.type} failed:`, error);
        }
    }
};

const Webhook = mongoose.model('Webhook', webhookSchema);

module.exports = Webhook; 