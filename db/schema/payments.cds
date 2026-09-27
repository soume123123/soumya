namespace itc.vendor.portal;

using { cuid, managed, Currency } from '@sap/cds/common';
using { itc.vendor.portal.Vendors, itc.vendor.portal.Divisions } from './master-data';
using { itc.vendor.portal.Documents } from './invoices';

// ═══════════════════════════════════════════
//  PAYMENT TRACKING
// ═══════════════════════════════════════════
entity PaymentItems : cuid, managed {
  vendor            : Association to Vendors;
  division          : Association to Divisions;
  document          : Association to Documents;

  sapCompanyCode    : String(4);
  sapDocNumber      : String(10);
  sapFiscalYear     : String(4);
  sapLineItem       : String(3);
  documentType      : String(2);
  postingDate       : Date;
  documentDate      : Date;
  dueDate           : Date;
  baselineDate      : Date;

  currency          : Currency default 'INR';
  originalAmount    : Decimal(15,2);
  clearedAmount     : Decimal(15,2);
  openAmount        : Decimal(15,2);
  tdsAmount         : Decimal(15,2);
  cashDiscountTaken : Decimal(15,2);

  clearingDoc       : String(10);
  clearingDate      : Date;
  paymentMethod     : String(1);
  paymentRef        : String(30);
  paymentDate       : Date;
  paymentStatus     : String(20);

  daysOverdue       : Integer;
  ageingBucket      : String(20);
  lastSyncedAt      : DateTime;
}

// ═══════════════════════════════════════════
//  PAYMENT APPROVAL
// ═══════════════════════════════════════════
entity PaymentApprovals : cuid, managed {
  division          : Association to Divisions;
  paymentRunId      : String(20);
  vendor            : Association to Vendors;
  totalAmount       : Decimal(15,2);
  currency          : Currency default 'INR';
  status            : String(20) default 'PENDING';
  approver          : String(200);
  approvalDate      : DateTime;
  comment           : String(1000);
  exceptionReason   : String(500);
  workflowInstanceId : String(100);

  items             : Composition of many PaymentApprovalItems
                        on items.approval = $self;
}

entity PaymentApprovalItems : cuid {
  approval          : Association to PaymentApprovals;
  paymentItem       : Association to PaymentItems;
  includeInRun      : Boolean default true;
  exclusionReason   : String(500);
}

// ═══════════════════════════════════════════
//  PAYMENT RUN
// ═══════════════════════════════════════════
entity PaymentRuns : cuid, managed {
  division          : Association to Divisions;
  runId             : String(20);
  runDate           : Date;
  paymentMethod     : String(1);
  companyCode       : String(4);
  vendorFrom        : String(10);
  vendorTo          : String(10);
  dueDateTo         : Date;
  totalVendors      : Integer;
  totalAmount       : Decimal(15,2);
  currency          : Currency default 'INR';
  status            : String(20) default 'PROPOSED';
  sapF110RunId      : String(20);
  sapF110Date       : Date;
  initiatedBy       : String(200);
  approvedBy        : String(200);
  completedAt       : DateTime;
  errorMessage      : String(1000);

  vendorPayments    : Composition of many PaymentRunVendors
                        on vendorPayments.paymentRun = $self;
}

entity PaymentRunVendors : cuid {
  paymentRun        : Association to PaymentRuns;
  vendor            : Association to Vendors;
  amount            : Decimal(15,2);
  itemCount         : Integer;
  paymentRef        : String(30);
  status            : String(20);
}
