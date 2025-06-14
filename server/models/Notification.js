const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const notificationSchema = new Schema({
    // Temel Alanlar
    recipient: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    type: {
        type: String,
        required: true,
        enum: [
            // Sistem Bildirimleri
            'system_update', 'maintenance', 'security_alert',
            // Kullanıcı Bildirimleri
            'welcome', 'verification', 'password_reset',
            // Abonelik Bildirimleri
            'subscription_created', 'subscription_updated',
            'subscription_cancelled', 'payment_success',
            'payment_failed', 'trial_ending',
            // İçerik Bildirimleri
            'new_comment', 'reply_received', 'mention',
            'content_approved', 'content_rejected',
            // Etkileşim Bildirimleri
            'like_received', 'follow_received',
            'message_received', 'invitation_received',
            // Özel Bildirimler
            'custom'
        ]
    },
    status: {
        type: String,
        required: true,
        enum: [
            'pending', 'sent', 'delivered',
            'read', 'failed', 'cancelled'
        ],
        default: 'pending'
    },
    priority: {
        type: String,
        required: true,
        enum: ['low', 'normal', 'high', 'urgent'],
        default: 'normal'
    },
    // İçerik
    content: {
        title: {
            type: String,
            required: true
        },
        body: {
            type: String,
            required: true
        },
        data: Schema.Types.Mixed,
        template: {
            name: String,
            version: String,
            variables: Schema.Types.Mixed
        },
        actions: [{
            type: {
                type: String,
                enum: ['link', 'button', 'custom']
            },
            label: String,
            url: String,
            method: String,
            data: Schema.Types.Mixed
        }],
        attachments: [{
            type: {
                type: String,
                enum: ['image', 'document', 'audio', 'video', 'custom']
            },
            url: String,
            name: String,
            size: Number,
            mimeType: String
        }]
    },
    // Dağıtım
    delivery: {
        channels: [{
            type: {
                type: String,
                required: true,
                enum: ['email', 'sms', 'push', 'in_app', 'webhook', 'custom']
            },
            status: {
                type: String,
                enum: ['pending', 'sent', 'delivered', 'failed']
            },
            sentAt: Date,
            deliveredAt: Date,
            error: String,
            metadata: Schema.Types.Mixed
        }],
        schedule: {
            sendAt: Date,
            expiresAt: Date,
            retryCount: {
                type: Number,
                default: 0
            },
            maxRetries: {
                type: Number,
                default: 3
            },
            retryDelay: {
                type: Number,
                default: 300000 // 5 dakika
            }
        },
        preferences: {
            quietHours: {
                enabled: Boolean,
                start: String, // HH:mm format
                end: String,   // HH:mm format
                timezone: String
            },
            doNotDisturb: {
                enabled: Boolean,
                until: Date
            }
        }
    },
    // Hedef ve Bağlam
    target: {
        type: {
            type: String,
            enum: [
                'user', 'post', 'comment', 'message',
                'subscription', 'payment', 'system',
                'custom'
            ]
        },
        id: Schema.Types.ObjectId,
        metadata: Schema.Types.Mixed
    },
    context: {
        source: {
            type: String,
            enum: ['web', 'mobile', 'api', 'system', 'custom']
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
        device: {
            type: String,
            enum: ['desktop', 'mobile', 'tablet', 'other']
        },
        browser: String,
        os: String,
        app: {
            name: String,
            version: String
        }
    },
    // Etkileşim ve Metrikler
    engagement: {
        opened: {
            type: Boolean,
            default: false
        },
        openedAt: Date,
        clicked: [{
            action: String,
            timestamp: Date,
            data: Schema.Types.Mixed
        }],
        converted: {
            type: Boolean,
            default: false
        },
        convertedAt: Date,
        feedback: {
            rating: Number,
            comment: String,
            timestamp: Date
        }
    },
    // Gruplama ve İlişkiler
    group: {
        id: String,
        type: String,
        count: Number,
        parent: Schema.Types.ObjectId
    },
    related: [{
        type: Schema.Types.ObjectId,
        ref: 'Notification'
    }],
    // Metadata
    metadata: {
        tags: [String],
        category: String,
        campaign: String,
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
notificationSchema.index({ type: 1, status: 1 });
notificationSchema.index({ 'delivery.schedule.sendAt': 1 });
notificationSchema.index({ 'delivery.schedule.expiresAt': 1 });
notificationSchema.index({ 'target.type': 1, 'target.id': 1 });
notificationSchema.index({ 'metadata.tags': 1 });
notificationSchema.index({ 'metadata.campaign': 1 });
notificationSchema.index({ createdAt: -1 });

// Statik Metodlar
notificationSchema.statics.search = async function(query = {}, options = {}) {
    const {
        recipient,
        type,
        status,
        priority,
        startDate,
        endDate,
        channel,
        target,
        tags,
        limit = 50,
        skip = 0,
        sort = { createdAt: -1 }
    } = options;

    const filter = { ...query };

    if (recipient) filter.recipient = recipient;
    if (type) filter.type = type;
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = startDate;
        if (endDate) filter.createdAt.$lte = endDate;
    }
    if (channel) {
        filter['delivery.channels.type'] = channel;
    }
    if (target) {
        filter['target.type'] = target.type;
        filter['target.id'] = target.id;
    }
    if (tags) {
        filter['metadata.tags'] = { $in: tags };
    }

    return this.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('recipient', 'username email');
};

notificationSchema.statics.createNotification = async function(data) {
    const notification = new this(data);
    await notification.save();
    return notification;
};

notificationSchema.statics.getUserNotifications = async function(userId, options = {}) {
    return this.find({
        recipient: userId,
        ...options
    }).sort({ createdAt: -1 });
};

notificationSchema.statics.getUnreadCount = async function(userId) {
    return this.countDocuments({
        recipient: userId,
        status: { $in: ['sent', 'delivered'] },
        'engagement.opened': false
    });
};

// Instance Metodlar
notificationSchema.methods.toPublicJSON = function() {
    return {
        id: this._id,
        type: this.type,
        status: this.status,
        priority: this.priority,
        content: {
            title: this.content.title,
            body: this.content.body,
            actions: this.content.actions,
            attachments: this.content.attachments
        },
        delivery: {
            channels: this.delivery.channels.map(channel => ({
                type: channel.type,
                status: channel.status,
                sentAt: channel.sentAt,
                deliveredAt: channel.deliveredAt
            })),
            schedule: {
                sendAt: this.delivery.schedule.sendAt,
                expiresAt: this.delivery.schedule.expiresAt
            }
        },
        target: this.target,
        engagement: {
            opened: this.engagement.opened,
            openedAt: this.engagement.openedAt,
            clicked: this.engagement.clicked,
            converted: this.engagement.converted
        },
        metadata: {
            tags: this.metadata.tags,
            category: this.metadata.category,
            campaign: this.metadata.campaign
        },
        createdAt: this.createdAt,
        updatedAt: this.updatedAt
    };
};

notificationSchema.methods.send = async function() {
    if (this.status !== 'pending') {
        throw new Error('Notification is not in pending status');
    }

    const now = new Date();
    
    // Zamanlama kontrolü
    if (this.delivery.schedule.sendAt && this.delivery.schedule.sendAt > now) {
        return this;
    }

    // Sessiz saatler kontrolü
    if (this.delivery.preferences.quietHours.enabled) {
        const currentTime = now.toLocaleTimeString('tr-TR', { hour12: false });
        if (currentTime >= this.delivery.preferences.quietHours.start &&
            currentTime <= this.delivery.preferences.quietHours.end) {
            return this;
        }
    }

    // Rahatsız etmeyin kontrolü
    if (this.delivery.preferences.doNotDisturb.enabled &&
        this.delivery.preferences.doNotDisturb.until > now) {
        return this;
    }

    // Her kanal için bildirim gönder
    for (const channel of this.delivery.channels) {
        try {
            // Kanal bazlı bildirim gönderme işlemi
            // Bu kısım, kullanılan bildirim sistemine göre özelleştirilmeli
            channel.status = 'sent';
            channel.sentAt = now;
        } catch (error) {
            channel.status = 'failed';
            channel.error = error.message;

            // Yeniden deneme
            if (this.delivery.schedule.retryCount < this.delivery.schedule.maxRetries) {
                this.delivery.schedule.retryCount += 1;
                this.delivery.schedule.sendAt = new Date(
                    now.getTime() + this.delivery.schedule.retryDelay
                );
            }
        }
    }

    // Durum güncelleme
    const allFailed = this.delivery.channels.every(c => c.status === 'failed');
    const allSent = this.delivery.channels.every(c => c.status === 'sent');
    
    this.status = allFailed ? 'failed' : (allSent ? 'sent' : 'pending');
    
    await this.save();
    return this;
};

notificationSchema.methods.markAsRead = async function() {
    if (!this.engagement.opened) {
        this.engagement.opened = true;
        this.engagement.openedAt = new Date();
        await this.save();
    }
    return this;
};

notificationSchema.methods.trackClick = async function(action, data = {}) {
    this.engagement.clicked.push({
        action,
        timestamp: new Date(),
        data
    });
    await this.save();
    return this;
};

notificationSchema.methods.trackConversion = async function() {
    if (!this.engagement.converted) {
        this.engagement.converted = true;
        this.engagement.convertedAt = new Date();
        await this.save();
    }
    return this;
};

notificationSchema.methods.addFeedback = async function(rating, comment = '') {
    this.engagement.feedback = {
        rating,
        comment,
        timestamp: new Date()
    };
    await this.save();
    return this;
};

notificationSchema.methods.cancel = async function() {
    if (this.status === 'pending') {
        this.status = 'cancelled';
        await this.save();
    }
    return this;
};

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification; 