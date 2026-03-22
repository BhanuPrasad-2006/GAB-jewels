// test-sms.js — run from server/ folder: node test-sms.js
require('dotenv').config();

const https = require('https');

const KEY    = process.env.FAST2SMS_KEY;
const NUMBER = '7780184812'; // your number — change if needed

if (!KEY) {
    console.error('❌ FAST2SMS_KEY not found in .env');
    process.exit(1);
}

console.log('✦ Key loaded:', KEY.slice(0, 6) + '...');
console.log('✦ Sending test OTP to:', NUMBER);

const postData = JSON.stringify({
    route:   'q',
    message: 'GAB Jewels test OTP: 123456. Valid 5 mins.',
    numbers: NUMBER,
    flash:   0,
});

const req = https.request({
    hostname: 'www.fast2sms.com',
    path:     '/dev/bulkV2',
    method:   'POST',
    headers: {
        'authorization': KEY,
        'Content-Type':  'application/json',
        'Content-Length': Buffer.byteLength(postData),
    },
}, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
        console.log('\n📨 Fast2SMS response:');
        try {
            const parsed = JSON.parse(data);
            console.log(JSON.stringify(parsed, null, 2));
            if (parsed.return === true) {
                console.log('\n✅ SMS sent successfully!');
            } else {
                console.log('\n❌ SMS failed:', parsed.message);
            }
        } catch {
            console.log('Raw:', data);
        }
    });
});

req.on('error', e => console.error('❌ Request error:', e.message));
req.write(postData);
req.end();