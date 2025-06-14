const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const commentSchema = new Schema({
    // Temel Alanlar
    content: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        required: true,
        enum: ['post', 'topic', 'media', 'user', 'custom'],
        default: 'post'
    },
    status: {
        type: String,
        enum: ['active', 'hidden', 'deleted', 'spam', 'pending'],
        default: 'active'
    },
    // Hedef ve İlişkiler
    target: {
        type: {
            type: String,
            required: true,
            enum: ['post', 'topic', 'media', 'user', 'custom']
        },
        id: {
            type: Schema.Types.ObjectId,
            required: true,
            refPath: 'target.type'
        }
    },
    author: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    parent: {
        type: Schema.Types.ObjectId,
        ref: 'Comment'
    },
    replies: [{
        type: Schema.Types.ObjectId,
        ref: 'Comment'
    }],
    // Medya ve Ekler
    attachments: [{
        type: {
            type: String,
            enum: ['image', 'video', 'audio', 'file', 'link']
        },
        url: String,
        thumbnail: String,
        name: String,
        size: Number,
        metadata: Schema.Types.Mixed
    }],
    // Etkileşimler
    interactions: {
        likes: [{
            user: {
                type: Schema.Types.ObjectId,
                ref: 'User'
            },
            type: {
                type: String,
                enum: ['like', 'love', 'haha', 'wow', 'sad', 'angry'],
                default: 'like'
            },
            createdAt: {
                type: Date,
                default: Date.now
            }
        }],
        mentions: [{
            user: {
                type: Schema.Types.ObjectId,
                ref: 'User'
            },
            position: Number
        }],
        tags: [{
            name: String,
            position: Number
        }]
    },
    // Moderatör İşlemleri
    moderation: {
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected', 'flagged'],
            default: 'pending'
        },
        reason: String,
        moderatedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User'
        },
        moderatedAt: Date,
        flags: [{
            type: {
                type: String,
                enum: ['spam', 'abuse', 'inappropriate', 'offensive', 'other']
            },
            reason: String,
            user: {
                type: Schema.Types.ObjectId,
                ref: 'User'
            },
            createdAt: {
                type: Date,
                default: Date.now
            }
        }]
    },
    // Metadata
    metadata: {
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
            os: String,
            browser: String
        },
        tags: [String],
        custom: Schema.Types.Mixed
    },
    // İstatistikler
    stats: {
        replyCount: {
            type: Number,
            default: 0
        },
        likeCount: {
            type: Number,
            default: 0
        },
        viewCount: {
            type: Number,
            default: 0
        },
        reportCount: {
            type: Number,
            default: 0
        }
    },
    // Geçmiş
    history: [{
        action: {
            type: String,
            enum: ['create', 'edit', 'delete', 'restore', 'hide', 'flag', 'moderate']
        },
        content: String,
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User'
        },
        timestamp: {
            type: Date,
            default: Date.now
        },
        reason: String,
        metadata: Schema.Types.Mixed
    }]
}, {
    timestamps: true
});

// İndeksler
commentSchema.index({ 'target.type': 1, 'target.id': 1 });
commentSchema.index({ author: 1 });
commentSchema.index({ parent: 1 });
commentSchema.index({ status: 1 });
commentSchema.index({ 'metadata.tags': 1 });
commentSchema.index({ createdAt: -1 });
commentSchema.index({ 'moderation.status': 1 });

// Statik Metodlar
commentSchema.statics.search = async function(query = {}, options = {}) {
    const {
        targetType,
        targetId,
        author,
        parent,
        status,
        tags,
        limit = 50,
        skip = 0,
        sort = { createdAt: -1 }
    } = options;

    const filter = { ...query };
    if (targetType) filter['target.type'] = targetType;
    if (targetId) filter['target.id'] = targetId;
    if (author) filter.author = author;
    if (parent) filter.parent = parent;
    if (status) filter.status = status;
    if (tags) filter['metadata.tags'] = { $in: tags };

    return this.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('author', 'username avatar')
        .populate('parent')
        .populate('moderation.moderatedBy', 'username');
};

commentSchema.statics.createComment = async function(data) {
    const comment = new this(data);
    await comment.save();

    // Ebeveyn yorumun yanıt sayısını güncelle
    if (comment.parent) {
        await this.findByIdAndUpdate(comment.parent, {
            $inc: { 'stats.replyCount': 1 },
            $push: { replies: comment._id }
        });
    }

    return comment;
};

commentSchema.statics.updateStatus = async function(id, status, userId, reason = '') {
    const comment = await this.findById(id);
    if (!comment) throw new Error('Yorum bulunamadı');

    comment.status = status;
    comment.history.push({
        action: 'moderate',
        user: userId,
        reason,
        timestamp: new Date()
    });

    await comment.save();
    return comment;
};

// Instance Metodlar
commentSchema.methods.toPublicJSON = function() {
    return {
        id: this._id,
        content: this.content,
        type: this.type,
        status: this.status,
        target: this.target,
        author: this.author,
        parent: this.parent,
        attachments: this.attachments,
        interactions: {
            likes: this.interactions.likes.length,
            mentions: this.interactions.mentions,
            tags: this.interactions.tags
        },
        moderation: {
            status: this.moderation.status,
            flags: this.moderation.flags.length
        },
        stats: this.stats,
        metadata: {
            tags: this.metadata.tags,
            location: this.metadata.location
        },
        createdAt: this.createdAt,
        updatedAt: this.updatedAt
    };
};

commentSchema.methods.addInteraction = async function(userId, type = 'like') {
    const existingLike = this.interactions.likes.find(
        like => like.user.toString() === userId.toString()
    );

    if (existingLike) {
        if (existingLike.type === type) {
            // Beğeniyi kaldır
            this.interactions.likes = this.interactions.likes.filter(
                like => like.user.toString() !== userId.toString()
            );
            this.stats.likeCount--;
        } else {
            // Beğeni tipini güncelle
            existingLike.type = type;
        }
    } else {
        // Yeni beğeni ekle
        this.interactions.likes.push({
            user: userId,
            type,
            createdAt: new Date()
        });
        this.stats.likeCount++;
    }

    await this.save();
    return this;
};

commentSchema.methods.addFlag = async function(userId, type, reason) {
    const existingFlag = this.moderation.flags.find(
        flag => flag.user.toString() === userId.toString()
    );

    if (!existingFlag) {
        this.moderation.flags.push({
            type,
            reason,
            user: userId,
            createdAt: new Date()
        });
        this.stats.reportCount++;
        await this.save();
    }

    return this;
};

const Comment = mongoose.model('Comment', commentSchema);

module.exports = Comment; 