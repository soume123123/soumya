/**
 * Cash Discount Calculator.
 * Computes discount amounts and deadlines based on SAP payment terms.
 */
const cds = require('@sap/cds');
const LOG = cds.log('cash-discount');
const { calculateGSTOnCashDiscount } = require('./gst-processor');

/**
 * Calculate cash discount details for a document.
 * @param {object} document - The Documents entity record
 * @returns {object} Cash discount details
 */
function calculateCashDiscount(document) {
  const baselineDate = new Date(document.documentDate || new Date());
  const baseAmount = document.baseAmount || document.totalAmount || 0;

  const result = {
    paymentTerms: document.cashDiscountTerms,
    baselineDate: baselineDate.toISOString().slice(0, 10),
    discount1: null,
    discount2: null,
    netDueDate: null
  };

  // Discount period 1
  if (document.cashDiscountPct1 && document.cashDiscountDays1) {
    const deadline1 = addDays(baselineDate, document.cashDiscountDays1);
    const discountAmt1 = Math.round(baseAmount * document.cashDiscountPct1 / 100 * 100) / 100;

    // GST reversal on discount
    const gstReversal1 = calculateGSTOnCashDiscount(
      discountAmt1,
      document.totalAmount,
      document.totalTaxAmount,
      document.supplyType
    );

    result.discount1 = {
      percent: document.cashDiscountPct1,
      days: document.cashDiscountDays1,
      deadline: deadline1.toISOString().slice(0, 10),
      amount: discountAmt1,
      gstReversal: gstReversal1.total,
      netDiscount: Math.round((discountAmt1 - gstReversal1.total) * 100) / 100,
      isEligible: new Date() <= deadline1
    };
  }

  // Discount period 2
  if (document.cashDiscountPct2 && document.cashDiscountDays2) {
    const deadline2 = addDays(baselineDate, document.cashDiscountDays2);
    const discountAmt2 = Math.round(baseAmount * document.cashDiscountPct2 / 100 * 100) / 100;

    const gstReversal2 = calculateGSTOnCashDiscount(
      discountAmt2,
      document.totalAmount,
      document.totalTaxAmount,
      document.supplyType
    );

    result.discount2 = {
      percent: document.cashDiscountPct2,
      days: document.cashDiscountDays2,
      deadline: deadline2.toISOString().slice(0, 10),
      amount: discountAmt2,
      gstReversal: gstReversal2.total,
      netDiscount: Math.round((discountAmt2 - gstReversal2.total) * 100) / 100,
      isEligible: new Date() <= deadline2
    };
  }

  // Net due date (no discount)
  const netDueDays = document.cashDiscountDays2
    ? document.cashDiscountDays2 + 30
    : (document.cashDiscountDays1 ? document.cashDiscountDays1 + 30 : 30);
  result.netDueDate = addDays(baselineDate, netDueDays).toISOString().slice(0, 10);

  return result;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

module.exports = { calculateCashDiscount };
