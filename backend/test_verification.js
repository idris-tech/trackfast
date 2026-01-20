const http = require('http');

function request(url, options = {}, body = null) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const opts = {
            hostname: urlObj.hostname,
            port: urlObj.port,
            path: urlObj.pathname,
            method: options.method || 'GET',
            headers: options.headers || {}
        };

        const req = http.request(opts, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                resolve({
                    status: res.statusCode,
                    body: data
                });
            });
        });

        req.on('error', (e) => reject(e));
        
        if (body) {
            req.write(body);
        }
        req.end();
    });
}

async function test() {
    const BASE = 'http://127.0.0.1:5000';
    console.log(`Testing ${BASE}...`);

    // 1. Health
    try {
        console.log('1. Health Check...');
        const health = await request(`${BASE}/api/health`);
        console.log('   Status:', health.status);
        console.log('   Body:', health.body);
    } catch(e) {
        console.log('   FAILED:', e.message);
        return;
    }

    // 2. Login (Env Admin)
    console.log('\n2. Login (admin@trackfast.com)...');
    try {
        const payload = JSON.stringify({ email: 'admin@trackfast.com', password: 'password123' }); 
        
        // Try 'admin123'
        let res = await request(`${BASE}/api/admin/login`, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(JSON.stringify({ email: 'admin@trackfast.com', password: 'admin123' })) }
        }, JSON.stringify({ email: 'admin@trackfast.com', password: 'admin123' }));
        
        console.log('   Attempt (admin123):', res.status);
        if (res.status !== 200) {
             console.log('   Body:', res.body);
        } else {
             console.log('   SUCCESS!');
        }

    } catch(e) {
        console.log('   Error:', e.message);
    }
    
    // 3. Login (Test Admin)
    console.log('\n3. Login (testadmin@trackfast.com)...');
    try {
        const bodyStr = JSON.stringify({ email: 'testadmin@trackfast.com', password: 'admin123' });
        let res = await request(`${BASE}/api/admin/login`, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }
        }, bodyStr);
        
        console.log('   Attempt (admin123):', res.status);
         if (res.status === 200) {
             console.log('   SUCCESS!');
             const data = JSON.parse(res.body);
             await testParcels(data.token);
        } else {
             console.log('   Body:', res.body);
        }

    } catch(e) {
        console.log('   Error:', e.message);
    }
}

async function testParcels(token) {
    console.log('\n4. Fetch Parcels...');
    const BASE = 'http://127.0.0.1:5000';
    try {
        const res = await request(`${BASE}/api/parcels`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log('   Status:', res.status);
        console.log('   Body Length:', res.body.length);
        console.log('   First 100 chars:', res.body.substring(0, 100));
    } catch(e) {
        console.log('   Error:', e.message);
    }
}

test();
