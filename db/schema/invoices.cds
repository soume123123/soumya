namespace itc.vendor.portal;

using { cuid, managed, Currency } from '@sap/cds/common';
using { itc.vendor.portal.Vendors, itc.vendor.portal.Divisions } from './master-data';

// ═══════════════════════════════════════════
//  DOCUMENT HEADER (Invoice / CN / DN)
// ═══════════════════════════════════════════
entity Documents : cuid, managed {
  vendor            : Association to Vendors;
  division          : Association to Divisions;
  documentType      : Association to DocumentTypes;

  // Extracted / Entered Fields
  documentNumber    : String(50);
  documentDate      : Date;
  dueDate           : Date;
  poNumber          : String(20);
  poDate            : Date;
  referenceDocument : String(50);       // For CN/DN: original invoice ref
  vendorName_ext    : String(200);      // As extracted from document
  buyerName         : String(200);

  // Financial
  currency          : Currency default 'INR';
  baseAmount        : Decimal(15,2);
  cgstAmount        : Decimal(15,2);
  sgstAmount        : Decimal(15,2);
  igstAmount        : Decimal(15,2);
  cessAmount        : Decimal(15,2);
  tcsAmount         : Decimal(15,2);
  totalTaxAmount    : Decimal(15,2);
  totalAmount       : Decimal(15,2);
  withholdingTax    : Decimal(15,2);
  netPayable        : Decimal(15,2);

  // GST Details
  vendorGSTIN       : String(15);
  buyerGSTIN        : String(15);
  placeOfSupply     : String(100);
  supplyType        : String(20);       // INTRA_STATE, INTER_STATE
  reverseCharge     : Boolean default false;
  eWayBillNumber    : String(20);
  eWayBillDate      : Date;
  irnNumber         : String(64);
  irnDate           : Date;

  // Cash Discount
  cashDiscountTerms : String(4);
  cashDiscountPct1  : Decimal(5,2);
  cashDiscountDays1 : Integer;
  cashDiscountPct2  : Decimal(5,2);
  cashDiscountDays2 : Integer;
  cashDiscountAmt   : Decimal(15,2);
  cashDiscountDate  : Date;

  // Document AI Processing
  status            : Association to DocumentStatuses;
  uploadedFile      : LargeBinary @Core.MediaType: uploadedMediaType;
  uploadedMediaType : String(100);
  fileName          : String(500);
  fileSize          : Integer;
  docAiJobId        : String(100);
  docAiConfidence   : Decimal(5,2);
  extractionPayload : LargeString;

  // SAP Posting
  sapDocNumber      : String(10);
  sapFiscalYear     : String(4);
  sapPostingDate    : Date;
  sapPostingStatus  : String(20);       // PENDING, POSTED, ERROR, REVERSED
  sapPostingMessage : String(1000);

  // Workflow
  workflowInstanceId   : String(100);
  currentApprover      : String(200);
  approvalLevel        : Integer default 0;
  approvalComment      : String(1000);

  // Three-Way Match
  poMatchStatus     : String(20);
  grnMatchStatus    : String(20);
  priceMatchStatus  : String(20);

  // Compositions
  items             : Composition of many DocumentItems
                        on items.document = $self;
  attachments       : Composition of many DocumentAttachments
                        on attachments.document = $self;
  matchResults      : Composition of many ThreeWayMatchResults
                        on matchResults.document = $self;
}

// ═══════════════════════════════════════════
//  DOCUMENT LINE ITEMS
// ═══════════════════════════════════════════
entity DocumentItems : cuid {
  document          : Association to Documents;
  lineNumber        : Integer;
  materialNumber    : String(40);
  description       : String(500);
  hsnSacCode        : String(8);
  quantity          : Decimal(13,3);
  uom               : String(3);
  unitPrice         : Decimal(15,2);
  amount            : Decimal(15,2);
  taxRate           : Decimal(5,2);
  cgst              : Decimal(15,2);
  sgst              : Decimal(15,2);
  igst              : Decimal(15,2);
  taxAmount         : Decimal(15,2);
  totalAmount       : Decimal(15,2);
  poItemNumber      : String(6);
  grnDocNumber      : String(10);
  grnItemNumber     : String(4);
  grnQuantity       : Decimal(13,3);
  plantCode         : String(4);
}

// ═══════════════════════════════════════════
//  DOCUMENT ATTACHMENTS
// ═══════════════════════════════════════════
entity DocumentAttachments : cuid, managed {
  document          : Association to Documents;
  file              : LargeBinary @Core.MediaType: mediaType;
  mediaType         : String(100);
  fileName          : String(500);
  fileSize          : Integer;
  attachmentType    : String(50);
}

// ═══════════════════════════════════════════
//  THREE-WAY MATCH
// ═══════════════════════════════════════════
entity ThreeWayMatchResults : cuid {
  document          : Association to Documents;
  lineNumber        : Integer;
  poQuantity        : Decimal(13,3);
  grnQuantity       : Decimal(13,3);
  invoiceQuantity   : Decimal(13,3);
  poUnitPrice       : Decimal(15,2);
  invoiceUnitPrice  : Decimal(15,2);
  quantityVariance  : Decimal(13,3);
  priceVariance     : Decimal(15,2);
  matchStatus       : String(20);
  tolerancePassed   : Boolean;
}

// ═══════════════════════════════════════════
//  CODE LISTS
// ═══════════════════════════════════════════
entity DocumentTypes {
  key code          : String(20);
  description       : String(100);
  sapDocType        : String(2);
}

entity DocumentStatuses {
  key code          : String(20);
  description       : String(100);
  criticality       : Integer;
}
