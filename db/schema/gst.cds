namespace itc.vendor.portal;

using { cuid, managed } from '@sap/cds/common';
using { itc.vendor.portal.Vendors, itc.vendor.portal.Divisions } from './master-data';
using { itc.vendor.portal.Documents } from './invoices';

// ═══════════════════════════════════════════
//  GST INVOICE DETAILS
// ═══════════════════════════════════════════
entity GSTInvoiceDetails : cuid {
  document            : Association to Documents;
  gstReturnPeriod     : String(6);
  gstr1Filed          : Boolean default false;
  gstr2bMatched       : Boolean default false;
  gstr2bMatchDate     : DateTime;
  itcEligible         : Boolean default true;
  itcAmount           : Decimal(15,2);
  itcClaimedPeriod    : String(6);
  reversal            : Boolean default false;
  reversalReason      : String(200);
  reconciliationStatus : String(20);
}

// ═══════════════════════════════════════════
//  CASH DISCOUNT TRACKING
// ═══════════════════════════════════════════
entity CashDiscounts : cuid, managed {
  document          : Association to Documents;
  vendor            : Association to Vendors;
  division          : Association to Divisions;
  paymentTerms      : String(4);
  discountPercent1  : Decimal(5,2);
  discountDays1     : Integer;
  discountAmount1   : Decimal(15,2);
  discountPercent2  : Decimal(5,2);
  discountDays2     : Integer;
  discountAmount2   : Decimal(15,2);
  netDueDays        : Integer;
  baselineDate      : Date;
  discount1Deadline : Date;
  discount2Deadline : Date;
  netDueDate        : Date;
  discountAvailed   : Boolean default false;
  discountAmountAvailed : Decimal(15,2);
  gstOnDiscount     : Decimal(15,2);
}
