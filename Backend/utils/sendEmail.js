const nodemailer = require('nodemailer');
const https = require('https');

const sendEmail = async (options) => {
    // If Brevo API Key is present, send email via HTTP API (bypasses Render SMTP port blocking)
    if (process.env.BREVO_API_KEY) {
        const data = JSON.stringify({
            sender: { name: 'Cartify Premium', email: process.env.EMAIL_FROM || process.env.EMAIL_USER },
            to: [{ email: options.email }],
            subject: options.subject,
            textContent: options.message
        });

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
            req.on('error', reject);
            req.write(data);
            req.end();
        });
    }

    // Fallback: SMTP Transporter (for local environment)
    const transporter = nodemailer.createTransport({
        service: 'Gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    const mailOptions = {
        from: `"Cartify Premium" <${process.env.EMAIL_USER}>`,
        to: options.email, 
        subject: options.subject,
        text: options.message,
    };

    await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;