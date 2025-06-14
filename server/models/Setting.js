const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const settingSchema = new Schema({
    // Temel Alanlar
    key: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        index: true
    },
    value: {
        type: Schema.Types.Mixed,
        required: true
    },
    type: {
        type: String,
        required: true,
        enum: ['string', 'number', 'boolean', 'array', 'object', 'json', 'date', 'custom'],
        default: 'string'
    },
    category: {
        type: String,
        trim: true,
        index: true
    },
    group: {
        type: String,
        trim: true
    },
    name: {
        type: String,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    validation: {
        required: { type: Boolean, default: false },
        min: Number,
        max: Number,
        regex: String,
        enum: [String],
        custom: Schema.Types.Mixed
    },
    permissions: {
        read: [{ type: String }],
        write: [{ type: String }],
        admin: [{ type: String }]
    },
    metadata: {
        tags: [String],
        version: String,
        source: String,
        custom: Schema.Types.Mixed
    },
    history: [{
        value: Schema.Types.Mixed,
        updatedAt: Date,
        updatedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User'
        }
    }],
    cache: {
        enabled: { type: Boolean, default: false },
        ttl: Number,
        lastUpdate: Date
    }
}, {
    timestamps: true
});

// İndeksler
settingSchema.index({ key: 1 });
settingSchema.index({ category: 1 });
settingSchema.index({ group: 1 });
settingSchema.index({ 'metadata.tags': 1 });
settingSchema.index({ createdAt: -1 });

// Statik Metodlar
settingSchema.statics.search = async function(query = {}, options = {}) {
    const {
        key,
        category,
        group,
        tags,
        limit = 50,
        skip = 0,
        sort = { createdAt: -1 }
    } = options;

    const filter = { ...query };
    if (key) filter.key = key;
    if (category) filter.category = category;
    if (group) filter.group = group;
    if (tags) filter['metadata.tags'] = { $in: tags };

    return this.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit);
};

settingSchema.statics.updateValue = async function(key, value, userId = null) {
    const setting = await this.findOne({ key });
    if (!setting) throw new Error('Ayar bulunamadı');
    setting.history.push({ value: setting.value, updatedAt: new Date(), updatedBy: userId });
    setting.value = value;
    setting.cache.lastUpdate = new Date();
    await setting.save();
    return setting;
};

settingSchema.statics.toPublicJSON = function(setting) {
    return {
        key: setting.key,
        value: setting.value,
        type: setting.type,
        category: setting.category,
        group: setting.group,
        name: setting.name,
        description: setting.description,
        metadata: setting.metadata,
        createdAt: setting.createdAt,
        updatedAt: setting.updatedAt
    };
};

settingSchema.statics.createSetting = async function(data) {
    const setting = new this(data);
    await setting.save();
    return setting;
};

settingSchema.statics.bulkUpdate = async function(updates = [], userId = null) {
    const results = [];
    for (const { key, value } of updates) {
        const updated = await this.updateValue(key, value, userId);
        results.push(updated);
    }
    return results;
};

const Setting = mongoose.model('Setting', settingSchema);

module.exports = Setting; 