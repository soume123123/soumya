using { itc.vendor.portal as db } from '../db/schema';
using from '../app/services';

/**
 * Vendor-facing service — external vendors access their own data only.
 * Row-level security enforced via vendor_ID from JWT claims.
 */
service VendorService @(path: '/api/vendor') @(requires: 'vendor') {

  // ── Master Data (read-only) ──
  @readonly entity MyProfile        as projection on db.Vendors;
  @readonly entity MyDivisions      as projection on db.VendorDivisionMappings;
  @readonly entity Divisions        as projection on db.Divisions
    excluding { sapConfig, approvers };
  @readonly entity DocumentTypes    as projection on db.DocumentTypes;
  @readonly entity DocumentStatuses as projection on db.DocumentStatuses;

  // ── M1/M2: Invoice, CN, DN Management ──
  entity Documents as projection on db.Documents
    actions {
      action uploadAndExtract(
        file         : LargeBinary,
        fileName     : String,
        mediaType    : String,
        divisionId   : UUID,
        documentType : String
      ) returns Documents;

      action validateAndConfirm() returns Documents;
      action submitForApproval()  returns Documents;
      action withdraw()           returns Documents;
    };

  entity DocumentItems              as projection on db.DocumentItems;
  @readonly entity DocumentAttachments as projection on db.DocumentAttachments;
  @readonly entity ThreeWayMatchResults as projection on db.ThreeWayMatchResults;

  function getExtractionStatus(documentId : UUID) returns {
    status     : String;
    confidence : Decimal;
    fields     : many {
      name       : String;
      value      : String;
      confidence : Decimal;
    };
  };

  // ── PO & GRN from SAP ──
  function getMyPurchaseOrders(divisionId : UUID) returns many {
    poNumber : String; poDate : Date; vendor : String;
    totalValue : Decimal; currency : String; status : String;
    items : many {
      itemNumber : String; material : String; description : String;
      quantity : Decimal; uom : String; unitPrice : Decimal;
      deliveryDate : Date; grnQuantity : Decimal; grnStatus : String;
    };
  };

  function getGRNStatus(divisionId : UUID, poNumber : String) returns many {
    grnDocNumber : String; grnDate : Date; poItem : String;
    material : String; quantity : Decimal; uom : String;
    plant : String; movementType : String;
  };

  // ── M3: ASN ──
  entity ShippingNotifications as projection on db.ShippingNotifications
    actions {
      action dispatchShipment() returns ShippingNotifications;
      action cancel()   returns ShippingNotifications;
    };
  entity ASNItems as projection on db.ASNItems;

  // ── M4: Queries & Announcements ──
  entity VendorQueries  as projection on db.VendorQueries;
  entity QueryMessages  as projection on db.QueryMessages;
  @readonly entity QueryAttachments as projection on db.QueryAttachments;
  @readonly entity Announcements    as projection on db.Announcements;
  @readonly entity AnnouncementReadReceipts as projection on db.AnnouncementReadReceipts;

  // ── M6: Payment Status ──
  @readonly entity PaymentItems as projection on db.PaymentItems;

  function getPaymentSummary(divisionId : UUID) returns {
    totalOutstanding : Decimal;
    totalOverdue     : Decimal;
    currentDue       : Decimal;
    ageing           : many {
      bucket : String;
      amount : Decimal;
      count  : Integer;
    };
  };

  // ── M9: GST & Cash Discount ──
  @readonly entity GSTInvoiceDetails as projection on db.GSTInvoiceDetails;
  @readonly entity CashDiscounts     as projection on db.CashDiscounts;

  // ── Audit ──
  @readonly entity AuditLog as projection on db.AuditLog excluding { paymentRun };
}

/**
 * Public service for vendor self-registration (no auth required)
 */
service RegistrationService @(path: '/api/register') {
  entity VendorRegistrations as projection on db.VendorRegistrations
    excluding { createdVendor, reviewedBy, reviewComment, reviewedAt };

  @readonly entity Divisions as projection on db.Divisions {
    ID, divisionCode, divisionName
  };
}
