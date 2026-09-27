/**
 * GST Processing utilities.
 * GSTIN validation, supply type detection, ITC eligibility, GSTR-2B reconciliation.
 */
const cds = require('@sap/cds');
const LOG = cds.log('gst');

// GSTIN format: 2-digit state code + 10-char PAN + 1 entity code + Z + checksum
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

/**
 * Validate GSTIN format.
 */
function validateGSTIN(gstin) {
  if (!gstin || gstin.length !== 15) {
    return { valid: false, error: 'GSTIN must be 15 characters' };
  }
  if (!GSTIN_REGEX.test(gstin)) {
    return { valid: false, error: 'Invalid GSTIN format' };
  }
  // Validate checksum (Luhn-like algorithm for GSTIN)
  const checksumValid = validateGSTINChecksum(gstin);
  if (!checksumValid) {
    return { valid: false, error: 'Invalid GSTIN checksum' };
  }
  return {
    valid: true,
    stateCode: gstin.substring(0, 2),
    pan: gstin.substring(2, 12),
    entityCode: gstin.charAt(12)
  };
}

function validateGSTINChecksum(gstin) {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const idx = chars.indexOf(gstin[i]);
    let val = ((i % 2 === 0) ? idx : idx * 2);
    val = Math.floor(val / 36) + (val % 36);
    sum += val;
  }
  const checkChar = chars[(36 - (sum % 36)) % 36];
  return checkChar === gstin[14];
}

/**
 * Determine supply type based on vendor and buyer GSTIN state codes.
 */
function determineSupplyType(vendorGSTIN, buyerGSTIN) {
  if (!vendorGSTIN || !buyerGSTIN) return 'UNKNOWN';
  const vendorState = vendorGSTIN.substring(0, 2);
  const buyerState = buyerGSTIN.substring(0, 2);
  return vendorState === buyerState ? 'INTRA_STATE' : 'INTER_STATE';
}

/**
 * Calculate GST amounts based on supply type.
 */
function calculateGST(baseAmount, taxRate, supplyType) {
  const totalTax = baseAmount * (taxRate / 100);
  if (supplyType === 'INTRA_STATE') {
    return {
      cgst: Math.round(totalTax / 2 * 100) / 100,
      sgst: Math.round(totalTax / 2 * 100) / 100,
      igst: 0,
      totalTax: Math.round(totalTax * 100) / 100
    };
  } else {
    return {
      cgst: 0,
      sgst: 0,
      igst: Math.round(totalTax * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100
    };
  }
}

/**
 * Check ITC (Input Tax Credit) eligibility.
 */
function checkITCEligibility(document) {
  const reasons = [];
  // Basic eligibility checks
  if (!document.vendorGSTIN) reasons.push('Vendor GSTIN missing');
  if (!document.buyerGSTIN) reasons.push('Buyer GSTIN missing');
  if (document.reverseCharge) reasons.push('Reverse charge mechanism applies');
  if (!document.documentNumber) reasons.push('Invoice number missing');
  // Validate GSTIN
  if (document.vendorGSTIN && !validateGSTIN(document.vendorGSTIN).valid) {
    reasons.push('Invalid vendor GSTIN');
  }
  return {
    eligible: reasons.length === 0,
    reasons,
    itcAmount: reasons.length === 0 ? (document.totalTaxAmount || 0) : 0
  };
}

/**
 * Calculate GST reversal on cash discount as per GST law.
 * When cash discount is availed, proportional GST must be reversed.
 */
function calculateGSTOnCashDiscount(discountAmount, totalAmount, totalTaxAmount, supplyType) {
  if (!discountAmount || !totalAmount) return { cgst: 0, sgst: 0, igst: 0, total: 0 };
  const proportion = discountAmount / totalAmount;
  const gstReversal = totalTaxAmount * proportion;

  if (supplyType === 'INTRA_STATE') {
    return {
      cgst: Math.round(gstReversal / 2 * 100) / 100,
      sgst: Math.round(gstReversal / 2 * 100) / 100,
      igst: 0,
      total: Math.round(gstReversal * 100) / 100
    };
  } else {
    return {
      cgst: 0,
      sgst: 0,
      igst: Math.round(gstReversal * 100) / 100,
      total: Math.round(gstReversal * 100) / 100
    };
  }
}

module.exports = {
  validateGSTIN,
  determineSupplyType,
  calculateGST,
  checkITCEligibility,
  calculateGSTOnCashDiscount
};
