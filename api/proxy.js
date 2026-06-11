const https = require('https');
const http = require('http');
const { URL } = require('url');

const HOP_BY_HOP_HEADERS = [
    'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
    'te', 'trailers', 'transfer-encoding', 'upgrade', 'content-length'
];

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') return res.status(200).end();

    // پشتیبانی همزمان از درخواست‌های معمولی وب پنل و درخواست‌های تونل سایفون
    let targetUrl = req.query.url;
    
    // اگر سایفون درخواست را مستقیم به روت فرستاده بود، آدرس را از ساختار ریکوئست استخراج میکند
    if (!targetUrl && req.url.startsWith('http')) {
        targetUrl = req.url;
    }

    if (!targetUrl) {
        return res.status(400).send('Vidal Proxy Node Active. Upstream is ready.');
    }

    try {
        const parsedUrl = new URL(targetUrl);
        const transport = parsedUrl.protocol === 'https:' ? https : http;

        const headers = {
            'user-agent': req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'host': parsedUrl.host
        };

        if (req.headers) {
            Object.keys(req.headers).forEach(key => {
                const lowerKey = key.toLowerCase();
                if (!HOP_BY_HOP_HEADERS.includes(lowerKey) && lowerKey !== 'host' && lowerKey !== 'user-agent') {
                    headers[key] = req.headers[key];
                }
            });
        }

        const options = {
            method: req.method,
            headers: headers
        };

        const proxyReq = transport.request(targetUrl, options, (proxyRes) => {
            Object.keys(proxyRes.headers).forEach(key => {
                const lowerKey = key.toLowerCase();
                if (!HOP_BY_HOP_HEADERS.includes(lowerKey) && lowerKey !== 'content-security-policy' && lowerKey !== 'x-frame-options') {
                    res.setHeader(key, proxyRes.headers[key]);
                }
            });

            res.writeHead(proxyRes.statusCode);
            proxyRes.pipe(res);
        });

        proxyReq.on('error', (err) => res.status(500).send(`Upstream Error: ${err.message}`));
        
        // پایپ کردن بادی پکت‌های سایفون به سرور مقصد
        req.pipe(proxyReq);

    } catch (error) {
        res.status(500).send(`Proxy Core Error: ${error.message}`);
    }
};
