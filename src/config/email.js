const nodemailer = require('nodemailer');

const sendEmail = async (fromName, to, subject, text, html) => {
  try {
    let transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SENDER_EMAIL,
        pass: process.env.SENDER_PASSWORD
      }
    });

    let mailOptions = {
      from: `"${fromName}" <${process.env.SENDER_EMAIL}>`,
      to: to,
      subject: subject,
      text: text,
      html: html
    };

    let info = await transporter.sendMail(mailOptions);

    return {
      status: 'OK',
      message: 'Email sent successfully.',
      messageId: info.messageId
    };
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error('An error occurred while sending email: ' + error.message);
  }
};

const sendEmailWithAttachment = async (fromName, to, subject, text, html, attachments, cc = null) => {
  try {
    let transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SENDER_EMAIL,
        pass: process.env.SENDER_PASSWORD
      }
    });

    let toRecipients = to;
    if (Array.isArray(to)) {
      toRecipients = to.join(', ');
    }

    let ccRecipients = null;
    if (cc) {
      if (Array.isArray(cc)) {
        ccRecipients = cc.join(', ');
      } else {
        ccRecipients = cc;
      }
    }

    let mailOptions = {
      from: `"${fromName}" <${process.env.SENDER_EMAIL}>`,
      to: toRecipients,
      subject: subject,
      text: text,
      html: html,
      attachments: attachments
    };

    if (ccRecipients) {
      mailOptions.cc = ccRecipients;
    }

    let info = await transporter.sendMail(mailOptions);

    return {
      status: 'OK',
      message: 'Email with attachment sent successfully.',
      messageId: info.messageId
    };
  } catch (error) {
    console.error('Error sending email with attachment:', error);
    throw new Error('An error occurred while sending email with attachment: ' + error.message);
  }
};

module.exports = { sendEmail, sendEmailWithAttachment };
