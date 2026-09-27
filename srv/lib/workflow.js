/**
 * SAP Build Process Automation (BPA) Workflow Integration
 * Triggers division-specific approval workflows for documents and payments.
 */
const cds = require('@sap/cds');
const LOG = cds.log('workflow');

/**
 * Trigger an approval workflow for a document.
 * @param {object} params - { type, document }
 * @returns {string} Workflow instance ID
 */
async function triggerWorkflow({ type, document }) {
  const { DivisionApprovers, Divisions } = cds.entities('itc.vendor.portal');

  // Get division details
  const division = await SELECT.one.from(Divisions)
    .where({ ID: document.division_ID });

  // Get approvers for this division + document type
  const approvers = await SELECT.from(DivisionApprovers)
    .where({
      division_ID: document.division_ID,
      active: true
    })
    .orderBy('amountThreshold asc');

  // Filter approvers by document type
  const relevantApprovers = approvers.filter(a =>
    !a.documentTypes || a.documentTypes.includes(type)
  );

  // Determine workflow definition based on document type
  const workflowDefinitions = {
    'INVOICE': 'itc_invoice_approval',
    'CREDIT_NOTE': 'itc_cn_dn_approval',
    'DEBIT_NOTE': 'itc_cn_dn_approval'
  };

  const definitionId = workflowDefinitions[type] || 'itc_invoice_approval';

  // Build workflow context
  const context = {
    documentId: document.ID,
    documentNumber: document.documentNumber,
    documentType: type,
    vendorName: document.vendorName_ext,
    divisionId: document.division_ID,
    divisionCode: division?.divisionCode,
    divisionName: division?.divisionName,
    totalAmount: document.totalAmount,
    currency: document.currency_code || 'INR',
    poNumber: document.poNumber,
    vendorGSTIN: document.vendorGSTIN,
    submittedBy: document.vendor_ID,
    approvers: relevantApprovers.map(a => ({
      email: a.approverEmail,
      name: a.approverName,
      role: a.approverRole,
      threshold: a.amountThreshold
    }))
  };

  LOG.info(`Triggering workflow '${definitionId}' for document ${document.ID}`);
  LOG.info(`Approvers: ${relevantApprovers.map(a => a.approverEmail).join(', ')}`);

  try {
    // Connect to BPA via destination
    const bpa = await cds.connect.to('SPA_Workflow');
    const response = await bpa.post('/workflow/rest/v1/workflow-instances', {
      definitionId,
      context
    });

    const instanceId = response?.data?.id || response?.id;
    LOG.info(`Workflow instance created: ${instanceId}`);
    return instanceId;
  } catch (err) {
    LOG.error('Workflow trigger failed:', err.message);
    // Fallback: if BPA is not configured, log and return a mock ID
    if (err.message.includes('not configured') || err.message.includes('not found')) {
      LOG.warn('BPA not configured — using mock workflow');
      return `MOCK-WF-${Date.now()}`;
    }
    throw err;
  }
}

/**
 * Handle workflow callback when an approver makes a decision.
 * Called by BPA via webhook endpoint.
 */
async function handleWorkflowCallback(workflowInstanceId, decision, comment, approverEmail) {
  const { Documents, AuditLog } = cds.entities('itc.vendor.portal');

  const doc = await SELECT.one.from(Documents)
    .where({ workflowInstanceId });

  if (!doc) {
    throw new Error(`No document found for workflow instance ${workflowInstanceId}`);
  }

  const newStatus = decision === 'approve' ? 'APPROVED' : 'REJECTED';

  await UPDATE(Documents).set({
    status_code: newStatus,
    approvalComment: comment,
    currentApprover: approverEmail
  }).where({ ID: doc.ID });

  await INSERT.into(AuditLog).entries({
    document_ID: doc.ID,
    entityType: 'DOCUMENT',
    entityId: doc.ID,
    action: newStatus,
    performedBy: approverEmail,
    performedByType: 'ITC',
    comment,
    oldStatus: doc.status_code,
    newStatus
  });

  LOG.info(`Workflow callback: doc ${doc.ID} -> ${newStatus} by ${approverEmail}`);

  return { documentId: doc.ID, newStatus };
}

/**
 * Trigger payment approval workflow.
 */
async function triggerPaymentWorkflow(paymentApproval) {
  try {
    const bpa = await cds.connect.to('SPA_Workflow');
    const response = await bpa.post('/workflow/rest/v1/workflow-instances', {
      definitionId: 'itc_payment_approval',
      context: {
        approvalId: paymentApproval.ID,
        divisionId: paymentApproval.division_ID,
        vendorName: paymentApproval.vendor?.vendorName,
        totalAmount: paymentApproval.totalAmount,
        currency: paymentApproval.currency_code || 'INR'
      }
    });
    return response?.data?.id || response?.id;
  } catch (err) {
    LOG.warn('Payment workflow trigger failed:', err.message);
    return `MOCK-PAY-WF-${Date.now()}`;
  }
}

module.exports = { triggerWorkflow, handleWorkflowCallback, triggerPaymentWorkflow };
