const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');

// Veritabanı bağlantısı
const db = new sqlite3.Database(path.join(__dirname, 'mafia.db'), (err) => {
    if (err) {
        console.error('[ VERİTABANI BAĞLANTI HATASI ]', err);
    } else {
        console.log('[ VERİTABANI BAĞLANTISI BAŞARILI ]');
        createTables();
    }
});

// Tabloları oluştur
function createTables() {
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            code_name TEXT UNIQUE NOT NULL,
            access_level INTEGER DEFAULT 1,
            last_login DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'active'
        )
    `);

    // Varsayılan admin kullanıcısı oluştur
    const defaultAdmin = {
        username: 'admin',
        code_name: 'BOSS',
        password: 'mafia123' // Bu şifre hash'lenecek
    };

    // Admin kullanıcısını kontrol et ve yoksa ekle
    db.get('SELECT * FROM users WHERE username = ?', [defaultAdmin.username], async (err, row) => {
        if (err) {
            console.error('[ ADMIN KONTROL HATASI ]', err);
            return;
        }

        if (!row) {
            const hashedPassword = await bcrypt.hash(defaultAdmin.password, 10);
            db.run(
                'INSERT INTO users (username, password, code_name, access_level) VALUES (?, ?, ?, ?)',
                [defaultAdmin.username, hashedPassword, defaultAdmin.code_name, 5],
                (err) => {
                    if (err) {
                        console.error('[ ADMIN OLUŞTURMA HATASI ]', err);
                    } else {
                        console.log('[ VARSAYILAN ADMIN OLUŞTURULDU ]');
                    }
                }
            );
        }
    });
}

// Kullanıcı işlemleri
const userOperations = {
    // Kullanıcı girişi
    login: async (username, password) => {
        return new Promise((resolve, reject) => {
            db.get('SELECT * FROM users WHERE username = ? AND status = ?', 
                [username, 'active'], 
                async (err, user) => {
                    if (err) {
                        reject({ error: '[ VERİTABANI HATASI ]' });
                        return;
                    }

                    if (!user) {
                        reject({ error: '[ KULLANICI BULUNAMADI ]' });
                        return;
                    }

                    const validPassword = await bcrypt.compare(password, user.password);
                    if (!validPassword) {
                        reject({ error: '[ HATALI ŞİFRE ]' });
                        return;
                    }

                    // Son giriş zamanını güncelle
                    db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', 
                        [user.id]);

                    resolve({
                        id: user.id,
                        username: user.username,
                        code_name: user.code_name,
                        access_level: user.access_level
                    });
                }
            );
        });
    },

    // Yeni kullanıcı kaydı
    register: async (username, password, code_name) => {
        return new Promise(async (resolve, reject) => {
            try {
                // Kullanıcı adı ve kod adı kontrolü
                const existingUser = await new Promise((resolve, reject) => {
                    db.get('SELECT * FROM users WHERE username = ? OR code_name = ?',
                        [username, code_name],
                        (err, row) => {
                            if (err) reject(err);
                            else resolve(row);
                        }
                    );
                });

                if (existingUser) {
                    reject({ error: '[ KULLANICI ADI VEYA KOD ADI ZATEN KULLANIMDA ]' });
                    return;
                }

                // Şifreyi hashle
                const hashedPassword = await bcrypt.hash(password, 10);

                // Kullanıcıyı kaydet
                db.run(
                    'INSERT INTO users (username, password, code_name) VALUES (?, ?, ?)',
                    [username, hashedPassword, code_name],
                    function(err) {
                        if (err) {
                            reject({ error: '[ KAYIT HATASI ]' });
                            return;
                        }
                        resolve({
                            id: this.lastID,
                            username,
                            code_name,
                            access_level: 1
                        });
                    }
                );
            } catch (error) {
                reject({ error: '[ SİSTEM HATASI ]' });
            }
        });
    },

    // Kullanıcı bilgilerini güncelle
    updateUser: async (userId, updates) => {
        return new Promise((resolve, reject) => {
            const allowedUpdates = ['code_name', 'access_level', 'status'];
            const updateFields = Object.keys(updates)
                .filter(key => allowedUpdates.includes(key))
                .map(key => `${key} = ?`);
            
            if (updateFields.length === 0) {
                reject({ error: '[ GEÇERSİZ GÜNCELLEME ]' });
                return;
            }

            const values = [...Object.values(updates), userId];
            
            db.run(
                `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
                values,
                (err) => {
                    if (err) {
                        reject({ error: '[ GÜNCELLEME HATASI ]' });
                        return;
                    }
                    resolve({ success: true });
                }
            );
        });
    }
};

module.exports = {
    db,
    userOperations
}; 