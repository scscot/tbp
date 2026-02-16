const nodemailer = require('nodemailer');
require('dotenv').config({ path: '/Users/sscott/tbp/functions/.env.teambuilder-plus-fe74d' });

const user = process.env.PREINTAKE_SMTP_USER;
const pass = process.env.PREINTAKE_SMTP_PASS;

if (!user || !pass) {
    console.error('SMTP credentials not found');
    console.log('User:', user ? 'found' : 'missing');
    console.log('Pass:', pass ? 'found' : 'missing');
    process.exit(1);
}

console.log('SMTP User:', user);

const transporter = nodemailer.createTransport({
    host: 'smtp.dreamhost.com',
    port: 587,
    secure: false,
    requireTLS: true,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
});

async function testEmail() {
    try {
        const info = await transporter.sendMail({
            from: '"PreIntake.ai" <' + user + '>',
            to: 'scscot@gmail.com',
            subject: 'Test Email from PreIntake.ai - ' + new Date().toISOString(),
            html: '<p>This is a test email to verify SMTP is working.</p>',
        });
        console.log('Email sent successfully:', info.messageId);
    } catch (error) {
        console.error('Email failed:', error.message);
        console.error('Error code:', error.code);
        if (error.response) console.error('Error response:', error.response);
    }
}

testEmail().then(() => process.exit(0));
