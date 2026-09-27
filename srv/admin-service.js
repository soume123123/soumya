const cds = require('@sap/cds');
const LOG = cds.log('admin-service');

module.exports = cds.service.impl(async function () {

  const {
    Documents, DocumentItems, Vendors, VendorDivisionMappings,
    VendorRegistrations, VendorGSTRegistrations,
    SAPSystemConfigs, ODataServiceRegistry,
    PaymentApprovals, PaymentRuns, PaymentRunVendors,
    VendorQueries, QueryMessages, Announcements,
    GSTInvoiceDetails, CashDiscounts, AuditLog
  } = this.entities;

  // ═══════════════════════════════════════════
  //  VENDOR REGISTRATION APPROVAL
  // ═══════════════════════════════════════════
  this.on('approveRegistration', 'VendorRegistrations', async (req) => {
    const regId = req.params[0];
    const { sapVendorCodes, comment } = req.data;
    const reg = await SELECT.one.from(VendorRegistrations).where({ ID: regId });
    if (!reg) return req.reject(404, 'Registration not found');
    if (reg.status !== 'PENDING') return req.reject(400, 'Registration already processed');

    // Create vendor record
    const vendor = await INSERT.into(Vendors).entries({
      panNumber: reg.panNumber,
      vendorName: reg.vendorName,
      email: reg.email,
      phone: reg.phone,
      address: reg.address,
      city: reg.city,
      state: reg.state,
      pincode: reg.pincode,
      bankAccountNo: reg.bankAccountNo,
      bankIFSC: reg.bankIFSC,
      bankName: reg.bankName,
      status: 'ACTIVE'
    });

    // Create GST registration if provided
    if (reg.gstin) {
      await INSERT.into(VendorGSTRegistrations).entries({
        vendor_ID: vendor.ID,
        gstin: reg.gstin,
        isPrimary: true
      });
    }

    // Create division mappings with SAP vendor codes
    const vendorCodes = JSON.parse(sapVendorCodes || '{}');
    const divisionCodes = (reg.requestedDivisions || '').split(',').map(s => s.trim());
    for (const divCode of divisionCodes) {
      if (!divCode) continue;
      const div = await SELECT.one.from('itc.vendor.portal.Divisions')
        .where({ divisionCode: divCode });
      if (div) {
        await INSERT.into(VendorDivisionMappings).entries({
          vendor_ID: vendor.ID,
          division_ID: div.ID,
          sapVendorCode: vendorCodes[div.ID] || vendorCodes[divCode] || '',
          active: true
        });
      }
    }

    // Update registration
    await UPDATE(VendorRegistrations).set({
      status: 'APPROVED',
      reviewedBy: req.user.id,
      reviewComment: comment,
      reviewedAt: new Date().toISOString(),
      createdVendor_ID: vendor.ID
    }).where({ ID: regId });

    LOG.info(`Vendor registration approved: ${regId} -> vendor ${vendor.ID}`);

    return SELECT.one.from(VendorRegistrations).where({ ID: regId });
  });

  this.on('rejectRegistration', 'VendorRegistrations', async (req) => {
    const regId = req.params[0];
    const { comment } = req.data;
    await UPDATE(VendorRegistrations).set({
      status: 'REJECTED',
      reviewedBy: req.user.id,
      reviewComment: comment,
      reviewedAt: new Date().toISOString()
    }).where({ ID: regId });
    return SELECT.one.from(VendorRegistrations).where({ ID: regId });
  });

  // ═══════════════════════════════════════════
  //  DOCUMENT APPROVAL (M1/M2)
  // ═══════════════════════════════════════════
  this.on('approve', 'Documents', async (req) => {
    const docId = req.params[0];
    const { comment } = req.data;
    const doc = await SELECT.one.from(Documents).where({ ID: docId });
    if (!doc) return req.reject(404, 'Document not found');
    if (!['SUBMITTED', 'L1_APPROVED'].includes(doc.status_code)) {
      return req.reject(400, 'Document is not pending approval');
    }

    const newLevel = (doc.approvalLevel || 0) + 1;
    let newStatus;

    // Check if more approval levels needed
    const { DivisionApprovers } = this.entities;
    const nextApprover = await SELECT.one.from(DivisionApprovers).where({
      division_ID: doc.division_ID,
      documentTypes: { like: `%${doc.documentType_code}%` },
      active: true
    }).and(`amountThreshold >= ${doc.totalAmount || 0}`)
     .orderBy('amountThreshold asc');

    if (newLevel >= 2 || !nextApprover) {
      newStatus = 'APPROVED';
    } else {
      newStatus = `L${newLevel}_APPROVED`;
    }

    await UPDATE(Documents).set({
      status_code: newStatus,
      approvalLevel: newLevel,
      currentApprover: req.user.id,
      approvalComment: comment
    }).where({ ID: docId });

    await INSERT.into(AuditLog).entries({
      document_ID: docId,
      entityType: 'DOCUMENT',
      entityId: docId,
      action: newStatus,
      performedBy: req.user.id,
      performedByType: 'ITC',
      comment: comment,
      oldStatus: doc.status_code,
      newStatus: newStatus
    });

    LOG.info(`Document ${docId} approved to level ${newLevel}: ${newStatus}`);

    return SELECT.one.from(Documents).where({ ID: docId });
  });

  this.on('rejectDocument', 'Documents', async (req) => {
    const docId = req.params[0];
    const { comment } = req.data;
    const doc = await SELECT.one.from(Documents).where({ ID: docId });
    if (!doc) return req.reject(404, 'Document not found');

    await UPDATE(Documents).set({
      status_code: 'REJECTED',
      approvalComment: comment,
      currentApprover: req.user.id
    }).where({ ID: docId });

    await INSERT.into(AuditLog).entries({
      document_ID: docId,
      entityType: 'DOCUMENT',
      entityId: docId,
      action: 'REJECTED',
      performedBy: req.user.id,
      performedByType: 'ITC',
      comment: comment,
      oldStatus: doc.status_code,
      newStatus: 'REJECTED'
    });

    return SELECT.one.from(Documents).where({ ID: docId });
  });

  // ═══════════════════════════════════════════
  //  SAP POSTING (M5)
  // ═══════════════════════════════════════════
  this.on('postToSAP', 'Documents', async (req) => {
    const docId = req.params[0];
    const doc = await SELECT.one.from(Documents).where({ ID: docId });
    if (!doc) return req.reject(404, 'Document not found');
    if (doc.status_code !== 'APPROVED') {
      return req.reject(400, 'Only APPROVED documents can be posted to SAP');
    }

    await UPDATE(Documents).set({ status_code: 'POSTING' }).where({ ID: docId });

    try {
      const { postDocumentToSAP } = require('./lib/sap-invoice-posting');
      const result = await postDocumentToSAP(doc);

      await UPDATE(Documents).set({
        sapDocNumber: result.sapDocNumber,
        sapFiscalYear: result.sapFiscalYear,
        sapPostingDate: result.postingDate,
        sapPostingStatus: 'POSTED',
        status_code: 'POSTED'
      }).where({ ID: docId });

      await INSERT.into(AuditLog).entries({
        document_ID: docId,
        entityType: 'DOCUMENT',
        entityId: docId,
        action: 'POSTED',
        performedBy: req.user.id,
        performedByType: 'ITC',
        comment: `SAP Doc: ${result.sapDocNumber}/${result.sapFiscalYear}`,
        oldStatus: 'APPROVED',
        newStatus: 'POSTED'
      });

      LOG.info(`Document ${docId} posted to SAP: ${result.sapDocNumber}`);
    } catch (err) {
      LOG.error('SAP posting failed:', err.message);
      await UPDATE(Documents).set({
        status_code: 'POST_ERROR',
        sapPostingStatus: 'ERROR',
        sapPostingMessage: err.message
      }).where({ ID: docId });

      await INSERT.into(AuditLog).entries({
        document_ID: docId,
        entityType: 'DOCUMENT',
        entityId: docId,
        action: 'POST_ERROR',
        performedBy: 'SYSTEM',
        performedByType: 'SYSTEM',
        comment: err.message,
        oldStatus: 'POSTING',
        newStatus: 'POST_ERROR'
      });

      return req.reject(500, `SAP posting failed: ${err.message}`);
    }

    return SELECT.one.from(Documents).where({ ID: docId });
  });

  this.on('retryPosting', 'Documents', async (req) => {
    const docId = req.params[0];
    const doc = await SELECT.one.from(Documents).where({ ID: docId });
    if (doc?.status_code !== 'POST_ERROR') {
      return req.reject(400, 'Only POST_ERROR documents can be retried');
    }
    // Reset to APPROVED and re-trigger
    await UPDATE(Documents).set({
      status_code: 'APPROVED',
      sapPostingStatus: 'PENDING',
      sapPostingMessage: null
    }).where({ ID: docId });
    // Delegate to postToSAP
    return this.emit('postToSAP', req);
  });

  // ═══════════════════════════════════════════
  //  SAP SYSTEM CONNECTION TEST
  // ═══════════════════════════════════════════
  this.on('testConnection', 'SAPSystemConfigs', async (req) => {
    const configId = req.params[0];
    const config = await SELECT.one.from(SAPSystemConfigs).where({ ID: configId });
    if (!config) return req.reject(404, 'Config not found');

    try {
      const { testSAPConnection } = require('./lib/sap-adapter-factory');
      const result = await testSAPConnection(config);

      await UPDATE(SAPSystemConfigs).set({
        lastTestedAt: new Date().toISOString(),
        lastTestResult: result.success ? 'OK' : 'FAILED',
        lastTestMessage: result.message
      }).where({ ID: configId });

      return { status: result.success ? 'OK' : 'FAILED', message: result.message };
    } catch (err) {
      await UPDATE(SAPSystemConfigs).set({
        lastTestedAt: new Date().toISOString(),
        lastTestResult: 'FAILED',
        lastTestMessage: err.message
      }).where({ ID: configId });
      return { status: 'FAILED', message: err.message };
    }
  });

  // ═══════════════════════════════════════════
  //  PAYMENT APPROVAL (M7)
  // ═══════════════════════════════════════════
  this.on('approvePayment', 'PaymentApprovals', async (req) => {
    const approvalId = req.params[0];
    const { comment } = req.data;
    await UPDATE(PaymentApprovals).set({
      status: 'APPROVED',
      approver: req.user.id,
      approvalDate: new Date().toISOString(),
      comment: comment
    }).where({ ID: approvalId });
    return SELECT.one.from(PaymentApprovals).where({ ID: approvalId });
  });

  this.on('rejectPayment', 'PaymentApprovals', async (req) => {
    const approvalId = req.params[0];
    const { comment } = req.data;
    await UPDATE(PaymentApprovals).set({
      status: 'REJECTED',
      approver: req.user.id,
      approvalDate: new Date().toISOString(),
      comment: comment
    }).where({ ID: approvalId });
    return SELECT.one.from(PaymentApprovals).where({ ID: approvalId });
  });

  this.on('flagException', 'PaymentApprovals', async (req) => {
    const approvalId = req.params[0];
    const { reason } = req.data;
    await UPDATE(PaymentApprovals).set({
      status: 'EXCEPTION',
      exceptionReason: reason
    }).where({ ID: approvalId });
    return SELECT.one.from(PaymentApprovals).where({ ID: approvalId });
  });

  // ═══════════════════════════════════════════
  //  PAYMENT RUN (M8)
  // ═══════════════════════════════════════════
  this.on('approveRun', 'PaymentRuns', async (req) => {
    const runId = req.params[0];
    await UPDATE(PaymentRuns).set({
      status: 'APPROVED',
      approvedBy: req.user.id
    }).where({ ID: runId });
    return SELECT.one.from(PaymentRuns).where({ ID: runId });
  });

  this.on('executeRun', 'PaymentRuns', async (req) => {
    const runId = req.params[0];
    const run = await SELECT.one.from(PaymentRuns).where({ ID: runId });
    if (!run) return req.reject(404, 'Payment run not found');
    if (run.status !== 'APPROVED') {
      return req.reject(400, 'Payment run must be APPROVED before execution');
    }

    await UPDATE(PaymentRuns).set({ status: 'EXECUTING' }).where({ ID: runId });

    try {
      const { triggerPaymentRun } = require('./lib/sap-payment-run');
      const result = await triggerPaymentRun(run);

      await UPDATE(PaymentRuns).set({
        status: 'COMPLETED',
        sapF110RunId: result.f110RunId,
        sapF110Date: result.f110Date,
        completedAt: new Date().toISOString()
      }).where({ ID: runId });

      LOG.info(`Payment run ${runId} completed: F110 ${result.f110RunId}`);
    } catch (err) {
      LOG.error('Payment run failed:', err.message);
      await UPDATE(PaymentRuns).set({
        status: 'FAILED',
        errorMessage: err.message
      }).where({ ID: runId });
      return req.reject(500, `Payment run failed: ${err.message}`);
    }

    return SELECT.one.from(PaymentRuns).where({ ID: runId });
  });
});
