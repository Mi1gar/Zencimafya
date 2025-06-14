const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const templateSchema = new Schema({
    // Temel Alanlar
    code: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        index: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        required: true,
        enum: [
            'email', 'notification', 'report', 'message', 'page',
            'document', 'form', 'widget', 'custom'
        ]
    },
    category: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    status: {
        type: String,
        enum: ['draft', 'active', 'inactive', 'archived'],
        default: 'draft'
    },
    version: {
        type: String,
        required: true,
        default: '1.0.0'
    },
    // İçerik
    content: {
        subject: String,
        title: String,
        body: {
            type: String,
            required: true
        },
        html: String,
        text: String,
        css: String,
        js: String,
        attachments: [{
            name: String,
            type: String,
            url: String,
            size: Number
        }]
    },
    // Değişkenler ve Yerleştiriciler
    variables: [{
        name: {
            type: String,
            required: true
        },
        type: {
            type: String,
            enum: ['string', 'number', 'boolean', 'date', 'array', 'object', 'custom'],
            default: 'string'
        },
        required: {
            type: Boolean,
            default: false
        },
        default: Schema.Types.Mixed,
        description: String,
        validation: Schema.Types.Mixed
    }],
    // Yerleştiriciler
    placeholders: [{
        key: {
            type: String,
            required: true
        },
        type: {
            type: String,
            enum: ['text', 'image', 'link', 'button', 'table', 'custom'],
            default: 'text'
        },
        content: Schema.Types.Mixed,
        style: Schema.Types.Mixed,
        metadata: Schema.Types.Mixed
    }],
    // Tasarım ve Stil
    design: {
        theme: String,
        layout: String,
        styles: Schema.Types.Mixed,
        responsive: {
            type: Boolean,
            default: true
        },
        customCss: String,
        customJs: String
    },
    // Hedefleme ve Koşullar
    targeting: {
        languages: [String],
        devices: [String],
        browsers: [String],
        countries: [String],
        userRoles: [String],
        conditions: Schema.Types.Mixed
    },
    // Özelleştirme ve Ayarlar
    settings: {
        cache: {
            enabled: {
                type: Boolean,
                default: true
            },
            ttl: Number
        },
        compression: {
            enabled: {
                type: Boolean,
                default: true
            },
            level: {
                type: Number,
                min: 0,
                max: 9,
                default: 6
            }
        },
        security: {
            sanitize: {
                type: Boolean,
                default: true
            },
            allowedTags: [String],
            allowedAttributes: Schema.Types.Mixed
        }
    },
    // Metadata
    metadata: {
        description: String,
        tags: [String],
        author: {
            type: Schema.Types.ObjectId,
            ref: 'User'
        },
        lastModifiedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User'
        },
        custom: Schema.Types.Mixed
    },
    // Geçmiş
    history: [{
        version: String,
        content: Schema.Types.Mixed,
        changes: String,
        modifiedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User'
        },
        modifiedAt: {
            type: Date,
            default: Date.now
        }
    }]
}, {
    timestamps: true
});

// İndeksler
templateSchema.index({ code: 1 });
templateSchema.index({ type: 1, category: 1 });
templateSchema.index({ status: 1 });
templateSchema.index({ 'metadata.tags': 1 });
templateSchema.index({ createdAt: -1 });

// Statik Metodlar
templateSchema.statics.search = async function(query = {}, options = {}) {
    const {
        code,
        type,
        category,
        status,
        tags,
        limit = 50,
        skip = 0,
        sort = { createdAt: -1 }
    } = options;

    const filter = { ...query };
    if (code) filter.code = code;
    if (type) filter.type = type;
    if (category) filter.category = category;
    if (status) filter.status = status;
    if (tags) filter['metadata.tags'] = { $in: tags };

    return this.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('metadata.author', 'username email')
        .populate('metadata.lastModifiedBy', 'username email');
};

templateSchema.statics.createTemplate = async function(data) {
    const template = new this(data);
    await template.save();
    return template;
};

templateSchema.statics.updateVersion = async function(code, content, userId, changes = '') {
    const template = await this.findOne({ code });
    if (!template) throw new Error('Şablon bulunamadı');

    const newVersion = incrementVersion(template.version);
    template.history.push({
        version: template.version,
        content: template.content,
        changes,
        modifiedBy: userId,
        modifiedAt: new Date()
    });

    template.version = newVersion;
    template.content = content;
    template.metadata.lastModifiedBy = userId;
    await template.save();
    return template;
};

templateSchema.statics.render = async function(code, data = {}) {
    const template = await this.findOne({ code, status: 'active' });
    if (!template) throw new Error('Şablon bulunamadı');

    // Değişkenleri doğrula
    validateVariables(template.variables, data);

    // Şablonu render et
    let rendered = template.content.body;
    for (const [key, value] of Object.entries(data)) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        rendered = rendered.replace(regex, value);
    }

    return {
        subject: template.content.subject,
        title: template.content.title,
        body: rendered,
        html: template.content.html,
        text: template.content.text
    };
};

// Yardımcı Fonksiyonlar
function incrementVersion(version) {
    const [major, minor, patch] = version.split('.').map(Number);
    return `${major}.${minor}.${patch + 1}`;
}

function validateVariables(variables, data) {
    for (const variable of variables) {
        if (variable.required && !(variable.name in data)) {
            throw new Error(`Zorunlu değişken eksik: ${variable.name}`);
        }
    }
}

const Template = mongoose.model('Template', templateSchema);

module.exports = Template; 