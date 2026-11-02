const nodemailer = require('nodemailer');
const https = require('https');

const BREVO_TIMEOUT_MS = 10000;

const sendEmail = async (options) => {
    // If Brevo API Key is present, send email via HTTP API (bypasses Render SMTP port blocking)
    if (process.env.BREVO_API_KEY) {
        const payload = {
            sender: { name: 'Cartify Premium', email: process.env.EMAIL_FROM || process.env.EMAIL_USER || 'no-reply@cartify-hub.com' },
            to: [{ email: options.email }],
            subject: options.subject,
            textContent: options.message,
        };
        if (options.html) {
            payload.htmlContent = options.html;
        }
        const data = JSON.stringify(payload);

        const requestOptions = {
            hostname: 'api.brevo.com',
            port: 443,
            path: '/v3/smtp/email',
            method: 'POST',
            headers: {
                'api-key': process.env.BREVO_API_KEY,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        };

        return new Promise((resolve, reject) => {
            const req = https.request(requestOptions, (res) => {
                let body = '';
                res.on('data', (chunk) => body += chunk);
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(body);
                    } else {
                        reject(new Error(`Brevo API Error: ${res.statusCode} - ${body}`));
                    }
                });
            });

            req.setTimeout(BREVO_TIMEOUT_MS, () => {
                req.destroy(new Error(`Brevo API timed out after ${BREVO_TIMEOUT_MS}ms`));
            });

            req.on('error', reject);
            req.write(data);
            req.end();
        });
    }

    // Fallback: SMTP Transporter (for local development)
    const transporter = nodemailer.createTransport({
        service: 'Gmail',
        connectionTimeout: 10000,
        greetingTimeout: 5000,
        socketTimeout: 10000,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    const mailOptions = {
        from: `"Cartify Premium" <${process.env.EMAIL_FROM || process.env.EMAIL_USER || 'no-reply@cartify-hub.com'}>`,
        to: options.email, 
        subject: options.subject,
        text: options.message,
    };
    if (options.html) {
        mailOptions.html = options.html;
    }

    await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;