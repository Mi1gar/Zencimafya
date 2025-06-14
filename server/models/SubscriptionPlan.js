const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const subscriptionPlanSchema = new Schema({
    // Temel Alanlar
    name: {
        type: String,
        required: true,
        unique: true
    },
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true
    },
    description: {
        type: String,
        required: true
    },
    type: {
        type: String,
        required: true,
        enum: [
            'basic', 'premium', 'enterprise',
            'custom', 'trial', 'promotional'
        ]
    },
    status: {
        type: String,
        required: true,
        enum: [
            'active', 'inactive', 'deprecated',
            'scheduled', 'hidden', 'deleted'
        ],
        default: 'active'
    },
    visibility: {
        type: String,
        required: true,
        enum: ['public', 'private', 'invite_only'],
        default: 'public'
    },
    features: [{
        name: {
            type: String,
            required: true
        },
        description: String,
        value: Schema.Types.Mixed,
        limit: Number,
        enabled: {
            type: Boolean,
            default: true
        },
        metadata: Schema.Types.Mixed
    }],
    pricing: {
        currency: {
            type: String,
            required: true,
            default: 'TRY'
        },
        intervals: [{
            type: {
                type: String,
                required: true,
                enum: ['daily', 'weekly', 'monthly', 'yearly', 'custom']
            },
            price: {
                type: Number,
                required: true
            },
            originalPrice: Number,
            discount: {
                type: Number,
                min: 0,
                max: 100
            },
            trialDays: {
                type: Number,
                default: 0
            },
            setupFee: Number,
            minimumPeriod: Number,
            maximumPeriod: Number,
            gracePeriod: Number,
            proration: {
                type: Boolean,
                default: true
            },
            metadata: Schema.Types.Mixed
        }],
        customPricing: {
            enabled: {
                type: Boolean,
                default: false
            },
            minPrice: Number,
            maxPrice: Number,
            defaultPrice: Number,
            pricingModel: {
                type: String,
                enum: ['fixed', 'usage', 'tiered', 'custom']
            },
            usageMetrics: [{
                name: String,
                unit: String,
                price: Number,
                included: Number
            }],
            tiers: [{
                min: Number,
                max: Number,
                price: Number
            }]
        }
    },
    limits: {
        users: {
            min: Number,
            max: Number,
            default: Number
        },
        storage: {
            value: Number,
            unit: {
                type: String,
                enum: ['MB', 'GB', 'TB']
            }
        },
        bandwidth: {
            value: Number,
            unit: {
                type: String,
                enum: ['GB', 'TB']
            },
            period: {
                type: String,
                enum: ['daily', 'monthly', 'yearly']
            }
        },
        api: {
            requests: {
                value: Number,
                period: {
                    type: String,
                    enum: ['minute', 'hour', 'day', 'month']
                }
            },
            rateLimit: {
                requests: Number,
                period: Number
            }
        },
        custom: Schema.Types.Mixed
    },
    restrictions: {
        allowedCountries: [String],
        allowedDomains: [String],
        allowedIPs: [String],
        allowedDevices: [{
            type: String,
            enum: ['desktop', 'mobile', 'tablet', 'other']
        }],
        requiredFields: [{
            name: String,
            type: String,
            required: Boolean
        }],
        custom: Schema.Types.Mixed
    },
    upgrades: [{
        fromPlan: {
            type: Schema.Types.ObjectId,
            ref: 'SubscriptionPlan'
        },
        toPlan: {
            type: Schema.Types.ObjectId,
            ref: 'SubscriptionPlan'
        },
        proration: {
            type: Boolean,
            default: true
        },
        discount: Number,
        conditions: Schema.Types.Mixed
    }],
    downgrades: [{
        fromPlan: {
            type: Schema.Types.ObjectId,
            ref: 'SubscriptionPlan'
        },
        toPlan: {
            type: Schema.Types.ObjectId,
            ref: 'SubscriptionPlan'
        },
        proration: {
            type: Boolean,
            default: true
        },
        penalty: Number,
        conditions: Schema.Types.Mixed
    }],
    promotions: [{
        code: {
            type: String,
            required: true
        },
        type: {
            type: String,
            enum: ['discount', 'trial', 'upgrade', 'custom']
        },
        value: Schema.Types.Mixed,
        startDate: Date,
        endDate: Date,
        usageLimit: Number,
        usageCount: {
            type: Number,
            default: 0
        },
        conditions: Schema.Types.Mixed,
        metadata: Schema.Types.Mixed
    }],
    notifications: {
        templates: [{
            type: {
                type: String,
                enum: [
                    'welcome', 'renewal', 'expiration',
                    'upgrade', 'downgrade', 'cancellation',
                    'payment_failed', 'custom'
                ]
            },
            channels: [{
                type: String,
                enum: ['email', 'sms', 'push', 'webhook']
            }],
            subject: String,
            content: String,
            metadata: Schema.Types.Mixed
        }],
        settings: {
            welcome: {
                enabled: Boolean,
                delay: Number
            },
            renewal: {
                enabled: Boolean,
                daysBefore: [Number]
            },
            expiration: {
                enabled: Boolean,
                daysBefore: [Number]
            },
            paymentFailed: {
                enabled: Boolean,
                retryCount: Number
            }
        }
    },
    metadata: {
        tags: [String],
        category: String,
        priority: {
            type: Number,
            default: 0
        },
        displayOrder: {
            type: Number,
            default: 0
        },
        custom: Schema.Types.Mixed
    },
    schedule: {
        activationDate: Date,
        deactivationDate: Date,
        maintenanceWindows: [{
            start: Date,
            end: Date,
            description: String,
            impact: {
                type: String,
                enum: ['none', 'partial', 'full']
            }
        }]
    },
    analytics: {
        subscribers: {
            total: {
                type: Number,
                default: 0
            },
            active: {
                type: Number,
                default: 0
            },
            trial: {
                type: Number,
                default: 0
            },
            cancelled: {
                type: Number,
                default: 0
            }
        },
        revenue: {
            monthly: {
                type: Number,
                default: 0
            },
            yearly: {
                type: Number,
                default: 0
            },
            lifetime: {
                type: Number,
                default: 0
            }
        },
        metrics: Schema.Types.Mixed
    }
}, {
    timestamps: true
});

