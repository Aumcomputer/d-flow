const { getDflowConnection } = require('./config/database');

async function alterTable() {
    let conn;
    try {
        conn = await getDflowConnection();
        await conn.query(`
            ALTER TABLE an_detail 
            ADD COLUMN IF NOT EXISTS discount_money DECIMAL(10,2) DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS discount_detail VARCHAR(255) DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS discount_by VARCHAR(100) DEFAULT NULL
        `);
        console.log('Columns added successfully');
    } catch (e) {
        console.error(e);
    } finally {
        if(conn) conn.release();
        process.exit(0);
    }
}
alterTable();
