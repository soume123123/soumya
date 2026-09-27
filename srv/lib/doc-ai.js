/**
 * SAP Document Information Extraction (DOX) Integration
 * Uploads documents for AI-powered field extraction and retrieves results.
 */
const cds = require('@sap/cds');
const LOG = cds.log('doc-ai');

/**
 * Get DOX API client via BTP destination.
 */
async function getDocAIClient() {
  try {
    return await cds.connect.to('DOX_API');
  } catch (err) {
    throw new Error(`Failed to connect to Document AI service: ${err.message}`);
  }
}

/**
 * Upload a document to SAP Document Information Extraction.
 * @param {Buffer} fileBuffer - File content
 * @param {string} fileName - Original file name
 * @param {string} mediaType - MIME type
 * @returns {string} Job ID for polling
 */
async function uploadToDocAI(fileBuffer, fileName, mediaType) {
  const client = await getDocAIClient();

  const options = {
    schemaId: 'SAP_invoice_schema',
    clientId: 'default',
    documentType: 'invoice',
    extractionVersion: 'v2',
    enrichment: {
      sender: { top: 5, type: 'businessEntity', subtype: 'supplier' },
      employee: { type: 'employee' }
    }
  };

  LOG.info(`Uploading document to DOX: ${fileName} (${mediaType})`);

  // FormData construction for DOX API
  const formData = new FormData();
  formData.append('file', new Blob([fileBuffer], { type: mediaType }), fileName);
  formData.append('options', JSON.stringify(options));

  const response = await client.post('/document/jobs', formData);

  const jobId = response?.data?.id || response?.id;
  if (!jobId) throw new Error('DOX API did not return a job ID');

  LOG.info(`DOX job created: ${jobId}`);
  return jobId;
}

/**
 * Get extraction result from DOX.
 * @param {string} jobId - DOX job ID
 * @returns {object} Normalized extraction result
 */
async function getExtractionResult(jobId) {
  const client = await getDocAIClient();
  const response = await client.get(`/document/jobs/${jobId}`);
  const job = response?.data || response;

  if (job.status !== 'DONE') {
    return {
      status: job.status,
      confidence: 0,
      fields: {},
      extractedFields: [],
      lineItems: [],
      rawResponse: job
    };
  }

  // Parse header fields
  const headerFields = {};
  const extractedFields = [];

  for (const field of (job.extraction?.headerFields || [])) {
    headerFields[field.name] = field.value;
    extractedFields.push({
      name: field.name,
      value: String(field.value || ''),
      confidence: field.confidence || 0
    });
  }

  // Parse line items
  const lineItems = (job.extraction?.lineItems || []).map(li => {
    const item = {};
    for (const field of (Array.isArray(li) ? li : li.fields || [])) {
      item[field.name] = field.value;
    }
    return {
      description: item.description || '',
      quantity: parseFloat(item.quantity) || 0,
      unitPrice: parseFloat(item.unitPrice) || 0,
      amount: parseFloat(item.netAmount) || 0,
      hsnCode: item.hsnSacCode || item.hsnCode || '',
      taxRate: parseFloat(item.taxRate) || 0,
      taxAmount: parseFloat(item.taxAmount) || 0
    };
  });

  // Calculate overall confidence
  const confidences = (job.extraction?.headerFields || [])
    .map(f => f.confidence)
    .filter(c => c != null);
  const avgConfidence = confidences.length
    ? confidences.reduce((a, b) => a + b, 0) / confidences.length
    : 0;

  return {
    status: 'DONE',
    confidence: Math.round(avgConfidence * 100) / 100,
    fields: {
      invoiceNumber: headerFields.documentNumber || headerFields.invoiceId || '',
      invoiceDate: headerFields.documentDate || '',
      poNumber: headerFields.purchaseOrderNumber || headerFields.purchaseOrder || '',
      senderName: headerFields.senderName || '',
      grossAmount: parseFloat(headerFields.grossAmount) || 0,
      netAmount: parseFloat(headerFields.netAmount) || 0,
      taxAmount: parseFloat(headerFields.taxAmount) || 0,
      senderTaxId: headerFields.senderTaxId || headerFields.senderGstin || '',
      receiverTaxId: headerFields.receiverTaxId || headerFields.receiverGstin || '',
      currency: headerFields.currencyCode || 'INR'
    },
    extractedFields,
    lineItems,
    rawResponse: job
  };
}

module.exports = { uploadToDocAI, getExtractionResult };
