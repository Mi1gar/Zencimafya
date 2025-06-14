const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const auditSchema = new Schema({
    // Temel Alanlar
    action: {
        type: String,
        required: true,
        enum: [
            'create', 'read', 'update', 'delete', 'login', 'logout',
            'register', 'password_change', 'role_change', 'permission_change',
            'ban', 'unban', 'warn', 'delete_content', 'restore_content',
            'move_content', 'merge_content', 'split_content', 'lock_content',
            'unlock_content', 'pin_content', 'unpin_content', 'feature_content',
            'unfeature_content', 'approve_content', 'reject_content',
            'report_content', 'resolve_report', 'dismiss_report',
            'system_change', 'config_change', 'backup', 'restore',
            'import', 'export', 'custom'
        ]
    },
    category: {
        type: String,
        required: true,
        enum: [
            'auth', 'user', 'content', 'moderation', 'system',
            'security', 'backup', 'import_export', 'custom'
        ]
    },
    actor: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    target: {
        type: {
            type: String,
            enum: ['user', 'topic', 'post', 'comment', 'message', 'category', 'tag', 'file', 'system'],
            required: true
        },
        id: {
            type: Schema.Types.ObjectId,
            refPath: 'target.type',
            required: true
        },
        changes: {
            before: Schema.Types.Mixed,
            after: Schema.Types.Mixed
        }
    },
    details: {
        reason: String,
        description: String,
        metadata: Schema.Types.Mixed,
        affectedItems: [{
            type: {
                type: String,
                enum: ['user', 'topic', 'post', 'comment', 'message', 'category', 'tag', 'file']
            },
            id: Schema.Types.ObjectId
        }]
    },
    context: {
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
        session: {
            id: String,
            device: String,
            browser: String,
            os: String
        },
        request: {
            method: String,
            url: String,
            params: Schema.Types.Mixed,
            query: Schema.Types.Mixed,
            body: Schema.Types.Mixed,
            headers: Schema.Types.Mixed
        }
    },
    status: {
        type: String,
        enum: ['success', 'failure', 'pending', 'reverted'],
        default: 'success'
    },
    impact: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'low'
    },
    visibility: {
        type: String,
        enum: ['public', 'private', 'system'],
        default: 'private'
    },
    retention: {
        type: {
            type: String,
            enum: ['temporary', 'permanent'],
            default: 'permanent'
        },
        expiresAt: Date,
        archiveAfter: Date
    },
    relatedAudits: [{
        type: Schema.Types.ObjectId,
        ref: 'Audit'
    }]
}, {
    timestamps: true
});

// İndeksler
auditSchema.index({ action: 1, category: 1, createdAt: -1 });
auditSchema.index({ actor: 1, createdAt: -1 });
auditSchema.index({ 'target.type': 1, 'target.id': 1 });
auditSchema.index({ status: 1, impact: 1 });
auditSchema.index({ visibility: 1 });
auditSchema.index({ 'retention.expiresAt': 1 }, { expireAfterSeconds: 0 });

// Statik Metodlar
auditSchema.statics.search = async function(query = {}, options = {}) {
    const {
        action,
        category,
        actor,
        targetType,
        targetId,
        status,
        impact,
        visibility,
        startDate,
        endDate,
        limit = 50,
        skip = 0,
        sort = { createdAt: -1 }
    } = options;

    const filter = { ...query };

    if (action) filter.action = action;
    if (category) filter.category = category;
    if (actor) filter.actor = actor;
    if (targetType) filter['target.type'] = targetType;
    if (targetId) filter['target.id'] = targetId;
    if (status) filter.status = status;
    if (impact) filter.impact = impact;
    if (visibility) filter.visibility = visibility;
    if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = startDate;
        if (endDate) filter.createdAt.$lte = endDate;
    }

    return this.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('actor', 'username avatar')
        .populate('target.id')
        .populate('relatedAudits');
};

auditSchema.statics.createAudit = async function(data) {
    const audit = new this(data);
    await audit.save();
    return audit;
};

auditSchema.statics.bulkCreate = async function(audits) {
    return this.insertMany(audits);
};

auditSchema.statics.getUserAuditSummary = async function(userId, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const pipeline = [
        {
            $match: {
                actor: userId,
                createdAt: { $gte: startDate }
            }
        },
        {
            $group: {
                _id: {
                    action: '$action',
                    category: '$category',
                    status: '$status'
                },
                count: { $sum: 1 },
                lastAction: { $max: '$createdAt' }
            }
        },
        {
            $group: {
                _id: '$_id.category',
                actions: {
                    $push: {
                        action: '$_id.action',
                        status: '$_id.status',
                        count: '$count',
                        lastAction: '$lastAction'
                    }
                },
                totalActions: { $sum: '$count' }
            }
        }
    ];

    return this.aggregate(pipeline);
};

auditSchema.statics.revertAudit = async function(auditId, revertReason) {
    const audit = await this.findById(auditId);
    if (!audit) throw new Error('Audit kaydı bulunamadı');
    if (audit.status === 'reverted') throw new Error('Bu işlem zaten geri alınmış');

    // İşlemi geri al
    const revertedAudit = new this({
        action: 'revert',
        category: audit.category,
        actor: audit.actor,
        target: audit.target,
        details: {
            reason: revertReason,
            revertedAudit: auditId
        },
        status: 'success',
        impact: audit.impact,
        visibility: audit.visibility,
        relatedAudits: [auditId]
    });

    await revertedAudit.save();
    audit.status = 'reverted';
    audit.relatedAudits.push(revertedAudit._id);
    await audit.save();

    return revertedAudit;
};

// Instance Metodlar
auditSchema.methods.toPublicJSON = function() {
    return {
        id: this._id,
        action: this.action,
        category: this.category,
        actor: this.actor,
        target: {
            type: this.target.type,
            id: this.target.id,
            changes: this.target.changes
        },
        details: {
            reason: this.details.reason,
            description: this.details.description,
            affectedItems: this.details.affectedItems
        },
        status: this.status,
        impact: this.impact,
        visibility: this.visibility,
        createdAt: this.createdAt
    };
};

auditSchema.methods.archive = async function() {
    this.retention.archiveAfter = new Date();
    await this.save();
    return this;
};

const Audit = mongoose.model('Audit', auditSchema);

module.exports = Audit; 