/**
 * SAP Invoice/CN/DN Posting via OData or BAPI
 * Uses the adapter factory to resolve the correct service per division.
 */
const cds = require('@sap/cds');
const LOG = cds.log('sap-posting');
const { getAdapter, getSAPVendorCode } = require('./sap-adapter-factory');

/**
 * Post a document (Invoice/CN/DN) to the SAP backend for a division.
 * @param {object} document - The Documents entity record
 * @returns {object} { sapDocNumber, sapFiscalYear, postingDate }
 */
async function postDocumentToSAP(document) {
  const adapter = await getAdapter(document.division_ID, 'INVOICE_POST');
  const sapVendorCode = await getSAPVendorCode(document.vendor_ID, document.division_ID);

  // Get line items
  const { DocumentItems } = cds.entities('itc.vendor.portal');
  const items = await SELECT.from(DocumentItems).where({ document_ID: document.ID });

  // Get document type mapping
  const { DocumentTypes } = cds.entities('itc.vendor.portal');
  const docType = await SELECT.one.from(DocumentTypes)
    .where({ code: document.documentType_code });

  const postingDate = new Date().toISOString().slice(0, 10);

  LOG.info(`Posting ${document.documentType_code} ${document.documentNumber} to SAP system ${adapter.config.systemId}`);

  if (adapter.config.systemType === 'S4HANA' && adapter.isStandard) {
    // ── S/4HANA Standard OData API ──
    return postViaS4HANAOData(adapter, document, items, sapVendorCode, docType, postingDate);
  } else if (adapter.config.systemType === 'ECC' && !adapter.isStandard) {
    // ── ECC Custom OData / RFC ──
    return postViaECCCustom(adapter, document, items, sapVendorCode, docType, postingDate);
  } else if (adapter.config.systemType === 'ECC' && adapter.isStandard) {
    // ── ECC Standard BAPI ──
    return postViaECCBAPI(adapter, document, items, sapVendorCode, docType, postingDate);
  } else {
    // ── S/4HANA Custom OData ──
    return postViaCustomOData(adapter, document, items, sapVendorCode, docType, postingDate);
  }
}

async function postViaS4HANAOData(adapter, doc, items, vendorCode, docType, postingDate) {
  const payload = {
    CompanyCode: adapter.config.companyCode,
    DocumentDate: doc.documentDate,
    PostingDate: postingDate,
    SupplierInvoiceIDByInvoicingParty: doc.documentNumber,
    InvoicingParty: vendorCode,
    DocumentCurrency: doc.currency_code || 'INR',
    InvoiceGrossAmount: String(doc.totalAmount),
    DocumentHeaderText: `Portal: ${doc.documentType_code}`,
    TaxIsCalculatedAutomatically: true,
    to_SupplierInvoiceItemPurOrd: items.map(item => ({
      PurchaseOrder: doc.poNumber,
      PurchaseOrderItem: item.poItemNumber || '00010',
      SupplierInvoiceItemAmount: String(item.amount),
      DocumentCurrency: doc.currency_code || 'INR',
      TaxCode: adapter.additionalConfig.defaultTaxCode || 'V0',
      Plant: item.plantCode || adapter.additionalConfig.defaultPlant || ''
    }))
  };

  LOG.info('S/4HANA OData POST payload prepared');
  const result = await adapter.post('A_SupplierInvoice', payload);
  const data = result?.data || result;

  return {
    sapDocNumber: data.SupplierInvoice,
    sapFiscalYear: data.FiscalYear,
    postingDate
  };
}

