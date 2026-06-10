const https = require('https');
const http = require('http');
const { URL } = require('url');
const zlib = require('zlib');

function rewriteUrls(html, targetUrl) {
try {
const targetUrlObj = new URL(targetUrl);
const targetOrigin = targetUrlObj.origin;
const targetBase = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);

    return html.replace(/(href|src|action)\s*=\s*(['"])([^'"]+)\2/gi, (match, attr, quote, urlValue) => {
        if (urlValue.startsWith('#') || urlValue.startsWith('javascript:') || urlValue.startsWith('data:')) {
            return match;
        }
        
        let absoluteUrl = '';
        if (urlValue.startsWith('http://') || urlValue.startsWith('https://')) {
            absoluteUrl = urlValue;
        } else if (urlValue.startsWith('//')) {
            absoluteUrl = 'https:' + urlValue;
        } else if (urlValue.startsWith('/')) {
            absoluteUrl = targetOrigin + urlValue;
        } else {
            absoluteUrl = targetBase + urlValue;
        }

        return `/api/proxy?url=${encodeURIComponent(absoluteUrl)}`;
    });
} catch (e) {
    return html;
}
}

function requestFollowRedirect(targetUrl, reqOptions, reqBody, redirectCount = 0) {
return new Promise((resolve, reject) => {
if (redirectCount > 5) {
reject(new Error('Too many redirects'));
return;
}

    const parsedUrl = new URL(targetUrl);
    const transport = parsedUrl.protocol === 'https:' ? https : http;

    const headers = {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'accept-language': 'fa-IR,fa;q=0.9,en-US;q=0.8,en;q=0.7',
        'host': parsedUrl.host
    };

    if (reqOptions.headers) {
        Object.keys(reqOptions.headers).forEach(key => {
            const lowerKey = key.toLowerCase();
            if (lowerKey !== 'host' && lowerKey !== 'user-agent') {
                headers[key] = reqOptions.headers[key];
            }
        });
    }

    const options = {
        method: reqOptions.method || 'GET',
        headers: headers
    };

    const clientReq = transport.request(targetUrl, options, (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
            let redirectUrl = res.headers.location;
            if (!redirectUrl.startsWith('http://') && !redirectUrl.startsWith('https://')) {
                redirectUrl = new URL(redirectUrl, targetUrl).href;
            }
            resolve(requestFollowRedirect(redirectUrl, reqOptions, reqBody, redirectCount + 1));
        } else {
            resolve({ res, finalUrl: targetUrl });
        }
    });

    clientReq.on('error', (err) => reject(err));

    if (reqBody) {
        clientReq.write(reqBody);
    }
    clientReq.end();
});
}

module.exports = async (req, res) => {
res.setHeader('Access-Control-Allow-Origin', '');
res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
res.setHeader('Access-Control-Allow-Headers', '');

if (req.method === 'OPTIONS') {
    return res.status(200).end();
}

const targetUrl = req.query.url;

if (!targetUrl) {
    return res.status(400).send('Error: Target URL is required.');
}

if (targetUrl === 'pac') {
    res.setHeader('Content-Type', 'application/x-ns-proxy-autoconfig');
    const host = req.headers.host;
    return res.status(200).send(`
        function FindProxyForURL(url, host) {
            if (dnsDomainIs(host, "youtube.com") || dnsDomainIs(host, "googlevideo.com") || dnsDomainIs(host, "telegram.org") || dnsDomainIs(host, "whatsapp.net") || dnsDomainIs(host, "instagram.com")) {
                return "PROXY ${host}:443";
            }
            return "DIRECT";
        }
    `);
}

try {
    let reqBody = null;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        const chunks = [];
        for await (const chunk of req) {
            chunks.push(chunk);
        }
        reqBody = Buffer.concat(chunks);
    }

    const { res: targetRes, finalUrl } = await requestFollowRedirect(targetUrl, req, reqBody);
    const contentType = targetRes.headers['content-type'] || '';

    Object.keys(targetRes.headers).forEach(key => {
        const lowerKey = key.toLowerCase();
        if (lowerKey !== 'content-security-policy' && lowerKey !== 'x-frame-options' && lowerKey !== 'transfer-encoding') {
            res.setHeader(key, targetRes.headers[key]);
        }
    });

    if (contentType.includes('text/html')) {
        let stream = targetRes;
        const contentEncoding = targetRes.headers['content-encoding'];
        if (contentEncoding === 'gzip') {
            stream = targetRes.pipe(zlib.createGunzip());
        } else if (contentEncoding === 'deflate') {
            stream = targetRes.pipe(zlib.createInflate());
        } else if (contentEncoding === 'br') {
            stream = targetRes.pipe(zlib.createBrotliDecompress());
        }

        const bodyChunks = [];
        stream.on('data', chunk => bodyChunks.push(chunk));
        stream.on('end', () => {
            let html = Buffer.concat(bodyChunks).toString('utf-8');
            const baseHref = `<base href="${finalUrl}">`;
            
            const vidalBarHtml = `
            <div id="vidal-proxy-bar" style="position: fixed; top: 0; left: 0; right: 0; height: 50px; background: #0f172a; border-bottom: 2px solid #ec4899; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 4px 15px rgba(0,0,0,0.6); z-index: 2147483647; direction: rtl; font-family: sans-serif; padding: 0 15px;">
                <span style="font-weight: bold; color: #f43f5e; font-size: 14px;">VIDAL NODE SECURE</span>
                <form onsubmit="event.preventDefault(); const val = document.getElementById('vidal-bar-input').value; window.location.href = '/api/proxy?url=' + encodeURIComponent(val.startsWith('http') ? val : 'https://' + val);" style="display: flex; gap: 8px; flex-grow: 1; max-width: 500px; margin: 0 15px;">
                    <input id="vidal-bar-input" type="text" style="flex-grow: 1; background: #020617; border: 1px solid #334155; border-radius: 8px; padding: 4px 12px; color: #fff; font-size: 12px; outline: none;" value="${finalUrl}">
                    <button type="submit" style="background: linear-gradient(to right, #ec4899, #f97316); color: #fff; border: none; border-radius: 8px; padding: 4px 15px; font-weight: bold; cursor: pointer; font-size: 12px;">انتقال</button>
                </form>
                <button onclick="window.location.href = '/'" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: #f87171; border-radius: 8px; padding: 4px 12px; font-size: 11px; cursor: pointer; font-weight: bold;">پنل اصلی</button>
            </div>
            <div style="height: 50px; width: 100%;"></div>
            `;

            if (html.includes('<head>')) {
                html = html.replace('<head>', `<head>${baseHref}`);
            } else {
                html = baseHref + html;
            }

            if (html.includes('<body>')) {
                html = html.replace('<body>', `<body>${vidalBarHtml}`);
            } else if (html.match(/<body[^>]*>/i)) {
                html = html.replace(/<body[^>]*>/i, (match) => `${match}${vidalBarHtml}`);
            } else {
                html = vidalBarHtml + html;
            }

            html = rewriteUrls(html, finalUrl);

            res.writeHead(targetRes.statusCode, { 'content-type': 'text/html; charset=utf-8' });
            res.end(html);
        });
    } else {
        res.writeHead(targetRes.statusCode);
        targetRes.pipe(res);
    }

} catch (error) {
    res.status(500).send(`Proxy Connection Error: ${error.message}`);
}
};