// İndeksler
subscriptionPlanSchema.index({ code: 1 });
subscriptionPlanSchema.index({ type: 1, status: 1 });
subscriptionPlanSchema.index({ 'pricing.currency': 1 });
subscriptionPlanSchema.index({ 'metadata.tags': 1 });
subscriptionPlanSchema.index({ 'metadata.category': 1 });
subscriptionPlanSchema.index({ 'schedule.activationDate': 1 });
subscriptionPlanSchema.index({ 'schedule.deactivationDate': 1 });

// Statik Metodlar
subscriptionPlanSchema.statics.search = async function(query = {}, options = {}) {
    const {
        type,
        status,
        visibility,
        currency,
        minPrice,
        maxPrice,
        features,
        tags,
        category,
        limit = 50,
        skip = 0,
        sort = { 'metadata.displayOrder': 1 }
    } = options;

    const filter = { ...query };

    if (type) filter.type = type;
    if (status) filter.status = status;
    if (visibility) filter.visibility = visibility;
    if (currency) filter['pricing.currency'] = currency;
    if (minPrice || maxPrice) {
        filter['pricing.intervals.price'] = {};
        if (minPrice) filter['pricing.intervals.price'].$gte = minPrice;
        if (maxPrice) filter['pricing.intervals.price'].$lte = maxPrice;
    }
    if (features) {
        filter['features.name'] = { $in: features };
    }
    if (tags) {
        filter['metadata.tags'] = { $in: tags };
    }
    if (category) {
        filter['metadata.category'] = category;
    }

    return this.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit);
};

subscriptionPlanSchema.statics.createPlan = async function(data) {
    const plan = new this(data);
    await plan.save();
    return plan;
};

subscriptionPlanSchema.statics.getActivePlans = async function(options = {}) {
    return this.find({
        status: 'active',
        visibility: 'public',
        ...options
    }).sort({ 'metadata.displayOrder': 1 });
};

subscriptionPlanSchema.statics.getPlanByCode = async function(code) {
    return this.findOne({ code: code.toUpperCase() });
};

// Instance Metodlar
subscriptionPlanSchema.methods.toPublicJSON = function() {
    return {
        id: this._id,
        name: this.name,
        code: this.code,
        description: this.description,
        type: this.type,
        status: this.status,
        visibility: this.visibility,
        features: this.features.map(feature => ({
            name: feature.name,
            description: feature.description,
            value: feature.value,
            limit: feature.limit,
            enabled: feature.enabled
        })),
        pricing: {
            currency: this.pricing.currency,
            intervals: this.pricing.intervals.map(interval => ({
                type: interval.type,
                price: interval.price,
                originalPrice: interval.originalPrice,
                discount: interval.discount,
                trialDays: interval.trialDays,
                setupFee: interval.setupFee
            })),
            customPricing: this.pricing.customPricing.enabled ? {
                minPrice: this.pricing.customPricing.minPrice,
                maxPrice: this.pricing.customPricing.maxPrice,
                pricingModel: this.pricing.customPricing.pricingModel
            } : undefined
        },
        limits: {
            users: this.limits.users,
            storage: this.limits.storage,
            bandwidth: this.limits.bandwidth,
            api: this.limits.api
        },
        restrictions: {
            allowedCountries: this.restrictions.allowedCountries,
            allowedDevices: this.restrictions.allowedDevices
        },
        metadata: {
            tags: this.metadata.tags,
            category: this.metadata.category,
            priority: this.metadata.priority
        }
    };
};

subscriptionPlanSchema.methods.calculatePrice = function(interval, quantity = 1, customPrice = null) {
    const intervalData = this.pricing.intervals.find(i => i.type === interval);
    if (!intervalData) {
        throw new Error(`Invalid interval: ${interval}`);
    }

    if (this.pricing.customPricing.enabled && customPrice !== null) {
        if (customPrice < this.pricing.customPricing.minPrice) {
            throw new Error('Price below minimum allowed');
        }
        if (customPrice > this.pricing.customPricing.maxPrice) {
            throw new Error('Price above maximum allowed');
        }
        return customPrice * quantity;
    }

    let price = intervalData.price;
    if (intervalData.discount) {
        price = price * (1 - intervalData.discount / 100);
    }

    return price * quantity;
};

subscriptionPlanSchema.methods.validateFeature = function(featureName, value) {
    const feature = this.features.find(f => f.name === featureName);
    if (!feature) {
        throw new Error(`Feature not found: ${featureName}`);
    }

    if (!feature.enabled) {
        throw new Error(`Feature is disabled: ${featureName}`);
    }

    if (feature.limit !== undefined && value > feature.limit) {
        throw new Error(`Feature limit exceeded: ${featureName}`);
    }

    return true;
};

subscriptionPlanSchema.methods.addPromotion = async function(promotion) {
    if (this.promotions.some(p => p.code === promotion.code)) {
        throw new Error('Promotion code already exists');
    }

    this.promotions.push(promotion);
    await this.save();
    return this;
};

subscriptionPlanSchema.methods.updateAnalytics = async function(metrics) {
    this.analytics = {
        ...this.analytics,
        ...metrics
    };
    await this.save();
    return this;
};

const SubscriptionPlan = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);

module.exports = SubscriptionPlan; 