/**
 * SAP Payment Run (F110) integration.
 * Sends request to initiate payment run in SAP.
 */
const cds = require('@sap/cds');
const LOG = cds.log('payment-run');
const { getAdapter } = require('./sap-adapter-factory');

/**
 * Trigger a payment run in SAP (F110 equivalent).
 * @param {object} paymentRun - PaymentRuns entity record
 * @returns {object} { f110RunId, f110Date }
 */
async function triggerPaymentRun(paymentRun) {
  const adapter = await getAdapter(paymentRun.division_ID, 'PAYMENT_RUN');

  LOG.info(`Triggering payment run for division, run ID: ${paymentRun.runId}`);

  const payload = {
    CompanyCode: paymentRun.companyCode || adapter.config.companyCode,
    RunDate: paymentRun.runDate || new Date().toISOString().slice(0, 10),
    PaymentMethod: paymentRun.paymentMethod || 'T',
    VendorFrom: paymentRun.vendorFrom,
    VendorTo: paymentRun.vendorTo,
    DueDateTo: paymentRun.dueDateTo,
    Identification: paymentRun.runId
  };

  try {
    if (adapter.isStandard) {
      // Standard approach: custom wrapper around F110
      const result = await adapter.post(null, payload);
      const data = result?.data || result;
      return {
        f110RunId: data.RunIdentification || data.F110RunId || paymentRun.runId,
        f110Date: data.RunDate || payload.RunDate
      };
    } else {
      // Custom OData for F110
      const result = await adapter.post(null, payload);
      const data = result?.data || result;
      return {
        f110RunId: data.RunId || data.Identification || paymentRun.runId,
        f110Date: data.RunDate || payload.RunDate
      };
    }
  } catch (err) {
    LOG.error('Payment run trigger failed:', err.message);
    throw new Error(`Failed to trigger SAP payment run: ${err.message}`);
  }
}

module.exports = { triggerPaymentRun };
