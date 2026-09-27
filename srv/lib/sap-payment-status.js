/**
 * Fetch payment status and open items from SAP FI.
 */
const cds = require('@sap/cds');
const LOG = cds.log('sap-payment');
const { getAdapter, getSAPVendorCode } = require('./sap-adapter-factory');

/**
 * Fetch payment summary with ageing for a vendor in a division.
 */
async function fetchPaymentSummary(divisionId, vendorId) {
  const adapter = await getAdapter(divisionId, 'PAYMENT_STATUS');
  const sapVendorCode = await getSAPVendorCode(vendorId, divisionId);

  LOG.info(`Fetching payment status for vendor ${sapVendorCode}`);

  try {
    const filter = `Supplier eq '${sapVendorCode}' and CompanyCode eq '${adapter.config.companyCode}'`;
    const result = await adapter.get(null, `?$filter=${encodeURIComponent(filter)}`);
    const items = result?.data?.results || result?.value || result?.data || [];
    const openItems = Array.isArray(items) ? items : [items];

    // Calculate ageing buckets
    const today = new Date();
    const buckets = { CURRENT: { amount: 0, count: 0 }, '0_30': { amount: 0, count: 0 }, '31_60': { amount: 0, count: 0 }, '61_90': { amount: 0, count: 0 }, '90_PLUS': { amount: 0, count: 0 } };

    let totalOutstanding = 0;
    let totalOverdue = 0;
    let currentDue = 0;

    for (const item of openItems) {
      const amount = parseFloat(item.AmountInCompanyCodeCurrency || item.OpenAmount || item.Amount || 0);
      const dueDate = new Date(item.NetDueDate || item.DueDate || item.DocumentDate);
      const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));

      totalOutstanding += Math.abs(amount);

      if (daysOverdue <= 0) {
        currentDue += Math.abs(amount);
        buckets.CURRENT.amount += Math.abs(amount);
        buckets.CURRENT.count++;
      } else if (daysOverdue <= 30) {
        totalOverdue += Math.abs(amount);
        buckets['0_30'].amount += Math.abs(amount);
        buckets['0_30'].count++;
      } else if (daysOverdue <= 60) {
        totalOverdue += Math.abs(amount);
        buckets['31_60'].amount += Math.abs(amount);
        buckets['31_60'].count++;
      } else if (daysOverdue <= 90) {
        totalOverdue += Math.abs(amount);
        buckets['61_90'].amount += Math.abs(amount);
        buckets['61_90'].count++;
      } else {
        totalOverdue += Math.abs(amount);
        buckets['90_PLUS'].amount += Math.abs(amount);
        buckets['90_PLUS'].count++;
      }
    }

    // Sync to local DB for offline access
    await syncPaymentItemsToLocal(divisionId, vendorId, openItems);

    return {
      totalOutstanding: Math.round(totalOutstanding * 100) / 100,
      totalOverdue: Math.round(totalOverdue * 100) / 100,
      currentDue: Math.round(currentDue * 100) / 100,
      ageing: Object.entries(buckets).map(([bucket, data]) => ({
        bucket,
        amount: Math.round(data.amount * 100) / 100,
        count: data.count
      }))
    };
  } catch (err) {
    LOG.error('Payment status fetch failed:', err.message);
    throw new Error(`Failed to fetch payment status: ${err.message}`);
  }
}

/**
 * Sync SAP open items to local HANA for offline access.
 */
async function syncPaymentItemsToLocal(divisionId, vendorId, sapItems) {
  const { PaymentItems } = cds.entities('itc.vendor.portal');
  const now = new Date().toISOString();

  for (const item of sapItems) {
    const sapDocNumber = item.AccountingDocument || item.SAPDocNumber || '';
    const sapFiscalYear = item.FiscalYear || '';

    if (!sapDocNumber) continue;

    // Upsert: check if exists
    const existing = await SELECT.one.from(PaymentItems).where({
      vendor_ID: vendorId,
      division_ID: divisionId,
      sapDocNumber,
      sapFiscalYear
    });

    const data = {
      vendor_ID: vendorId,
      division_ID: divisionId,
      sapCompanyCode: item.CompanyCode,
      sapDocNumber,
      sapFiscalYear,
      documentType: item.AccountingDocumentType || item.DocumentType,
      postingDate: item.PostingDate,
      documentDate: item.DocumentDate,
      dueDate: item.NetDueDate || item.DueDate,
      originalAmount: parseFloat(item.OriginalAmount || item.AmountInCompanyCodeCurrency) || 0,
      openAmount: parseFloat(item.OpenAmount || item.AmountInCompanyCodeCurrency) || 0,
      currency_code: item.CompanyCodeCurrency || 'INR',
      paymentStatus: parseFloat(item.OpenAmount || 0) === 0 ? 'PAID' : 'OPEN',
      lastSyncedAt: now
    };

    if (existing) {
      await UPDATE(PaymentItems).set(data).where({ ID: existing.ID });
    } else {
      await INSERT.into(PaymentItems).entries(data);
    }
  }

  LOG.info(`Synced ${sapItems.length} payment items for vendor ${vendorId}`);
}

module.exports = { fetchPaymentSummary, syncPaymentItemsToLocal };
