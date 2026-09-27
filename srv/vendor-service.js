const cds = require('@sap/cds');
const LOG = cds.log('vendor-service');

module.exports = cds.service.impl(async function () {

  const {
    Documents, DocumentItems, DocumentAttachments,
    ShippingNotifications, ASNItems,
    VendorQueries, QueryMessages,
    PaymentItems, AuditLog,
    Vendors, VendorDivisionMappings
  } = this.entities;

  // ═══════════════════════════════════════════
  //  ROW-LEVEL SECURITY
  //  All vendor reads are filtered by vendorId from JWT
  // ═══════════════════════════════════════════
  this.before('READ', ['Documents', 'ShippingNotifications', 'VendorQueries',
    'PaymentItems', 'MyProfile', 'MyDivisions'], async (req) => {
    const vendorId = req.user.attr?.vendorId;
    if (!vendorId) return req.reject(403, 'Vendor identity not found in token');
    // MyProfile is Vendors entity — filter by ID
    if (req.target.name.endsWith('MyProfile')) {
      req.query.where({ ID: vendorId });
    } else {
      req.query.where({ vendor_ID: vendorId });
    }
  });

  // ═══════════════════════════════════════════
  //  M1/M2: DOCUMENT UPLOAD + EXTRACTION
  // ═══════════════════════════════════════════
  this.on('uploadAndExtract', 'Documents', async (req) => {
    const { file, fileName, mediaType, divisionId, documentType } = req.data;
    const vendorId = req.user.attr?.vendorId;
    if (!vendorId) return req.reject(403, 'Vendor identity not found');

    // Validate vendor has access to this division
    const mapping = await SELECT.one.from(VendorDivisionMappings)
      .where({ vendor_ID: vendorId, division_ID: divisionId, active: true });
    if (!mapping) return req.reject(403, 'You are not authorized for this division');

    // Create document record in DRAFT
    const doc = await INSERT.into(Documents).entries({
      vendor_ID: vendorId,
      division_ID: divisionId,
      documentType_code: documentType,
      fileName: fileName,
      uploadedMediaType: mediaType,
      uploadedFile: file,
      fileSize: file?.length || 0,
      status_code: 'DRAFT'
    });

    LOG.info(`Document created: ${doc.ID} for vendor ${vendorId}`);

    // Trigger Document AI extraction
    try {
      const { uploadToDocAI } = require('./lib/doc-ai');
      const jobId = await uploadToDocAI(file, fileName, mediaType);

      await UPDATE(Documents).set({
        docAiJobId: jobId,
        status_code: 'EXTRACTING'
      }).where({ ID: doc.ID });

      LOG.info(`Doc AI job started: ${jobId}`);
    } catch (err) {
      LOG.error('Doc AI upload failed:', err.message);
      // Still save document, user can retry extraction
      await UPDATE(Documents).set({
        sapPostingMessage: `Extraction failed: ${err.message}`
      }).where({ ID: doc.ID });
    }

    // Audit trail
    await INSERT.into(AuditLog).entries({
      document_ID: doc.ID,
      entityType: 'DOCUMENT',
      entityId: doc.ID,
      action: 'UPLOADED',
      performedBy: req.user.id,
      performedByType: 'VENDOR',
      newStatus: 'EXTRACTING'
    });

    return SELECT.one.from(Documents).where({ ID: doc.ID });
  });

  // ═══════════════════════════════════════════
  //  EXTRACTION STATUS POLLING
  // ═══════════════════════════════════════════
  this.on('getExtractionStatus', async (req) => {
    const { documentId } = req.data;
    const doc = await SELECT.one.from(Documents).where({ ID: documentId });
    if (!doc) return req.reject(404, 'Document not found');
    if (!doc.docAiJobId) return req.reject(400, 'No extraction job found for this document');

    const { getExtractionResult } = require('./lib/doc-ai');
    const result = await getExtractionResult(doc.docAiJobId);

    if (result.status === 'DONE') {
      // Persist extracted fields to document
      await UPDATE(Documents).set({
        documentNumber: result.fields.invoiceNumber,
        documentDate: result.fields.invoiceDate,
        poNumber: result.fields.poNumber,
        vendorName_ext: result.fields.senderName,
        totalAmount: result.fields.grossAmount,
        baseAmount: result.fields.netAmount,
        totalTaxAmount: result.fields.taxAmount,
        vendorGSTIN: result.fields.senderTaxId,
        buyerGSTIN: result.fields.receiverTaxId,
        docAiConfidence: result.confidence,
        extractionPayload: JSON.stringify(result.rawResponse),
        status_code: 'EXTRACTED'
      }).where({ ID: documentId });

      // Persist line items
      if (result.lineItems?.length) {
        const items = result.lineItems.map((li, idx) => ({
          document_ID: documentId,
          lineNumber: idx + 1,
          description: li.description,
          hsnSacCode: li.hsnCode,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
          amount: li.amount,
          taxRate: li.taxRate,
          taxAmount: li.taxAmount
        }));
        await INSERT.into(DocumentItems).entries(items);
      }

      // Audit
      await INSERT.into(AuditLog).entries({
        document_ID: documentId,
        entityType: 'DOCUMENT',
        entityId: documentId,
        action: 'EXTRACTED',
        performedBy: 'SYSTEM',
        performedByType: 'SYSTEM',
        oldStatus: 'EXTRACTING',
        newStatus: 'EXTRACTED'
      });
    }

    return {
      status: result.status,
      confidence: result.confidence,
      fields: result.extractedFields || []
    };
  });

  // ═══════════════════════════════════════════
  //  VALIDATE & CONFIRM (vendor reviews extracted data)
  // ═══════════════════════════════════════════
  this.on('validateAndConfirm', 'Documents', async (req) => {
    const docId = req.params[0];
    const doc = await SELECT.one.from(Documents).where({ ID: docId });
    if (!doc) return req.reject(404, 'Document not found');
    if (doc.status_code !== 'EXTRACTED') {
      return req.reject(400, 'Document must be in EXTRACTED status to validate');
    }

    await UPDATE(Documents).set({ status_code: 'VALIDATED' }).where({ ID: docId });

    await INSERT.into(AuditLog).entries({
      document_ID: docId,
      entityType: 'DOCUMENT',
      entityId: docId,
      action: 'VALIDATED',
      performedBy: req.user.id,
      performedByType: 'VENDOR',
      oldStatus: 'EXTRACTED',
      newStatus: 'VALIDATED'
    });

    return SELECT.one.from(Documents).where({ ID: docId });
  });

  // ═══════════════════════════════════════════
  //  SUBMIT FOR APPROVAL
  // ═══════════════════════════════════════════
  this.on('submitForApproval', 'Documents', async (req) => {
    const docId = req.params[0];
    const doc = await SELECT.one.from(Documents).where({ ID: docId });
    if (!doc) return req.reject(404, 'Document not found');
    if (!['EXTRACTED', 'VALIDATED'].includes(doc.status_code)) {
      return req.reject(400, 'Document must be in EXTRACTED or VALIDATED status');
    }

    // Trigger division-specific workflow
    try {
      const { triggerWorkflow } = require('./lib/workflow');
      const wfId = await triggerWorkflow({
        type: doc.documentType_code,
        document: doc
      });

      await UPDATE(Documents).set({
        status_code: 'SUBMITTED',
        workflowInstanceId: wfId
      }).where({ ID: docId });

      LOG.info(`Workflow triggered: ${wfId} for doc ${docId}`);
    } catch (err) {
      LOG.error('Workflow trigger failed:', err.message);
      return req.reject(500, `Failed to trigger approval workflow: ${err.message}`);
    }

    await INSERT.into(AuditLog).entries({
      document_ID: docId,
      entityType: 'DOCUMENT',
      entityId: docId,
      action: 'SUBMITTED',
      performedBy: req.user.id,
      performedByType: 'VENDOR',
      oldStatus: doc.status_code,
      newStatus: 'SUBMITTED'
    });

    return SELECT.one.from(Documents).where({ ID: docId });
  });

  // ═══════════════════════════════════════════
  //  WITHDRAW SUBMITTED DOCUMENT
  // ═══════════════════════════════════════════
  this.on('withdraw', 'Documents', async (req) => {
    const docId = req.params[0];
    const doc = await SELECT.one.from(Documents).where({ ID: docId });
    if (!doc) return req.reject(404, 'Document not found');
    if (doc.status_code !== 'SUBMITTED') {
      return req.reject(400, 'Only SUBMITTED documents can be withdrawn');
    }

    await UPDATE(Documents).set({
      status_code: 'DRAFT',
      workflowInstanceId: null
    }).where({ ID: docId });

    await INSERT.into(AuditLog).entries({
      document_ID: docId,
      entityType: 'DOCUMENT',
      entityId: docId,
      action: 'WITHDRAWN',
      performedBy: req.user.id,
      performedByType: 'VENDOR',
      oldStatus: 'SUBMITTED',
      newStatus: 'DRAFT'
    });

    return SELECT.one.from(Documents).where({ ID: docId });
  });

  // ═══════════════════════════════════════════
  //  M3: ASN — CREATE & DISPATCH
  // ═══════════════════════════════════════════
  this.before('CREATE', 'ShippingNotifications', async (req) => {
    // Auto-generate ASN number
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = await SELECT.one.from(ShippingNotifications)
      .columns('count(*) as cnt')
      .where('asnNumber like', `ASN-${today}%`);
    const seq = String((count?.cnt || 0) + 1).padStart(4, '0');
    req.data.asnNumber = `ASN-${today}-${seq}`;
    req.data.vendor_ID = req.user.attr?.vendorId;
  });

  this.after('CREATE', 'ShippingNotifications', async (data, req) => {
    // Notify ITC users
    try {
      const { sendNotification } = require('./lib/notifications');
      await sendNotification({
        type: 'ASN_CREATED',
        divisionId: data.division_ID,
        message: `New ASN ${data.asnNumber} created for PO ${data.poNumber}`,
        vendorId: req.user.attr?.vendorId
      });
    } catch (err) {
      LOG.warn('ASN notification failed:', err.message);
    }

    await INSERT.into(AuditLog).entries({
      asn_ID: data.ID,
      entityType: 'ASN',
      entityId: data.ID,
      action: 'CREATED',
      performedBy: req.user.id,
      performedByType: 'VENDOR',
      newStatus: 'CREATED'
    });
  });

  this.on('dispatchShipment', 'ShippingNotifications', async (req) => {
    const asnId = req.params[0];
    await UPDATE(ShippingNotifications).set({
      status: 'DISPATCHED'
    }).where({ ID: asnId });

    try {
      const { sendNotification } = require('./lib/notifications');
      const asn = await SELECT.one.from(ShippingNotifications).where({ ID: asnId });
      await sendNotification({
        type: 'ASN_DISPATCHED',
        divisionId: asn.division_ID,
        message: `ASN ${asn.asnNumber} dispatched. Vehicle: ${asn.vehicleNumber}, LR: ${asn.lrNumber}`,
        vendorId: req.user.attr?.vendorId
      });
    } catch (err) {
      LOG.warn('Dispatch notification failed:', err.message);
    }

    return SELECT.one.from(ShippingNotifications).where({ ID: asnId });
  });

  // ═══════════════════════════════════════════
  //  SAP DATA FETCH (PO, GRN, PAYMENTS)
  // ═══════════════════════════════════════════
  this.on('getMyPurchaseOrders', async (req) => {
    const { divisionId } = req.data;
    const vendorId = req.user.attr?.vendorId;
    const { fetchPurchaseOrders } = require('./lib/sap-po-fetch');
    return fetchPurchaseOrders(divisionId, vendorId);
  });

  this.on('getGRNStatus', async (req) => {
    const { divisionId, poNumber } = req.data;
    const { fetchGRNStatus } = require('./lib/sap-po-fetch');
    return fetchGRNStatus(divisionId, poNumber);
  });

  this.on('getPaymentSummary', async (req) => {
    const { divisionId } = req.data;
    const vendorId = req.user.attr?.vendorId;
    const { fetchPaymentSummary } = require('./lib/sap-payment-status');
    return fetchPaymentSummary(divisionId, vendorId);
  });

  // ═══════════════════════════════════════════
  //  M4: QUERIES — auto-generate query number
  // ═══════════════════════════════════════════
  this.before('CREATE', 'VendorQueries', async (req) => {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = await SELECT.one.from(VendorQueries)
      .columns('count(*) as cnt')
      .where('queryNumber like', `QRY-${today}%`);
    const seq = String((count?.cnt || 0) + 1).padStart(4, '0');
    req.data.queryNumber = `QRY-${today}-${seq}`;
    req.data.vendor_ID = req.user.attr?.vendorId;
  });
});
