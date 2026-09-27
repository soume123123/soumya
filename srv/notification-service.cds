using { itc.vendor.portal as db } from '../db/schema';

/**
 * Integration service for workflow callbacks and SAP system webhooks.
 * No auth required for callbacks (authenticated via API key/token in headers).
 */
service IntegrationService @(path: '/api/integration') {

  // Workflow callback from BPA
  action workflowCallback(
    workflowInstanceId : String,
    decision           : String,  // 'approve' or 'reject'
    comment            : String,
    approverEmail      : String
  ) returns { documentId : UUID; newStatus : String; };

  // Payment workflow callback
  action paymentWorkflowCallback(
    workflowInstanceId : String,
    decision           : String,
    comment            : String,
    approverEmail      : String
  ) returns { approvalId : UUID; newStatus : String; };

  // Sync payment data from SAP (can be triggered by scheduled job)
  action syncPaymentData(
    divisionId : UUID,
    vendorId   : UUID
  ) returns { itemsSynced : Integer; };

  // Test SAP connectivity
  function testDivisionConnectivity(divisionId : UUID) returns {
    systemId   : String;
    status     : String;
    message    : String;
    services   : many { operationType : String; status : String; };
  };
}
