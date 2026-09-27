/**
 * Three-Way Match Engine
 * Compares Purchase Order, Goods Receipt (GRN), and Invoice data
 * to detect quantity and price variances.
 */
const cds = require('@sap/cds');
const LOG = cds.log('three-way-match');

// Default tolerances (configurable per division)
const DEFAULT_QTY_TOLERANCE_PCT = 5;    // 5% quantity tolerance
const DEFAULT_PRICE_TOLERANCE_PCT = 2;  // 2% price tolerance

/**
 * Perform three-way match for a document.
 * Fetches PO and GRN data from SAP and compares with invoice line items.
 * @param {object} document - Documents entity record
 * @returns {object} { overallStatus, results[] }
 */
async function performThreeWayMatch(document) {
  const { DocumentItems, ThreeWayMatchResults } = cds.entities('itc.vendor.portal');

  // Get invoice line items
  const invoiceItems = await SELECT.from(DocumentItems)
    .where({ document_ID: document.ID });

  if (!invoiceItems.length) {
    LOG.warn(`No line items for document ${document.ID}`);
    return { overallStatus: 'NO_ITEMS', results: [] };
  }

  // Fetch PO data from SAP
  let poItems = [];
  let grnItems = [];

  try {
    const { fetchPurchaseOrders, fetchGRNStatus } = require('./sap-po-fetch');

    if (document.poNumber) {
      const pos = await fetchPurchaseOrders(document.division_ID, document.vendor_ID);
      const matchingPO = pos.find(po => po.poNumber === document.poNumber);
      if (matchingPO) {
        poItems = matchingPO.items || [];
      }

      grnItems = await fetchGRNStatus(document.division_ID, document.poNumber);
    }
  } catch (err) {
    LOG.warn(`Could not fetch PO/GRN data from SAP: ${err.message}`);
    // Continue with whatever data we have
  }

  // Delete existing match results
  await DELETE.from(ThreeWayMatchResults).where({ document_ID: document.ID });

  // Perform matching per line item
  const results = [];
  let hasQtyMismatch = false;
  let hasPriceMismatch = false;

  for (const invItem of invoiceItems) {
    const poItem = poItems.find(p =>
      p.itemNumber === invItem.poItemNumber ||
      p.material === invItem.materialNumber
    );

    const grnForItem = grnItems.filter(g =>
      g.poItem === invItem.poItemNumber ||
      g.material === invItem.materialNumber
    );
    const totalGrnQty = grnForItem.reduce((sum, g) => sum + (g.quantity || 0), 0);

    const poQty = poItem?.quantity || 0;
    const poPrice = poItem?.unitPrice || 0;
    const invQty = invItem.quantity || 0;
    const invPrice = invItem.unitPrice || 0;

    // Calculate variances
    const qtyVariance = invQty - totalGrnQty;
    const priceVariance = invPrice - poPrice;

    // Check tolerances
    const qtyTolerancePassed = poQty === 0 || 
      (Math.abs(qtyVariance) / Math.max(totalGrnQty, 1) * 100) <= DEFAULT_QTY_TOLERANCE_PCT;
    const priceTolerancePassed = poPrice === 0 ||
      (Math.abs(priceVariance) / Math.max(poPrice, 1) * 100) <= DEFAULT_PRICE_TOLERANCE_PCT;

    let matchStatus = 'OK';
    if (!qtyTolerancePassed && !priceTolerancePassed) {
      matchStatus = 'BOTH';
      hasQtyMismatch = true;
      hasPriceMismatch = true;
    } else if (!qtyTolerancePassed) {
      matchStatus = 'QTY_MISMATCH';
      hasQtyMismatch = true;
    } else if (!priceTolerancePassed) {
      matchStatus = 'PRICE_MISMATCH';
      hasPriceMismatch = true;
    }

    const matchResult = {
      document_ID: document.ID,
      lineNumber: invItem.lineNumber,
      poQuantity: poQty,
      grnQuantity: totalGrnQty,
      invoiceQuantity: invQty,
      poUnitPrice: poPrice,
      invoiceUnitPrice: invPrice,
      quantityVariance: qtyVariance,
      priceVariance: priceVariance,
      matchStatus,
      tolerancePassed: qtyTolerancePassed && priceTolerancePassed
    };

    await INSERT.into(ThreeWayMatchResults).entries(matchResult);
    results.push(matchResult);
  }

  // Update document match status
  const { Documents } = cds.entities('itc.vendor.portal');
  const overallStatus = (hasQtyMismatch || hasPriceMismatch) ? 'MISMATCH' : 'MATCHED';

  await UPDATE(Documents).set({
    poMatchStatus: hasQtyMismatch ? 'MISMATCH' : 'MATCHED',
    grnMatchStatus: hasQtyMismatch ? 'MISMATCH' : 'MATCHED',
    priceMatchStatus: hasPriceMismatch ? 'MISMATCH' : 'MATCHED'
  }).where({ ID: document.ID });

  LOG.info(`Three-way match for doc ${document.ID}: ${overallStatus} (${results.length} items)`);

  return { overallStatus, results };
}

module.exports = { performThreeWayMatch };
