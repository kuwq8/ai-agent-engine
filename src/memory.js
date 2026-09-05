const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// ينشئ الجداول أول مرة يشتغل فيها البوت (آمن يتكرر، ما يمسح بيانات موجودة)
async function initDatabase() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS conversations (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(50) NOT NULL,
            model VARCHAR(20) NOT NULL,
            prompt TEXT NOT NULL,
            response TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT NOW()
        );
    `);
    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_conversations_user
        ON conversations (user_id, created_at DESC);
    `);
    console.log('✅ Database tables ready.');
}

// يحفظ كل تفاعل (أي نموذج كان)
async function saveInteraction(userId, model, prompt, response) {
    try {
        await pool.query(
            'INSERT INTO conversations (user_id, model, prompt, response) VALUES ($1, $2, $3, $4)',
            [userId, model, prompt, response]
        );
    } catch (err) {
        console.error('Failed to save interaction:', err.message);
    }
}

// يجيب آخر رسائل المستخدم (سياق موحد لكل النماذج)
async function getRecentContext(userId, limit = 10) {
    try {
        const result = await pool.query(
            'SELECT model, prompt, response FROM conversations WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
            [userId, limit]
        );
        return result.rows.reverse();
    } catch (err) {
        console.error('Failed to fetch context:', err.message);
        return [];
    }
}

module.exports = { initDatabase, saveInteraction, getRecentContext };
