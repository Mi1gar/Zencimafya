const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const subscriptionSchema = new Schema({
    // Temel Alanlar
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    plan: {
        type: Schema.Types.ObjectId,
        ref: 'SubscriptionPlan',
        required: true,
        index: true
    },
    status: {
        type: String,
        required: true,
        enum: [
            'active', 'trialing', 'past_due',
            'canceled', 'unpaid', 'expired',
            'paused', 'suspended'
        ],
        default: 'active'
    },
    type: {
        type: String,
        required: true,
        enum: [
            'individual', 'team', 'enterprise',
            'trial', 'promotional', 'custom'
        ]
    },
    // Abonelik Detayları
    currentPeriod: {
        start: {
            type: Date,
            required: true
        },
        end: {
            type: Date,
            required: true
        }
    },
    trial: {
        start: Date,
        end: Date,
        days: Number,
        used: {
            type: Boolean,
            default: false
        }
    },
    interval: {
        type: {
            type: String,
            required: true,
            enum: ['daily', 'weekly', 'monthly', 'yearly', 'custom']
        },
        count: {
            type: Number,
            default: 1
        },
        nextBilling: Date
    },
    // Fiyatlandırma ve Ödeme
    pricing: {
        currency: {
            type: String,
            required: true,
            default: 'TRY'
        },
        amount: {
            type: Number,
            required: true
        },
        originalAmount: Number,
        discount: {
            type: Number,
            min: 0,
            max: 100
        },
        setupFee: Number,
        proration: {
            type: Boolean,
            default: true
        },
        customPrice: Number,
        billingCycle: {
            type: String,
            enum: ['start', 'end', 'prorated']
        }
    },
    // Ödeme ve Fatura
    payment: {
        method: {
            type: String,
            enum: [
                'credit_card', 'debit_card', 'bank_transfer',
                'wallet', 'crypto', 'custom'
            ]
        },
        provider: {
            name: String,
            customerId: String,
            subscriptionId: String
        },
        lastPayment: {
            date: Date,
            amount: Number,
            status: String,
            transactionId: String
        },
        nextPayment: {
            date: Date,
            amount: Number,
            status: String
        },
        failedPayments: [{
            date: Date,
            amount: Number,
            reason: String,
            attempt: Number
        }]
    },
    // Kullanım ve Limitler
    usage: {
        startDate: Date,
        lastReset: Date,
        nextReset: Date,
        metrics: [{
            name: String,
            value: Number,
            limit: Number,
            resetPeriod: {
                type: String,
                enum: ['daily', 'weekly', 'monthly', 'yearly']
            }
        }],
        history: [{
            date: Date,
            metrics: [{
                name: String,
                value: Number
            }]
        }]
    },
    // Takım ve Kurumsal Özellikler
    team: {
        owner: {
            type: Schema.Types.ObjectId,
            ref: 'User'
        },
        members: [{
            user: {
                type: Schema.Types.ObjectId,
                ref: 'User'
            },
            role: {
                type: String,
                enum: ['admin', 'member', 'viewer']
            },
            joinedAt: Date,
            status: {
                type: String,
                enum: ['active', 'invited', 'suspended']
            }
        }],
        seats: {
            total: Number,
            used: Number,
            available: Number
        },
        settings: Schema.Types.Mixed
    },
    // Özelleştirme ve Ayarlar
    settings: {
        autoRenew: {
            type: Boolean,
            default: true
        },
        notifications: {
            enabled: {
                type: Boolean,
                default: true
            },
            channels: [{
                type: String,
                enum: ['email', 'sms', 'push', 'webhook']
            }],
            preferences: Schema.Types.Mixed
        },
        features: [{
            name: String,
            enabled: Boolean,
            settings: Schema.Types.Mixed
        }],
        custom: Schema.Types.Mixed
    },
    // Değişiklik ve Geçmiş
    changes: [{
        type: {
            type: String,
            enum: [
                'plan_change', 'status_change',
                'payment_update', 'team_update',
                'settings_update', 'custom'
            ]
        },
        from: Schema.Types.Mixed,
        to: Schema.Types.Mixed,
        date: Date,
        reason: String,
        actor: {
            type: Schema.Types.ObjectId,
            ref: 'User'
        }
    }],
    // İptal ve Yenileme
    cancellation: {
        requestedAt: Date,
        effectiveAt: Date,
        reason: String,
        feedback: String,
        processedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User'
        }
    },
    renewal: {
        lastRenewal: Date,
        nextRenewal: Date,
        attempts: [{
            date: Date,
            status: String,
            error: String
        }],
        history: [{
            date: Date,
            amount: Number,
            status: String,
            transactionId: String
        }]
    },
    // Metadata
    metadata: {
        source: {
            type: String,
            enum: ['web', 'mobile', 'api', 'pos', 'custom']
        },
        tags: [String],
        notes: String,
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
subscriptionSchema.index({ 'currentPeriod.end': 1 });
subscriptionSchema.index({ 'payment.nextPayment.date': 1 });
subscriptionSchema.index({ 'team.members.user': 1 });
subscriptionSchema.index({ 'metadata.tags': 1 });
subscriptionSchema.index({ status: 1, type: 1 });

// Statik Metodlar
subscriptionSchema.statics.search = async function(query = {}, options = {}) {
    const {
        user,
        plan,
        status,
        type,
        startDate,
        endDate,
        team,
        limit = 50,
        skip = 0,
        sort = { createdAt: -1 }
    } = options;

    const filter = { ...query };

    if (user) filter.user = user;
    if (plan) filter.plan = plan;
    if (status) filter.status = status;
    if (type) filter.type = type;
    if (startDate || endDate) {
        filter['currentPeriod.start'] = {};
        if (startDate) filter['currentPeriod.start'].$gte = startDate;
        if (endDate) filter['currentPeriod.start'].$lte = endDate;
    }
    if (team) filter['team.members.user'] = team;

    return this.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('user', 'username email')
        .populate('plan')
        .populate('team.members.user', 'username email');
};

subscriptionSchema.statics.createSubscription = async function(data) {
    const subscription = new this(data);
    await subscription.save();
    return subscription;
};

subscriptionSchema.statics.getActiveSubscriptions = async function(userId) {
    return this.find({
        user: userId,
        status: { $in: ['active', 'trialing'] }
    }).populate('plan');
};

subscriptionSchema.statics.getTeamSubscriptions = async function(teamId) {
    return this.find({
        'team.members.user': teamId,
        status: 'active'
    }).populate('plan');
};

// Instance Metodlar
subscriptionSchema.methods.toPublicJSON = function() {
    return {
        id: this._id,
        user: this.user,
        plan: this.plan,
        status: this.status,
        type: this.type,
        currentPeriod: this.currentPeriod,
        trial: this.trial,
        interval: this.interval,
        pricing: {
            currency: this.pricing.currency,
            amount: this.pricing.amount,
            discount: this.pricing.discount
        },
        payment: {
            method: this.payment.method,
            lastPayment: this.payment.lastPayment,
            nextPayment: this.payment.nextPayment
        },
        usage: {
            metrics: this.usage.metrics,
            lastReset: this.usage.lastReset,
            nextReset: this.usage.nextReset
        },
        team: this.team ? {
            owner: this.team.owner,
            members: this.team.members.map(member => ({
                user: member.user,
                role: member.role,
                status: member.status
            })),
            seats: this.team.seats
        } : undefined,
        settings: {
            autoRenew: this.settings.autoRenew,
            notifications: this.settings.notifications
        },
        cancellation: this.cancellation ? {
            requestedAt: this.cancellation.requestedAt,
            effectiveAt: this.cancellation.effectiveAt
        } : undefined,
        renewal: {
            lastRenewal: this.renewal.lastRenewal,
            nextRenewal: this.renewal.nextRenewal
        },
        metadata: {
            source: this.metadata.source,
            tags: this.metadata.tags
        },
        createdAt: this.createdAt,
        updatedAt: this.updatedAt
    };
};

subscriptionSchema.methods.updateStatus = async function(status, reason, actor) {
    const oldStatus = this.status;
    this.status = status;
    
    this.changes.push({
        type: 'status_change',
        from: oldStatus,
        to: status,
        date: new Date(),
        reason,
        actor
    });

    // Bildirim gönder
    await this.sendNotification({
        type: 'status_change',
        details: { oldStatus, newStatus: status, reason }
    });

    await this.save();
    return this;
};

subscriptionSchema.methods.changePlan = async function(newPlan, options = {}, actor) {
    const {
        prorate = true,
        billingCycle = 'end',
        effectiveDate = new Date()
    } = options;

    const oldPlan = this.plan;
    this.plan = newPlan;

    // Fiyat hesaplama ve prorasyon
    if (prorate) {
        // Prorasyon hesaplama mantığı
    }

    this.changes.push({
        type: 'plan_change',
        from: oldPlan,
        to: newPlan,
        date: effectiveDate,
        actor,
        details: { prorate, billingCycle }
    });

    // Bildirim gönder
    await this.sendNotification({
        type: 'plan_change',
        details: { oldPlan, newPlan, effectiveDate }
    });

    await this.save();
    return this;
};

subscriptionSchema.methods.requestCancellation = async function(reason, feedback, actor) {
    if (this.cancellation) {
        throw new Error('Cancellation already requested');
    }

    this.cancellation = {
        requestedAt: new Date(),
        effectiveAt: this.currentPeriod.end,
        reason,
        feedback,
        processedBy: actor
    };

    this.settings.autoRenew = false;
    this.changes.push({
        type: 'status_change',
        from: this.status,
        to: 'canceled',
        date: new Date(),
        reason: 'Cancellation requested',
        actor
    });

    // Bildirim gönder
    await this.sendNotification({
        type: 'cancellation_requested',
        details: { reason, effectiveAt: this.cancellation.effectiveAt }
    });

    await this.save();
    return this;
};

subscriptionSchema.methods.addTeamMember = async function(userId, role, actor) {
    if (!this.team) {
        throw new Error('Not a team subscription');
    }

    if (this.team.seats.used >= this.team.seats.total) {
        throw new Error('No available seats');
    }

    this.team.members.push({
        user: userId,
        role,
        joinedAt: new Date(),
        status: 'invited'
    });

    this.team.seats.used += 1;
    this.team.seats.available = this.team.seats.total - this.team.seats.used;

    this.changes.push({
        type: 'team_update',
        date: new Date(),
        actor,
        details: { action: 'add_member', userId, role }
    });

    // Bildirim gönder
    await this.sendNotification({
        type: 'team_member_added',
        details: { userId, role }
    });

    await this.save();
    return this;
};

subscriptionSchema.methods.updateUsage = async function(metrics) {
    const now = new Date();
    
    // Metrik güncelleme
    for (const [name, value] of Object.entries(metrics)) {
        const metric = this.usage.metrics.find(m => m.name === name);
        if (metric) {
            metric.value = value;
        }
    }

    // Kullanım geçmişi
    this.usage.history.push({
        date: now,
        metrics: Object.entries(metrics).map(([name, value]) => ({
            name,
            value
        }))
    });

    // Limit kontrolü
    const exceededMetrics = this.usage.metrics.filter(
        metric => metric.limit && metric.value > metric.limit
    );

    if (exceededMetrics.length > 0) {
        // Limit aşımı bildirimi
        await this.sendNotification({
            type: 'usage_limit_exceeded',
            details: { metrics: exceededMetrics }
        });
    }

    await this.save();
    return this;
};

subscriptionSchema.methods.sendNotification = async function(notification) {
    if (!this.settings.notifications.enabled) {
        return this;
    }

    const channels = this.settings.notifications.channels;
    
    for (const channel of channels) {
        try {
            // Bildirim gönderme işlemi
            // Bu kısım, kullanılan bildirim sistemine göre özelleştirilmeli
        } catch (error) {
            console.error(`Notification failed for channel ${channel}:`, error);
        }
    }

    return this;
};

const Subscription = mongoose.model('Subscription', subscriptionSchema);

module.exports = Subscription; 