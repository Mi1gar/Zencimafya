const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const reportSchema = new Schema({
    // Temel Alanlar
    name: {
        type: String,
        required: true,
        trim: true
    },
    code: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        index: true
    },
    type: {
        type: String,
        required: true,
        enum: [
            // Sistem Raporları
            'system_performance', 'error_analysis', 'security_audit',
            // Kullanıcı Raporları
            'user_activity', 'user_growth', 'user_retention',
            // İçerik Raporları
            'content_analytics', 'engagement_metrics', 'popularity_trends',
            // Finansal Raporlar
            'revenue_analysis', 'subscription_metrics', 'payment_analytics',
            // İş Raporları
            'business_intelligence', 'market_analysis', 'competitor_analysis',
            // Özel Raporlar
            'custom'
        ]
    },
    status: {
        type: String,
        required: true,
        enum: [
            'draft', 'scheduled', 'processing',
            'completed', 'failed', 'archived'
        ],
        default: 'draft'
    },
    owner: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    // Rapor Yapılandırması
    configuration: {
        dataSource: {
            type: {
                type: String,
                required: true,
                enum: ['database', 'api', 'file', 'custom']
            },
            connection: {
                type: String,
                required: true
            },
            query: String,
            parameters: Schema.Types.Mixed,
            filters: [{
                field: String,
                operator: {
                    type: String,
                    enum: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'nin', 'regex']
                },
                value: Schema.Types.Mixed
            }],
            transformations: [{
                type: {
                    type: String,
                    enum: ['aggregate', 'group', 'sort', 'limit', 'custom']
                },
                config: Schema.Types.Mixed
            }]
        },
        schedule: {
            frequency: {
                type: String,
                enum: ['once', 'hourly', 'daily', 'weekly', 'monthly', 'custom']
            },
            interval: Number,
            startDate: Date,
            endDate: Date,
            lastRun: Date,
            nextRun: Date,
            timezone: String,
            daysOfWeek: [Number],
            daysOfMonth: [Number],
            hours: [Number],
            minutes: [Number]
        },
        format: {
            type: {
                type: String,
                required: true,
                enum: ['pdf', 'excel', 'csv', 'json', 'html', 'custom']
            },
            template: String,
            options: Schema.Types.Mixed,
            styling: {
                theme: String,
                colors: Schema.Types.Mixed,
                fonts: Schema.Types.Mixed,
                layout: Schema.Types.Mixed
            }
        },
        delivery: {
            methods: [{
                type: {
                    type: String,
                    enum: ['email', 'webhook', 'storage', 'api', 'custom']
                },
                config: Schema.Types.Mixed,
                recipients: [{
                    type: Schema.Types.ObjectId,
                    ref: 'User'
                }]
            }],
            retention: {
                period: Number,
                maxCopies: Number,
                archiveStrategy: String
            }
        }
    },
    // Rapor İçeriği
    content: {
        sections: [{
            title: String,
            type: {
                type: String,
                enum: ['text', 'table', 'chart', 'metric', 'custom']
            },
            data: Schema.Types.Mixed,
            layout: Schema.Types.Mixed,
            style: Schema.Types.Mixed
        }],
        summary: {
            text: String,
            highlights: [String],
            recommendations: [String]
        },
        metadata: {
            generatedAt: Date,
            dataRange: {
                start: Date,
                end: Date
            },
            version: String,
            parameters: Schema.Types.Mixed
        }
    },
    // Sonuçlar ve Dosyalar
    results: [{
        version: String,
        status: {
            type: String,
            enum: ['success', 'partial', 'failed']
        },
        generatedAt: Date,
        file: {
            url: String,
            size: Number,
            mimeType: String,
            checksum: String
        },
        metrics: {
            recordCount: Number,
            processingTime: Number,
            fileSize: Number
        },
        error: {
            code: String,
            message: String,
            details: Schema.Types.Mixed
        }
    }],
    // İzleme ve Metrikler
    monitoring: {
        execution: {
            totalRuns: {
                type: Number,
                default: 0
            },
            successCount: {
                type: Number,
                default: 0
            },
            failureCount: {
                type: Number,
                default: 0
            },
            averageDuration: Number,
            lastDuration: Number,
            peakMemory: Number,
            averageMemory: Number
        },
        performance: {
            queryTime: Number,
            processingTime: Number,
            deliveryTime: Number,
            totalTime: Number
        },
        quality: {
            accuracy: Number,
            completeness: Number,
            timeliness: Number,
            consistency: Number
        }
    },
    // Erişim Kontrolü
    access: {
        visibility: {
            type: String,
            enum: ['private', 'team', 'organization', 'public'],
            default: 'private'
        },
        permissions: [{
            role: {
                type: String,
                enum: ['viewer', 'editor', 'admin']
            },
            users: [{
                type: Schema.Types.ObjectId,
                ref: 'User'
            }],
            teams: [{
                type: Schema.Types.ObjectId,
                ref: 'Team'
            }]
        }],
        restrictions: {
            ipWhitelist: [String],
            timeRestrictions: {
                startTime: String,
                endTime: String,
                daysOfWeek: [Number]
            },
            maxAccessCount: Number,
            requireAuth: {
                type: Boolean,
                default: true
            }
        }
    },
    // Metadata
    metadata: {
        description: String,
        tags: [String],
        category: String,
        department: String,
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
reportSchema.index({ type: 1, status: 1 });
reportSchema.index({ 'configuration.schedule.nextRun': 1 });
reportSchema.index({ 'content.metadata.generatedAt': -1 });
reportSchema.index({ 'metadata.tags': 1 });
reportSchema.index({ 'metadata.category': 1 });
reportSchema.index({ createdAt: -1 });

// Statik Metodlar
reportSchema.statics.search = async function(query = {}, options = {}) {
    const {
        owner,
        type,
        status,
        category,
        tags,
        startDate,
        endDate,
        limit = 50,
        skip = 0,
        sort = { createdAt: -1 }
    } = options;

    const filter = { ...query };

    if (owner) filter.owner = owner;
    if (type) filter.type = type;
    if (status) filter.status = status;
    if (category) filter['metadata.category'] = category;
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
        .populate('owner', 'username email');
};

reportSchema.statics.createReport = async function(data) {
    const report = new this(data);
    await report.save();
    return report;
};

reportSchema.statics.getScheduledReports = async function() {
    const now = new Date();
    return this.find({
        status: 'scheduled',
        'configuration.schedule.nextRun': { $lte: now }
    });
};

reportSchema.statics.getUserReports = async function(userId, options = {}) {
    return this.find({
        $or: [
            { owner: userId },
            { 'access.permissions.users': userId }
        ],
        ...options
    }).sort({ createdAt: -1 });
};

// Instance Metodlar
reportSchema.methods.toPublicJSON = function() {
    return {
        id: this._id,
        name: this.name,
        code: this.code,
        type: this.type,
        status: this.status,
        configuration: {
            dataSource: {
                type: this.configuration.dataSource.type,
                filters: this.configuration.dataSource.filters
            },
            schedule: {
                frequency: this.configuration.schedule.frequency,
                nextRun: this.configuration.schedule.nextRun
            },
            format: {
                type: this.configuration.format.type
            }
        },
        content: {
            summary: this.content.summary,
            metadata: this.content.metadata
        },
        monitoring: {
            execution: {
                totalRuns: this.monitoring.execution.totalRuns,
                successCount: this.monitoring.execution.successCount,
                failureCount: this.monitoring.execution.failureCount
            },
            performance: {
                averageDuration: this.monitoring.execution.averageDuration
            }
        },
        access: {
            visibility: this.access.visibility
        },
        metadata: {
            description: this.metadata.description,
            tags: this.metadata.tags,
            category: this.metadata.category
        },
        createdAt: this.createdAt,
        updatedAt: this.updatedAt
    };
};

reportSchema.methods.schedule = async function() {
    if (this.status !== 'draft') {
        throw new Error('Only draft reports can be scheduled');
    }

    this.status = 'scheduled';
    this.configuration.schedule.lastRun = null;
    this.configuration.schedule.nextRun = this.calculateNextRun();
    
    await this.save();
    return this;
};

reportSchema.methods.calculateNextRun = function() {
    const now = new Date();
    const schedule = this.configuration.schedule;

    switch (schedule.frequency) {
        case 'once':
            return schedule.startDate;
        case 'hourly':
            return new Date(now.getTime() + (schedule.interval * 60 * 60 * 1000));
        case 'daily':
            return this.calculateNextDailyRun(now, schedule);
        case 'weekly':
            return this.calculateNextWeeklyRun(now, schedule);
        case 'monthly':
            return this.calculateNextMonthlyRun(now, schedule);
        default:
            return null;
    }
};

reportSchema.methods.calculateNextDailyRun = function(now, schedule) {
    const next = new Date(now);
    next.setHours(schedule.hours[0] || 0);
    next.setMinutes(schedule.minutes[0] || 0);
    next.setSeconds(0);
    next.setMilliseconds(0);

    if (next <= now) {
        next.setDate(next.getDate() + 1);
    }

    return next;
};

reportSchema.methods.calculateNextWeeklyRun = function(now, schedule) {
    const next = this.calculateNextDailyRun(now, schedule);
    const currentDay = next.getDay();

    const nextDay = schedule.daysOfWeek.find(day => day > currentDay) ||
                   schedule.daysOfWeek[0];

    const daysToAdd = (nextDay - currentDay + 7) % 7;
    next.setDate(next.getDate() + daysToAdd);

    return next;
};

reportSchema.methods.calculateNextMonthlyRun = function(now, schedule) {
    const next = this.calculateNextDailyRun(now, schedule);
    const currentDay = next.getDate();

    const nextDay = schedule.daysOfMonth.find(day => day > currentDay) ||
                   schedule.daysOfMonth[0];

    if (nextDay) {
        next.setDate(nextDay);
    } else {
        next.setMonth(next.getMonth() + 1);
        next.setDate(schedule.daysOfMonth[0]);
    }

    return next;
};

reportSchema.methods.execute = async function() {
    if (this.status !== 'scheduled') {
        throw new Error('Only scheduled reports can be executed');
    }

    this.status = 'processing';
    await this.save();

    try {
        // Veri toplama
        const data = await this.collectData();
        
        // Veri işleme
        const processedData = await this.processData(data);
        
        // Rapor oluşturma
        const reportFile = await this.generateReport(processedData);
        
        // Sonuç kaydetme
        this.results.push({
            version: this.metadata.version,
            status: 'success',
            generatedAt: new Date(),
            file: reportFile,
            metrics: {
                recordCount: processedData.length,
                processingTime: Date.now() - this.monitoring.execution.lastDuration,
                fileSize: reportFile.size
            }
        });

        // Metrikleri güncelle
        this.updateMetrics('success');
        
        // Raporu dağıt
        await this.deliverReport(reportFile);
        
        // Sonraki çalışma zamanını güncelle
        this.configuration.schedule.lastRun = new Date();
        this.configuration.schedule.nextRun = this.calculateNextRun();
        
        this.status = 'completed';
    } catch (error) {
        this.results.push({
            version: this.metadata.version,
            status: 'failed',
            generatedAt: new Date(),
            error: {
                code: error.code || 'UNKNOWN_ERROR',
                message: error.message,
                details: error.details
            }
        });

        this.updateMetrics('failure');
        this.status = 'failed';
    }

    await this.save();
    return this;
};

reportSchema.methods.collectData = async function() {
    const { dataSource } = this.configuration;
    
    // Veri kaynağına göre veri toplama işlemi
    // Bu kısım, kullanılan veri kaynağına göre özelleştirilmeli
    return [];
};

reportSchema.methods.processData = async function(data) {
    const { transformations } = this.configuration.dataSource;
    
    // Veri dönüşüm işlemleri
    // Bu kısım, rapor türüne göre özelleştirilmeli
    return data;
};

reportSchema.methods.generateReport = async function(data) {
    const { format } = this.configuration;
    
    // Rapor formatına göre dosya oluşturma
    // Bu kısım, kullanılan rapor formatına göre özelleştirilmeli
    return {
        url: '',
        size: 0,
        mimeType: format.type,
        checksum: ''
    };
};

reportSchema.methods.deliverReport = async function(reportFile) {
    const { methods } = this.configuration.delivery;
    
    // Her dağıtım yöntemi için rapor gönderme
    for (const method of methods) {
        try {
            // Dağıtım yöntemine göre gönderme işlemi
            // Bu kısım, kullanılan dağıtım yöntemine göre özelleştirilmeli
        } catch (error) {
            console.error(`Delivery failed for method ${method.type}:`, error);
        }
    }
};

reportSchema.methods.updateMetrics = function(result) {
    const execution = this.monitoring.execution;
    
    execution.totalRuns += 1;
    if (result === 'success') {
        execution.successCount += 1;
    } else {
        execution.failureCount += 1;
    }

    // Ortalama süre hesaplama
    const currentDuration = Date.now() - execution.lastDuration;
    execution.averageDuration = execution.averageDuration ?
        (execution.averageDuration + currentDuration) / 2 :
        currentDuration;
    
    execution.lastDuration = currentDuration;
};

reportSchema.methods.archive = async function() {
    if (this.status !== 'completed' && this.status !== 'failed') {
        throw new Error('Only completed or failed reports can be archived');
    }

    this.status = 'archived';
    await this.save();
    return this;
};

const Report = mongoose.model('Report', reportSchema);

module.exports = Report; 