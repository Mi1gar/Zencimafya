const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const paymentSchema = new Schema({
    // Temel Alanlar
    transactionId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    orderId: {
        type: String,
        required: true,
        index: true
    },
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        required: true,
        enum: [
            'subscription', 'one_time', 'refund',
            'credit', 'withdrawal', 'transfer',
            'custom'
        ]
    },
    status: {
        type: String,
        required: true,
        enum: [
            'pending', 'processing', 'completed',
            'failed', 'refunded', 'cancelled',
            'disputed', 'reversed'
        ],
        default: 'pending'
    },
    amount: {
        value: {
            type: Number,
            required: true
        },
        currency: {
            type: String,
            required: true,
            default: 'TRY'
        },
        exchangeRate: {
            type: Number,
            default: 1
        },
        originalValue: Number,
        originalCurrency: String,
        fees: {
            processing: Number,
            tax: Number,
            custom: Number
        },
        discounts: [{
            type: {
                type: String,
                enum: ['coupon', 'promo', 'loyalty', 'custom']
            },
            code: String,
            value: Number,
            description: String
        }]
    },
    payment: {
        method: {
            type: String,
            required: true,
            enum: [
                'credit_card', 'debit_card', 'bank_transfer',
                'wallet', 'crypto', 'cash', 'custom'
            ]
        },
        provider: {
            name: {
                type: String,
                required: true
            },
            transactionId: String,
            reference: String,
            gateway: String
        },
        details: {
            card: {
                last4: String,
                brand: String,
                expiryMonth: Number,
                expiryYear: Number,
                holderName: String
            },
            bank: {
                name: String,
                accountNumber: String,
                iban: String,
                swift: String
            },
            wallet: {
                type: String,
                address: String
            },
            crypto: {
                currency: String,
                address: String,
                txHash: String
            }
        },
        metadata: Schema.Types.Mixed
    },
    billing: {
        name: String,
        email: String,
        phone: String,
        address: {
            street: String,
            city: String,
            state: String,
            country: String,
            postalCode: String
        },
        taxId: String,
        company: {
            name: String,
            taxId: String,
            registrationNumber: String
        }
    },
    items: [{
        type: {
            type: String,
            required: true
        },
        name: {
            type: String,
            required: true
        },
        description: String,
        quantity: {
            type: Number,
            required: true,
            default: 1
        },
        unitPrice: {
            type: Number,
            required: true
        },
        total: {
            type: Number,
            required: true
        },
        metadata: Schema.Types.Mixed
    }],
    subscription: {
        plan: {
            type: Schema.Types.ObjectId,
            ref: 'SubscriptionPlan'
        },
        interval: {
            type: String,
            enum: ['daily', 'weekly', 'monthly', 'yearly', 'custom']
        },
        startDate: Date,
        endDate: Date,
        trialEnd: Date,
        cancelAtPeriodEnd: {
            type: Boolean,
            default: false
        },
        cancelledAt: Date,
        currentPeriod: {
            start: Date,
            end: Date
        }
    },
    refund: {
        amount: Number,
        reason: String,
        status: {
            type: String,
            enum: ['pending', 'processing', 'completed', 'failed']
        },
        processedAt: Date,
        processedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User'
        },
        notes: String
    },
    dispute: {
        status: {
            type: String,
            enum: ['open', 'won', 'lost', 'closed']
        },
        reason: String,
        evidence: [{
            type: {
                type: String,
                enum: ['document', 'image', 'text', 'custom']
            },
            url: String,
            description: String,
            submittedAt: Date
        }],
        resolution: {
            outcome: String,
            date: Date,
            notes: String
        }
    },
    notifications: [{
        type: {
            type: String,
            enum: [
                'payment_received', 'payment_failed',
                'refund_processed', 'dispute_opened',
                'subscription_updated', 'custom'
            ]
        },
        status: {
            type: String,
            enum: ['pending', 'sent', 'failed']
        },
        channel: {
            type: String,
            enum: ['email', 'sms', 'push', 'webhook', 'custom']
        },
        recipient: String,
        sentAt: Date,
        error: String
    }],
    history: [{
        status: {
            type: String,
            required: true
        },
        timestamp: {
            type: Date,
            required: true
        },
        actor: {
            type: Schema.Types.ObjectId,
            ref: 'User'
        },
        action: {
            type: String,
            required: true
        },
        details: Schema.Types.Mixed
    }],
    metadata: {
        source: {
            type: String,
            enum: ['web', 'mobile', 'api', 'pos', 'custom']
        },
        ip: String,
        userAgent: String,
        device: {
            type: String,
            enum: ['desktop', 'mobile', 'tablet', 'other']
        },
        location: {
            country: String,
            city: String,
            coordinates: {
                type: [Number],
                index: '2dsphere'
            }
        },
        custom: Schema.Types.Mixed
    },
    expiresAt: {
        type: Date,
        index: { expireAfterSeconds: 0 }
    }
}, {
    timestamps: true
});

