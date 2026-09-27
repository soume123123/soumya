const cds = require('@sap/cds');
const LOG = cds.log('integration-service');

module.exports = cds.service.impl(async function () {

  // ═══════════════════════════════════════════
  //  WORKFLOW CALLBACK (from BPA)
  // ═══════════════════════════════════════════
  this.on('workflowCallback', async (req) => {
    const { workflowInstanceId, decision, comment, approverEmail } = req.data;
    LOG.info(`Workflow callback: ${workflowInstanceId} -> ${decision} by ${approverEmail}`);

    const { handleWorkflowCallback } = require('./lib/workflow');
    const result = await handleWorkflowCallback(
      workflowInstanceId, decision, comment, approverEmail
    );

    // If approved, auto-trigger SAP posting
    if (decision === 'approve') {
      try {
        const { Documents } = cds.entities('itc.vendor.portal');
        const doc = await SELECT.one.from(Documents).where({ ID: result.documentId });

        if (doc && doc.status_code === 'APPROVED') {
          const { postDocumentToSAP } = require('./lib/sap-invoice-posting');
          LOG.info(`Auto-posting approved document ${doc.ID} to SAP`);

          await UPDATE(Documents).set({ status_code: 'POSTING' }).where({ ID: doc.ID });

          try {
            const postResult = await postDocumentToSAP(doc);
            await UPDATE(Documents).set({
              sapDocNumber: postResult.sapDocNumber,
              sapFiscalYear: postResult.sapFiscalYear,
              sapPostingDate: postResult.postingDate,
              sapPostingStatus: 'POSTED',
              status_code: 'POSTED'
            }).where({ ID: doc.ID });

            const { AuditLog } = cds.entities('itc.vendor.portal');
            await INSERT.into(AuditLog).entries({
              document_ID: doc.ID,
              entityType: 'DOCUMENT',
              entityId: doc.ID,
              action: 'POSTED',
              performedBy: 'SYSTEM',
              performedByType: 'SYSTEM',
              comment: `Auto-posted: SAP Doc ${postResult.sapDocNumber}/${postResult.sapFiscalYear}`,
              oldStatus: 'APPROVED',
              newStatus: 'POSTED'
            });

            LOG.info(`Document ${doc.ID} auto-posted: ${postResult.sapDocNumber}`);
          } catch (postErr) {
            LOG.error('Auto-posting failed:', postErr.message);
            await UPDATE(Documents).set({
              status_code: 'POST_ERROR',
              sapPostingStatus: 'ERROR',
              sapPostingMessage: postErr.message
            }).where({ ID: doc.ID });
          }
        }
      } catch (err) {
        LOG.error('Auto-posting process error:', err.message);
      }
    }

    // Send notification to vendor about decision
    try {
      const { sendNotification } = require('./lib/notifications');
      const { Documents, Vendors } = cds.entities('itc.vendor.portal');
      const doc = await SELECT.one.from(Documents).where({ ID: result.documentId });
      if (doc) {
        const vendor = await SELECT.one.from(Vendors).where({ ID: doc.vendor_ID });
        if (vendor?.email) {
          await sendNotification({
            type: decision === 'approve' ? 'DOCUMENT_APPROVED' : 'DOCUMENT_REJECTED',
            divisionId: doc.division_ID,
            message: `Your ${doc.documentType_code} ${doc.documentNumber} has been ${decision}d. ${comment || ''}`,
            recipientEmail: vendor.email
          });
        }
      }
    } catch (notifErr) {
      LOG.warn('Vendor notification failed:', notifErr.message);
    }

    return result;
  });

  // ═══════════════════════════════════════════
  //  PAYMENT WORKFLOW CALLBACK
  // ═══════════════════════════════════════════
  this.on('paymentWorkflowCallback', async (req) => {
    const { workflowInstanceId, decision, comment, approverEmail } = req.data;
    LOG.info(`Payment workflow callback: ${workflowInstanceId} -> ${decision}`);

    const { PaymentApprovals, AuditLog } = cds.entities('itc.vendor.portal');

    const approval = await SELECT.one.from(PaymentApprovals)
      .where({ workflowInstanceId });

    if (!approval) {
      return req.reject(404, `No payment approval found for workflow ${workflowInstanceId}`);
    }

    const newStatus = decision === 'approve' ? 'APPROVED' : 'REJECTED';

    await UPDATE(PaymentApprovals).set({
      status: newStatus,
      approver: approverEmail,
      approvalDate: new Date().toISOString(),
      comment
    }).where({ ID: approval.ID });

    return { approvalId: approval.ID, newStatus };
  });

  // ═══════════════════════════════════════════
  //  SYNC PAYMENT DATA FROM SAP
  // ═══════════════════════════════════════════
  this.on('syncPaymentData', async (req) => {
    const { divisionId, vendorId } = req.data;
    LOG.info(`Syncing payment data for vendor ${vendorId} in division ${divisionId}`);

    const { fetchPaymentSummary } = require('./lib/sap-payment-status');
    await fetchPaymentSummary(divisionId, vendorId);

    const { PaymentItems } = cds.entities('itc.vendor.portal');
    const count = await SELECT.one.from(PaymentItems)
      .columns('count(*) as cnt')
      .where({ vendor_ID: vendorId, division_ID: divisionId });

    return { itemsSynced: count?.cnt || 0 };
  });

  // ═══════════════════════════════════════════
  //  TEST DIVISION CONNECTIVITY
  // ═══════════════════════════════════════════
  this.on('testDivisionConnectivity', async (req) => {
    const { divisionId } = req.data;
    const { SAPSystemConfigs, ODataServiceRegistry } = cds.entities('itc.vendor.portal');

    const config = await SELECT.one.from(SAPSystemConfigs)
      .where({ division_ID: divisionId, active: true });

    if (!config) {
      return { systemId: 'N/A', status: 'ERROR', message: 'No SAP system configured', services: [] };
    }

    // Test base connectivity
    const { testSAPConnection } = require('./lib/sap-adapter-factory');
    const baseResult = await testSAPConnection(config);

    // Test each registered service
    const services = await SELECT.from(ODataServiceRegistry)
      .where({ sapSystem_ID: config.ID, active: true });

    const serviceResults = [];
    for (const svc of services) {
      try {
        const { getAdapter } = require('./lib/sap-adapter-factory');
        const adapter = await getAdapter(divisionId, svc.operationType);
        await adapter.get('$metadata');
        serviceResults.push({ operationType: svc.operationType, status: 'OK' });
      } catch (err) {
        serviceResults.push({ operationType: svc.operationType, status: `FAILED: ${err.message}` });
      }
    }

    return {
      systemId: config.systemId,
      status: baseResult.success ? 'OK' : 'FAILED',
      message: baseResult.message,
      services: serviceResults
    };
  });
});
