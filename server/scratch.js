const { getHisConnection } = require('./config/database');

async function test() {
    let conn;
    try {
        conn = await getHisConnection();
        const rows = await conn.query('DESCRIBE rcpt_print');
        console.log('rcpt_print:', rows);
        
        const rows2 = await conn.query('DESCRIBE rcpt_print_detail');
        console.log('rcpt_print_detail:', rows2);
    } catch (e) {
        console.error(e);
    } finally {
        if(conn) conn.release();
        process.exit(0);
    }
}
test();
