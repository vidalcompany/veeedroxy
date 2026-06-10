const https = require('https');
const http = require('http');
const { URL } = require('url');

module.exports = async (req, res) => {
    // تنظیم هدرهای CORS برای پایداری و عدم بلاک شدن توسط پروتکل‌های مرورگر
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const targetUrl = req.query.url;

    if (!targetUrl) {
        return res.status(400).send('Error: target URL is required.');
    }

    // پاسخ‌دهی به درخواست تنظیمات خودکار سیستم‌عامل (PAC URL) برای گوشی و مودم
    if (targetUrl === 'pac') {
        res.setHeader('Content-Type', 'application/x-ns-proxy-autoconfig');
        const host = req.headers.host;
        return res.status(200).send(`
            function FindProxyForURL(url, host) {
                // هدایت ترافیک شبکه‌های اجتماعی فیلتر شده از طریق سرور ورسل شما
                if (dnsDomainIs(host, "youtube.com") || 
                    dnsDomainIs(host, "googlevideo.com") || 
                    dnsDomainIs(host, "telegram.org") || 
                    dnsDomainIs(host, "whatsapp.net") || 
                    dnsDomainIs(host, "instagram.com")) {
                    return "PROXY ${host}:443";
                }
                return "PROXY ${host}:443; DIRECT";
            }
        `);
    }

    try {
        const parsedUrl = new URL(targetUrl);
        
        // بازسازی هدرها و ست کردن هاست مقصد (دور زدن فایروال‌ها)
        const headers = { ...req.headers };
        headers['host'] = parsedUrl.host;
        
        // حذف مواردی که با استریمینگ ویدیوها تداخل دارند
        delete headers['accept-encoding']; 
        delete headers['connection'];

        const options = {
            method: req.method,
            headers: headers
        };

        const transport = parsedUrl.protocol === 'https:' ? https : http;

        // استریم زنده ویدیوها و فایل‌ها
        const proxyReq = transport.request(targetUrl, options, (proxyRes) => {
            
            // کپی هدرهای پاسخ مقصد (ویژه ویدیوهای حجیم مثل Content-Range و Content-Length)
            Object.keys(proxyRes.headers).forEach(key => {
                res.setHeader(key, proxyRes.headers[key]);
            });

            // فرستادن وضعیت پاسخ (مانند پاسخ ۲۰۶ برای یوتیوب)
            res.writeHead(proxyRes.statusCode);

            // پایپ زنده اطلاعات به مرورگر بدون قطعی یا انقضای زمان لود
            proxyRes.pipe(res);
        });

        proxyReq.on('error', (err) => {
            res.status(500).send(`Proxy Error: ${err.message}`);
        });

        req.pipe(proxyReq);

    } catch (error) {
        res.status(500).send(`Invalid URL: ${error.message}`);
    }
};
