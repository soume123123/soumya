using { itc.vendor.portal as db } from '../db/schema';

/**
 * ITC Admin & Approver service — internal users.
 */
service AdminService @(path: '/api/admin') @(requires: ['admin', 'approver', 'finance', 'treasury']) {

  // ── Master Data Management ──
  entity Vendors                 as projection on db.Vendors;
  entity VendorGSTRegistrations  as projection on db.VendorGSTRegistrations;
  entity VendorDivisionMappings  as projection on db.VendorDivisionMappings;
  entity Divisions               as projection on db.Divisions;
  entity DivisionApprovers       as projection on db.DivisionApprovers;
  entity SAPSystemConfigs        as projection on db.SAPSystemConfigs
    actions {
      action testConnection() returns { status : String; message : String; };
    };
  entity ODataServiceRegistry    as projection on db.ODataServiceRegistry;

  // ── Vendor Registration Approval ──
  entity VendorRegistrations as projection on db.VendorRegistrations
    actions {
      action approveRegistration(
        sapVendorCodes : LargeString,  // JSON: {divisionId: vendorCode}
        comment        : String
      ) returns VendorRegistrations;
      action rejectRegistration(comment : String) returns VendorRegistrations;
    };

  // ── Document Approval (M1, M2) ──
  entity Documents as projection on db.Documents
    actions {
      action approve(comment : String) returns Documents;
      action rejectDocument(comment : String)  returns Documents;
      action postToSAP()               returns Documents;
      action retryPosting()            returns Documents;
    };

  @readonly entity DocumentItems          as projection on db.DocumentItems;
  @readonly entity DocumentAttachments    as projection on db.DocumentAttachments;
  @readonly entity ThreeWayMatchResults   as projection on db.ThreeWayMatchResults;
  @readonly entity DocumentTypes          as projection on db.DocumentTypes;
  @readonly entity DocumentStatuses       as projection on db.DocumentStatuses;

  // ── ASN Tracking ──
  @readonly entity ShippingNotifications  as projection on db.ShippingNotifications;
  @readonly entity ASNItems               as projection on db.ASNItems;

  // ── Queries & Announcements ──
  entity VendorQueries   as projection on db.VendorQueries;
  entity QueryMessages   as projection on db.QueryMessages;
  entity Announcements   as projection on db.Announcements;

  // ── Payment Approval (M7) ──
  entity PaymentApprovals as projection on db.PaymentApprovals
    actions {
      action approvePayment(comment : String)  returns PaymentApprovals;
      action rejectPayment(comment : String)   returns PaymentApprovals;
      action flagException(reason : String)    returns PaymentApprovals;
    };
  @readonly entity PaymentApprovalItems   as projection on db.PaymentApprovalItems;

  // ── Payment Run (M8) ──
  entity PaymentRuns as projection on db.PaymentRuns
    actions {
      action approveRun()   returns PaymentRuns;
      action executeRun()   returns PaymentRuns;
    };
  @readonly entity PaymentRunVendors      as projection on db.PaymentRunVendors;

  // ── Payment Status (M6) ──
  @readonly entity PaymentItems           as projection on db.PaymentItems;

  // ── GST (M9) ──
  entity GSTInvoiceDetails as projection on db.GSTInvoiceDetails;
  entity CashDiscounts     as projection on db.CashDiscounts;

  // ── Audit ──
  @readonly entity AuditLog as projection on db.AuditLog;
}