// İndeksler
paymentSchema.index({ user: 1, status: 1 });
paymentSchema.index({ 'payment.provider.transactionId': 1 });
paymentSchema.index({ 'subscription.plan': 1 });
paymentSchema.index({ 'billing.email': 1 });
paymentSchema.index({ 'metadata.source': 1 });
paymentSchema.index({ createdAt: -1 });

// Statik Metodlar
paymentSchema.statics.search = async function(query = {}, options = {}) {
    const {
        user,
        type,
        status,
        startDate,
        endDate,
        minAmount,
        maxAmount,
        currency,
        paymentMethod,
        limit = 50,
        skip = 0,
        sort = { createdAt: -1 }
    } = options;

    const filter = { ...query };

    if (user) filter.user = user;
    if (type) filter.type = type;
    if (status) filter.status = status;
    if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = startDate;
        if (endDate) filter.createdAt.$lte = endDate;
    }
    if (minAmount || maxAmount) {
        filter['amount.value'] = {};
        if (minAmount) filter['amount.value'].$gte = minAmount;
        if (maxAmount) filter['amount.value'].$lte = maxAmount;
    }
    if (currency) filter['amount.currency'] = currency;
    if (paymentMethod) filter['payment.method'] = paymentMethod;

    return this.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('user', 'username email')
        .populate('subscription.plan');
};

paymentSchema.statics.createPayment = async function(data) {
    const payment = new this(data);
    await payment.save();
    return payment;
};

paymentSchema.statics.getUserPayments = async function(userId, options = {}) {
    return this.find({ user: userId, ...options })
        .sort({ createdAt: -1 })
        .populate('subscription.plan');
};

paymentSchema.statics.getSubscriptionPayments = async function(subscriptionId, options = {}) {
    return this.find({
        'subscription.plan': subscriptionId,
        type: 'subscription',
        ...options
    }).sort({ createdAt: -1 });
};

// Instance Metodlar
paymentSchema.methods.toPublicJSON = function() {
    return {
        id: this._id,
        transactionId: this.transactionId,
        orderId: this.orderId,
        type: this.type,
        status: this.status,
        amount: {
            value: this.amount.value,
            currency: this.amount.currency,
            fees: this.amount.fees,
            discounts: this.amount.discounts
        },
        payment: {
            method: this.payment.method,
            provider: {
                name: this.payment.provider.name,
                transactionId: this.payment.provider.transactionId
            },
            details: {
                card: this.payment.details.card ? {
                    last4: this.payment.details.card.last4,
                    brand: this.payment.details.card.brand
                } : undefined,
                bank: this.payment.details.bank ? {
                    name: this.payment.details.bank.name,
                    last4: this.payment.details.bank.accountNumber?.slice(-4)
                } : undefined
            }
        },
        billing: {
            name: this.billing.name,
            email: this.billing.email,
            address: this.billing.address
        },
        items: this.items.map(item => ({
            type: item.type,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total
        })),
        subscription: this.subscription ? {
            interval: this.subscription.interval,
            startDate: this.subscription.startDate,
            endDate: this.subscription.endDate,
            currentPeriod: this.subscription.currentPeriod
        } : undefined,
        refund: this.refund ? {
            amount: this.refund.amount,
            status: this.refund.status,
            processedAt: this.refund.processedAt
        } : undefined,
        dispute: this.dispute ? {
            status: this.dispute.status,
            reason: this.dispute.reason
        } : undefined,
        metadata: {
            source: this.metadata.source,
            device: this.metadata.device
        },
        createdAt: this.createdAt,
        updatedAt: this.updatedAt
    };
};

