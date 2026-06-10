const https = require('https');
const http = require('http');
const { URL } = require('url');

const HOP_BY_HOP_HEADERS = [
    'connection',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailers',
    'transfer-encoding',
    'upgrade',
    'content-length'
];

module.exports = async (req, res) => {
    // تنظیم هدرهای CORS برای پایداری دسترسی
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const targetUrl = req.query.url;

    if (!targetUrl) {
        return res.status(400).send('Error: Target URL is required.');
    }

    // هندل کردن فایل PAC
    if (targetUrl === 'pac') {
        res.setHeader('Content-Type', 'application/x-ns-proxy-autoconfig');
        return res.status(200).send(`
            function FindProxyForURL(url, host) {
                if (dnsDomainIs(host, "youtube.com") || dnsDomainIs(host, "googlevideo.com") || dnsDomainIs(host, "telegram.org") || dnsDomainIs(host, "whatsapp.net") || dnsDomainIs(host, "instagram.com")) {
                    return "PROXY ${req.headers.host}:443";
                }
                return "DIRECT";
            }
        `);
    }

    try {
        const parsedUrl = new URL(targetUrl);
        const transport = parsedUrl.protocol === 'https:' ? https : http;

        // بازسازی هدرها بدون دستکاری‌های سنگین
        const headers = {
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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

        // ایجاد درخواست و استریم مستقیم ترافیک (بدون بافر کردن یا دستکاری متن html که باعث کرش zlib میشد)
        const proxyReq = transport.request(targetUrl, options, (proxyRes) => {
            // کپی کردن هدرهای پاسخ سرور مقصد
            Object.keys(proxyRes.headers).forEach(key => {
                const lowerKey = key.toLowerCase();
                if (!HOP_BY_HOP_HEADERS.includes(lowerKey) && lowerKey !== 'content-security-policy' && lowerKey !== 'x-frame-options') {
                    res.setHeader(key, proxyRes.headers[key]);
                }
            });

            res.writeHead(proxyRes.statusCode);
            
            // 🌟 پایپ مستقیم کدهای باینری/متنی سایت مقصد به کلاینت (بدون کرش)
            proxyRes.pipe(res);
        });

        proxyReq.on('error', (err) => {
            res.status(500).send(`Proxy Target Request Error: ${err.message}`);
        });

        // پایپ کردن بادی کلاینت (برای متدهای POST)
        req.pipe(proxyReq);

    } catch (error) {
        res.status(500).send(`Proxy Core Fatal Error: ${error.message}`);
    }
};
