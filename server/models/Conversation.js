const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }],
    type: {
        type: String,
        enum: ['private', 'group'],
        default: 'private'
    },
    name: {
        type: String,
        trim: true
    },
    avatar: {
        type: String
    },
    lastMessage: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message'
    },
    unreadCount: {
        type: Map,
        of: Number,
        default: new Map()
    },
    status: {
        type: String,
        enum: ['active', 'archived', 'deleted'],
        default: 'active'
    },
    settings: {
        notifications: {
            type: Boolean,
            default: true
        },
        mute: {
            type: Boolean,
            default: false
        },
        pin: {
            type: Boolean,
            default: false
        }
    },
    metadata: {
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        topic: {
            type: String,
            trim: true
        },
        description: {
            type: String,
            trim: true
        }
    },
    admins: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    blockedUsers: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        blockedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        blockedAt: Date,
        reason: String
    }]
}, {
    timestamps: true
});

// İndeksler
conversationSchema.index({ participants: 1 });
conversationSchema.index({ type: 1, status: 1 });
conversationSchema.index({ 'lastMessage': 1 });

// Konuşma arama metodu
conversationSchema.statics.search = async function(userId, query) {
    return this.find({
        participants: userId,
        status: 'active',
        $or: [
            { name: { $regex: query, $options: 'i' } },
            { 'metadata.topic': { $regex: query, $options: 'i' } }
        ]
    })
    .populate('participants', 'username avatar')
    .populate('lastMessage')
    .sort({ updatedAt: -1 });
};

// Konuşma detayları için public veri
conversationSchema.methods.toPublicJSON = function(userId) {
    return {
        id: this._id,
        type: this.type,
        name: this.name,
        avatar: this.avatar,
        participants: this.participants,
        lastMessage: this.lastMessage,
        unreadCount: this.unreadCount.get(userId.toString()) || 0,
        status: this.status,
        settings: this.settings,
        metadata: this.metadata,
        admins: this.admins,
        isAdmin: this.admins.includes(userId),
        createdAt: this.createdAt,
        updatedAt: this.updatedAt
    };
};

// Konuşma oluşturma metodu
conversationSchema.statics.createPrivate = async function(user1Id, user2Id) {
    // Önce mevcut bir konuşma var mı kontrol et
    const existingConversation = await this.findOne({
        type: 'private',
        participants: { $all: [user1Id, user2Id] },
        status: 'active'
    });

    if (existingConversation) {
        return existingConversation;
    }

    // Yeni konuşma oluştur
    return this.create({
        type: 'private',
        participants: [user1Id, user2Id],
        metadata: {
            createdBy: user1Id
        }
    });
};

// Konuşma güncelleme metodu
conversationSchema.methods.updateLastMessage = async function(messageId) {
    this.lastMessage = messageId;
    this.updatedAt = new Date();
    return this.save();
};

// Okunmamış mesaj sayısını güncelleme
conversationSchema.methods.updateUnreadCount = async function(userId, increment = true) {
    const currentCount = this.unreadCount.get(userId.toString()) || 0;
    this.unreadCount.set(
        userId.toString(),
        increment ? currentCount + 1 : 0
    );
    return this.save();
};

// Kullanıcı engelleme metodu
conversationSchema.methods.blockUser = async function(userId, blockedUserId, reason) {
    this.blockedUsers.push({
        user: blockedUserId,
        blockedBy: userId,
        blockedAt: new Date(),
        reason
    });
    return this.save();
};

// Kullanıcı engelini kaldırma metodu
conversationSchema.methods.unblockUser = async function(userId) {
    this.blockedUsers = this.blockedUsers.filter(
        block => block.user.toString() !== userId.toString()
    );
    return this.save();
};

const Conversation = mongoose.model('Conversation', conversationSchema);

module.exports = Conversation; 