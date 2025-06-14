const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const messageSchema = new Schema({
    // Temel Alanlar
    type: {
        type: String,
        required: true,
        enum: ['direct', 'group', 'system', 'notification', 'custom'],
        default: 'direct'
    },
    status: {
        type: String,
        enum: ['sent', 'delivered', 'read', 'deleted', 'failed'],
        default: 'sent'
    },
    priority: {
        type: String,
        enum: ['low', 'normal', 'high', 'urgent'],
        default: 'normal'
    },
    // İçerik
    content: {
        text: {
            type: String,
            required: true,
            trim: true
        },
        format: {
            type: String,
            enum: ['plain', 'html', 'markdown', 'custom'],
            default: 'plain'
        },
        attachments: [{
            type: {
                type: String,
                enum: ['image', 'video', 'audio', 'file', 'location', 'contact', 'custom']
            },
            url: String,
            thumbnail: String,
            name: String,
            size: Number,
            metadata: Schema.Types.Mixed
        }],
        metadata: {
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
            }],
            links: [{
                url: String,
                title: String,
                description: String,
                thumbnail: String
            }],
            custom: Schema.Types.Mixed
        }
    },
    // Gönderici ve Alıcılar
    sender: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    recipients: [{
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        status: {
            type: String,
            enum: ['sent', 'delivered', 'read', 'deleted'],
            default: 'sent'
        },
        readAt: Date,
        deletedAt: Date
    }],
    // Grup ve Konuşma
    conversation: {
        type: Schema.Types.ObjectId,
        ref: 'Conversation'
    },
    thread: {
        parent: {
            type: Schema.Types.ObjectId,
            ref: 'Message'
        },
        replies: [{
            type: Schema.Types.ObjectId,
            ref: 'Message'
        }],
        isReply: {
            type: Boolean,
            default: false
        }
    },
    // Mesaj Özellikleri
    features: {
        isEdited: {
            type: Boolean,
            default: false
        },
        isPinned: {
            type: Boolean,
            default: false
        },
        isEncrypted: {
            type: Boolean,
            default: false
        },
        isScheduled: {
            type: Boolean,
            default: false
        },
        isForwarded: {
            type: Boolean,
            default: false
        },
        forwardInfo: {
            from: {
                type: Schema.Types.ObjectId,
                ref: 'Message'
            },
            originalSender: {
                type: Schema.Types.ObjectId,
                ref: 'User'
            },
            forwardedAt: Date
        }
    },
    // Zamanlama
    scheduling: {
        sendAt: Date,
        repeat: {
            type: String,
            enum: ['none', 'daily', 'weekly', 'monthly', 'custom']
        },
        endAt: Date,
        timezone: String
    },
    // Etkileşimler
    interactions: {
        reactions: [{
            user: {
                type: Schema.Types.ObjectId,
                ref: 'User'
            },
            type: {
                type: String,
                enum: ['like', 'love', 'haha', 'wow', 'sad', 'angry', 'custom']
            },
            createdAt: {
                type: Date,
                default: Date.now
            }
        }],
        replies: {
            count: {
                type: Number,
                default: 0
            },
            lastReplyAt: Date
        }
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
    // Geçmiş
    history: [{
        action: {
            type: String,
            enum: ['create', 'edit', 'delete', 'restore', 'forward', 'pin', 'unpin']
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
messageSchema.index({ sender: 1 });
messageSchema.index({ 'recipients.user': 1 });
messageSchema.index({ conversation: 1 });
messageSchema.index({ 'thread.parent': 1 });
messageSchema.index({ status: 1 });
messageSchema.index({ 'metadata.tags': 1 });
messageSchema.index({ createdAt: -1 });
messageSchema.index({ 'scheduling.sendAt': 1 });

// Statik Metodlar
messageSchema.statics.search = async function(query = {}, options = {}) {
    const {
        type,
        sender,
        recipient,
        conversation,
        status,
        tags,
        startDate,
        endDate,
        limit = 50,
        skip = 0,
        sort = { createdAt: -1 }
    } = options;

    const filter = { ...query };
    if (type) filter.type = type;
    if (sender) filter.sender = sender;
    if (recipient) filter['recipients.user'] = recipient;
    if (conversation) filter.conversation = conversation;
    if (status) filter.status = status;
    if (tags) filter['metadata.tags'] = { $in: tags };
    if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = startDate;
        if (endDate) filter.createdAt.$lte = endDate;
    }

    return this.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('sender', 'username avatar')
        .populate('recipients.user', 'username avatar')
        .populate('thread.parent')
        .populate('features.forwardInfo.originalSender', 'username avatar');
};

messageSchema.statics.createMessage = async function(data) {
    const message = new this(data);
    await message.save();

    // Konuşma son mesajını güncelle
    if (message.conversation) {
        await mongoose.model('Conversation').findByIdAndUpdate(
            message.conversation,
            {
                lastMessage: message._id,
                lastActivity: new Date()
            }
        );
    }

    return message;
};

messageSchema.statics.updateStatus = async function(id, userId, status) {
    const message = await this.findById(id);
    if (!message) throw new Error('Mesaj bulunamadı');

    const recipient = message.recipients.find(r => r.user.toString() === userId.toString());
    if (recipient) {
        recipient.status = status;
        if (status === 'read') recipient.readAt = new Date();
        if (status === 'deleted') recipient.deletedAt = new Date();
    }

    await message.save();
    return message;
};

// Instance Metodlar
messageSchema.methods.toPublicJSON = function(userId) {
    const recipient = this.recipients.find(r => r.user.toString() === userId.toString());
    
    return {
        id: this._id,
        type: this.type,
        status: recipient ? recipient.status : this.status,
        priority: this.priority,
        content: {
            text: this.content.text,
            format: this.content.format,
            attachments: this.content.attachments,
            metadata: {
                mentions: this.content.metadata.mentions,
                tags: this.content.metadata.tags,
                links: this.content.metadata.links
            }
        },
        sender: this.sender,
        conversation: this.conversation,
        thread: {
            isReply: this.thread.isReply,
            parent: this.thread.parent
        },
        features: {
            isEdited: this.features.isEdited,
            isPinned: this.features.isPinned,
            isEncrypted: this.features.isEncrypted,
            isForwarded: this.features.isForwarded
        },
        interactions: {
            reactions: this.interactions.reactions,
            replies: {
                count: this.interactions.replies.count,
                lastReplyAt: this.interactions.replies.lastReplyAt
            }
        },
        metadata: {
            tags: this.metadata.tags,
            location: this.metadata.location
        },
        createdAt: this.createdAt,
        updatedAt: this.updatedAt
    };
};

messageSchema.methods.addReaction = async function(userId, type) {
    const existingReaction = this.interactions.reactions.find(
        reaction => reaction.user.toString() === userId.toString()
    );

    if (existingReaction) {
        if (existingReaction.type === type) {
            // Tepkiyi kaldır
            this.interactions.reactions = this.interactions.reactions.filter(
                reaction => reaction.user.toString() !== userId.toString()
            );
        } else {
            // Tepki tipini güncelle
            existingReaction.type = type;
        }
    } else {
        // Yeni tepki ekle
        this.interactions.reactions.push({
            user: userId,
            type,
            createdAt: new Date()
        });
    }

    await this.save();
    return this;
};

messageSchema.methods.edit = async function(userId, newContent, reason = '') {
    if (this.status === 'deleted') {
        throw new Error('Silinmiş mesajlar düzenlenemez');
    }

    this.history.push({
        action: 'edit',
        content: this.content.text,
        user: userId,
        reason,
        timestamp: new Date()
    });

    this.content.text = newContent;
    this.features.isEdited = true;
    await this.save();
    return this;
};

const Message = mongoose.model('Message', messageSchema);

module.exports = Message; 