async function postViaECCBAPI(adapter, doc, items, vendorCode, docType, postingDate) {
  const params = {
    HEADERDATA: {
      INVOICE_IND: doc.documentType_code === 'CREDIT_NOTE' ? '' : 'X',
      DOC_TYPE: docType?.sapDocType || 'RE',
      DOC_DATE: doc.documentDate?.replace(/-/g, ''),
      PSTNG_DATE: postingDate.replace(/-/g, ''),
      REF_DOC_NO: doc.documentNumber,
      COMP_CODE: adapter.config.companyCode,
      CURRENCY: doc.currency_code || 'INR',
      GROSS_AMOUNT: doc.totalAmount,
      CALC_TAX_IND: 'X',
      HEADER_TXT: `Portal: ${doc.documentType_code}`
    },
    ITEMDATA: items.map((item, idx) => ({
      INVOICE_DOC_ITEM: String((idx + 1) * 10).padStart(6, '0'),
      PO_NUMBER: doc.poNumber,
      PO_ITEM: item.poItemNumber || String((idx + 1) * 10).padStart(5, '0'),
      ITEM_AMOUNT: item.amount,
      TAX_CODE: adapter.additionalConfig.defaultTaxCode || 'V0',
      QUANTITY: item.quantity,
      PO_UNIT: item.uom || 'EA'
    }))
  };

  LOG.info('ECC BAPI call: BAPI_INCOMINGINVOICE_CREATE');
  const result = await adapter.callFunction('BAPI_INCOMINGINVOICE_CREATE', params);

  // Check for errors
  const errors = (result.RETURN || []).filter(r => r.TYPE === 'E');
  if (errors.length > 0) {
    const errorMsg = errors.map(r => r.MESSAGE).join('; ');
    throw new Error(`SAP BAPI Error: ${errorMsg}`);
  }

  // Commit the BAPI transaction
  await adapter.callFunction('BAPI_TRANSACTION_COMMIT', { WAIT: 'X' });

  return {
    sapDocNumber: result.INVOICEDOCNUMBER,
    sapFiscalYear: result.FISCALYEAR,
    postingDate
  };
}

async function postViaECCCustom(adapter, doc, items, vendorCode, docType, postingDate) {
  // Custom Z-OData service endpoint
  const payload = {
    InvoiceNumber: doc.documentNumber,
    InvoiceDate: doc.documentDate,
    PostingDate: postingDate,
    VendorCode: vendorCode,
    CompanyCode: adapter.config.companyCode,
    DocumentType: docType?.sapDocType || 'RE',
    Currency: doc.currency_code || 'INR',
    GrossAmount: doc.totalAmount,
    PONumber: doc.poNumber,
    VendorGSTIN: doc.vendorGSTIN,
    BuyerGSTIN: doc.buyerGSTIN,
    Items: items.map((item, idx) => ({
      ItemNumber: String((idx + 1) * 10).padStart(6, '0'),
      POItem: item.poItemNumber,
      MaterialNumber: item.materialNumber,
      Quantity: item.quantity,
      UOM: item.uom || 'EA',
      Amount: item.amount,
      TaxAmount: item.taxAmount,
      HSNCode: item.hsnSacCode
    }))
  };

  LOG.info('ECC Custom OData POST');
  const result = await adapter.post(null, payload);
  const data = result?.data || result;

  return {
    sapDocNumber: data.SAPDocNumber || data.InvoiceDocNumber,
    sapFiscalYear: data.FiscalYear,
    postingDate
  };
}

async function postViaCustomOData(adapter, doc, items, vendorCode, docType, postingDate) {
  // Generic custom OData — field mappings come from additionalConfig
  const fieldMap = adapter.additionalConfig.fieldMapping || {};
  const payload = {};

  // Map fields using config or defaults
  payload[fieldMap.invoiceNumber || 'InvoiceNumber'] = doc.documentNumber;
  payload[fieldMap.invoiceDate || 'InvoiceDate'] = doc.documentDate;
  payload[fieldMap.postingDate || 'PostingDate'] = postingDate;
  payload[fieldMap.vendorCode || 'VendorCode'] = vendorCode;
  payload[fieldMap.companyCode || 'CompanyCode'] = adapter.config.companyCode;
  payload[fieldMap.amount || 'Amount'] = doc.totalAmount;
  payload[fieldMap.currency || 'Currency'] = doc.currency_code || 'INR';
  payload[fieldMap.poNumber || 'PONumber'] = doc.poNumber;

  LOG.info('Custom OData POST with field mappings');
  const result = await adapter.post(null, payload);
  const data = result?.data || result;

  return {
    sapDocNumber: data[fieldMap.sapDocNumberResp || 'SAPDocNumber'],
    sapFiscalYear: data[fieldMap.fiscalYearResp || 'FiscalYear'],
    postingDate
  };
}

module.exports = { postDocumentToSAP };