paymentSchema.methods.updateStatus = async function(status, actor, details = {}) {
    this.status = status;
    this.history.push({
        status,
        timestamp: new Date(),
        actor,
        action: 'status_update',
        details
    });

    // Bildirim gönder
    await this.sendNotification({
        type: `payment_${status}`,
        details
    });

    await this.save();
    return this;
};

paymentSchema.methods.processRefund = async function(amount, reason, actor, notes = '') {
    if (this.status !== 'completed') {
        throw new Error('Can only refund completed payments');
    }

    if (amount > this.amount.value) {
        throw new Error('Refund amount cannot exceed payment amount');
    }

    this.refund = {
        amount,
        reason,
        status: 'processing',
        processedAt: new Date(),
        processedBy: actor,
        notes
    };

    this.status = 'refunded';
    this.history.push({
        status: 'refunded',
        timestamp: new Date(),
        actor,
        action: 'refund_processed',
        details: { amount, reason, notes }
    });

    // Bildirim gönder
    await this.sendNotification({
        type: 'refund_processed',
        details: { amount, reason }
    });

    await this.save();
    return this;
};

paymentSchema.methods.openDispute = async function(reason, evidence = []) {
    if (this.status !== 'completed') {
        throw new Error('Can only dispute completed payments');
    }

    this.dispute = {
        status: 'open',
        reason,
        evidence,
        resolution: null
    };

    this.status = 'disputed';
    this.history.push({
        status: 'disputed',
        timestamp: new Date(),
        action: 'dispute_opened',
        details: { reason, evidence }
    });

    // Bildirim gönder
    await this.sendNotification({
        type: 'dispute_opened',
        details: { reason }
    });

    await this.save();
    return this;
};

paymentSchema.methods.resolveDispute = async function(outcome, notes, actor) {
    if (!this.dispute || this.dispute.status !== 'open') {
        throw new Error('No open dispute found');
    }

    this.dispute.status = outcome === 'won' ? 'won' : 'lost';
    this.dispute.resolution = {
        outcome,
        date: new Date(),
        notes
    };

    this.status = outcome === 'won' ? 'refunded' : 'completed';
    this.history.push({
        status: this.status,
        timestamp: new Date(),
        actor,
        action: 'dispute_resolved',
        details: { outcome, notes }
    });

    // Bildirim gönder
    await this.sendNotification({
        type: 'dispute_resolved',
        details: { outcome, notes }
    });

    await this.save();
    return this;
};

paymentSchema.methods.sendNotification = async function(notification) {
    const channels = ['email', 'sms', 'push'];
    
    for (const channel of channels) {
        try {
            // Bildirim gönderme işlemi
            // Bu kısım, kullanılan bildirim sistemine göre özelleştirilmeli
            this.notifications.push({
                type: notification.type,
                status: 'sent',
                channel,
                recipient: this.billing.email,
                sentAt: new Date()
            });
        } catch (error) {
            this.notifications.push({
                type: notification.type,
                status: 'failed',
                channel,
                recipient: this.billing.email,
                error: error.message,
                sentAt: new Date()
            });
        }
    }

    await this.save();
    return this;
};

paymentSchema.methods.calculateTotal = function() {
    let total = this.items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);

    // İndirimleri uygula
    if (this.amount.discounts) {
        total = this.amount.discounts.reduce((sum, discount) => sum - discount.value, total);
    }

    // Ücretleri ekle
    if (this.amount.fees) {
        total += Object.values(this.amount.fees).reduce((sum, fee) => sum + (fee || 0), 0);
    }

    return total;
};

paymentSchema.methods.validateAmount = function() {
    const calculatedTotal = this.calculateTotal();
    return Math.abs(calculatedTotal - this.amount.value) < 0.01;
};

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment; 