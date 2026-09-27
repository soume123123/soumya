/**
 * Notification service — sends alerts to ITC users and vendors.
 * Uses SAP Alert Notification Service or email.
 */
const cds = require('@sap/cds');
const LOG = cds.log('notifications');

/**
 * Send a notification.
 * @param {object} params - { type, divisionId, message, vendorId, recipientEmail }
 */
async function sendNotification({ type, divisionId, message, vendorId, recipientEmail }) {
  LOG.info(`Notification [${type}]: ${message}`);

  // Get division approvers/contacts if no specific recipient
  if (!recipientEmail && divisionId) {
    const { DivisionApprovers } = cds.entities('itc.vendor.portal');
    const approvers = await SELECT.from(DivisionApprovers)
      .where({ division_ID: divisionId, active: true });

    for (const approver of approvers) {
      await sendEmail(approver.approverEmail, type, message);
    }
  } else if (recipientEmail) {
    await sendEmail(recipientEmail, type, message);
  }
}

async function sendEmail(to, type, message) {
  // In production, integrate with SAP Alert Notification Service
  // or SMTP mail service
  LOG.info(`EMAIL to ${to}: [${type}] ${message}`);

  try {
    // Try Alert Notification Service
    const ans = await cds.connect.to('AlertNotification');
    await ans.post('/alerts', {
      eventType: type,
      severity: 'INFO',
      subject: `ITC Vendor Portal: ${type.replace(/_/g, ' ')}`,
      body: message,
      resource: {
        resourceName: 'itc-vendor-portal',
        resourceType: 'application'
      },
      tags: { recipient: to }
    });
  } catch (err) {
    // Fallback: just log (in production, configure SMTP)
    LOG.warn(`Alert Notification Service not available: ${err.message}`);
    LOG.info(`Would send email to ${to}: ${message}`);
  }
}

module.exports = { sendNotification };
