const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const sessionSchema = new Schema({
    // Temel Alanlar
    token: {
        type: String,
        required: true,
        unique: true,
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
            'web', 'mobile', 'api', 'desktop', 'cli',
            'admin', 'system', 'custom'
        ]
    },
    status: {
        type: String,
        required: true,
        enum: [
            'active', 'expired', 'revoked', 'suspended',
            'blocked', 'deleted'
        ],
        default: 'active'
    },
    device: {
        type: {
            type: String,
            enum: ['desktop', 'mobile', 'tablet', 'other'],
            required: true
        },
        name: String,
        model: String,
        os: {
            name: String,
            version: String
        },
        browser: {
            name: String,
            version: String
        },
        fingerprint: String
    },
    location: {
        ip: {
            type: String,
            required: true
        },
        country: String,
        city: String,
        coordinates: {
            type: [Number],
            index: '2dsphere'
        },
        isp: String,
        proxy: {
            type: Boolean,
            default: false
        },
        vpn: {
            type: Boolean,
            default: false
        },
        tor: {
            type: Boolean,
            default: false
        }
    },
    security: {
        mfa: {
            enabled: {
                type: Boolean,
                default: false
            },
            method: {
                type: String,
                enum: ['none', 'totp', 'sms', 'email', 'custom']
            },
            verified: {
                type: Boolean,
                default: false
            },
            lastVerified: Date
        },
        ipWhitelist: [{
            ip: String,
            description: String,
            addedAt: Date
        }],
        lastPasswordChange: Date,
        suspiciousActivities: [{
            type: {
                type: String,
                enum: [
                    'multiple_failed_login', 'unusual_location',
                    'unusual_time', 'unusual_device', 'unusual_activity',
                    'suspicious_ip', 'custom'
                ]
            },
            details: String,
            timestamp: Date,
            resolved: {
                type: Boolean,
                default: false
            }
        }]
    },
    activity: {
        lastActive: Date,
        lastLogin: Date,
        lastLogout: Date,
        loginCount: {
            type: Number,
            default: 0
        },
        failedLoginAttempts: {
            type: Number,
            default: 0
        },
        lastFailedLogin: Date,
        actions: [{
            type: {
                type: String,
                enum: [
                    'login', 'logout', 'password_change',
                    'profile_update', 'security_update',
                    'permission_change', 'custom'
                ]
            },
            timestamp: Date,
            details: Schema.Types.Mixed
        }]
    },
    permissions: {
        roles: [{
            type: String
        }],
        scopes: [{
            type: String
        }],
        restrictions: [{
            type: {
                type: String,
                enum: [
                    'ip', 'time', 'device', 'location',
                    'action', 'resource', 'custom'
                ]
            },
            value: Schema.Types.Mixed,
            reason: String
        }]
    },
    settings: {
        rememberMe: {
            type: Boolean,
            default: false
        },
        notifications: {
            type: Boolean,
            default: true
        },
        language: {
            type: String,
            default: 'tr'
        },
        timezone: {
            type: String,
            default: 'Europe/Istanbul'
        },
        theme: {
            type: String,
            default: 'light'
        }
    },
    metadata: {
        userAgent: String,
        headers: Schema.Types.Mixed,
        cookies: Schema.Types.Mixed,
        referrer: String,
        platform: String,
        screen: {
            width: Number,
            height: Number
        },
        timezone: String,
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
sessionSchema.index({ user: 1, status: 1 });
sessionSchema.index({ 'device.fingerprint': 1 });
sessionSchema.index({ 'location.ip': 1 });
sessionSchema.index({ 'activity.lastActive': -1 });
sessionSchema.index({ 'security.suspiciousActivities.timestamp': -1 });

// Statik Metodlar
sessionSchema.statics.search = async function(query = {}, options = {}) {
    const {
        user,
        type,
        status,
        deviceType,
        startDate,
        endDate,
        limit = 50,
        skip = 0,
        sort = { createdAt: -1 }
    } = options;

    const filter = { ...query };

    if (user) filter.user = user;
    if (type) filter.type = type;
    if (status) filter.status = status;
    if (deviceType) filter['device.type'] = deviceType;
    if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = startDate;
        if (endDate) filter.createdAt.$lte = endDate;
    }

    return this.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('user', 'username avatar email');
};

sessionSchema.statics.createSession = async function(data) {
    const session = new this(data);
    await session.save();
    return session;
};

sessionSchema.statics.getActiveSessions = async function(userId) {
    return this.find({
        user: userId,
        status: 'active',
        expiresAt: { $gt: new Date() }
    }).sort({ 'activity.lastActive': -1 });
};

sessionSchema.statics.revokeAllSessions = async function(userId, reason = 'manual_revoke') {
    const sessions = await this.find({
        user: userId,
        status: 'active'
    });

    for (const session of sessions) {
        session.status = 'revoked';
        session.activity.actions.push({
            type: 'logout',
            timestamp: new Date(),
            details: { reason }
        });
        await session.save();
    }

    return sessions;
};

// Instance Metodlar
sessionSchema.methods.toPublicJSON = function() {
    return {
        id: this._id,
        type: this.type,
        status: this.status,
        device: {
            type: this.device.type,
            name: this.device.name,
            os: this.device.os,
            browser: this.device.browser
        },
        location: {
            ip: this.location.ip,
            country: this.location.country,
            city: this.location.city
        },
        security: {
            mfa: {
                enabled: this.security.mfa.enabled,
                method: this.security.mfa.method,
                verified: this.security.mfa.verified
            }
        },
        activity: {
            lastActive: this.activity.lastActive,
            lastLogin: this.activity.lastLogin,
            loginCount: this.activity.loginCount
        },
        permissions: {
            roles: this.permissions.roles,
            scopes: this.permissions.scopes
        },
        settings: this.settings,
        expiresAt: this.expiresAt,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt
    };
};

sessionSchema.methods.updateActivity = async function(action, details = {}) {
    this.activity.lastActive = new Date();
    this.activity.actions.push({
        type: action,
        timestamp: new Date(),
        details
    });
    await this.save();
    return this;
};

sessionSchema.methods.revoke = async function(reason = 'manual_revoke') {
    this.status = 'revoked';
    this.activity.actions.push({
        type: 'logout',
        timestamp: new Date(),
        details: { reason }
    });
    await this.save();
    return this;
};

sessionSchema.methods.suspend = async function(reason = 'suspicious_activity') {
    this.status = 'suspended';
    this.activity.actions.push({
        type: 'security_update',
        timestamp: new Date(),
        details: { reason, action: 'suspend' }
    });
    await this.save();
    return this;
};

sessionSchema.methods.block = async function(reason = 'security_violation') {
    this.status = 'blocked';
    this.activity.actions.push({
        type: 'security_update',
        timestamp: new Date(),
        details: { reason, action: 'block' }
    });
    await this.save();
    return this;
};

sessionSchema.methods.extend = async function(duration) {
    this.expiresAt = new Date(Date.now() + duration * 1000);
    this.activity.actions.push({
        type: 'security_update',
        timestamp: new Date(),
        details: { action: 'extend', duration }
    });
    await this.save();
    return this;
};

const Session = mongoose.model('Session', sessionSchema);

module.exports = Session; 