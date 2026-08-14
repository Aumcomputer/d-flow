const { getDflowConnection } = require('./config/database');

async function test() {
    let conn;
    try {
        conn = await getDflowConnection();
        const rows = await conn.query('DESCRIBE activity_logs');
        console.log('activity_logs:', rows);
    } catch (e) {
        console.error(e);
    } finally {
        if(conn) conn.release();
        process.exit(0);
    }
}
test();
