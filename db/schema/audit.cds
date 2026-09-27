namespace itc.vendor.portal;

using { cuid, managed } from '@sap/cds/common';
using { itc.vendor.portal.Documents } from './invoices';
using { itc.vendor.portal.ShippingNotifications } from './asn';
using { itc.vendor.portal.VendorQueries } from './queries';
using { itc.vendor.portal.PaymentRuns } from './payments';

// ═══════════════════════════════════════════
//  UNIVERSAL AUDIT LOG
// ═══════════════════════════════════════════
entity AuditLog : cuid, managed {
  document          : Association to Documents;
  asn               : Association to ShippingNotifications;
  query             : Association to VendorQueries;
  paymentRun        : Association to PaymentRuns;

  entityType        : String(50);
  entityId          : String(36);
  action            : String(50);
  performedBy       : String(200);
  performedByType   : String(10);
  comment           : String(1000);
  oldStatus         : String(20);
  newStatus         : String(20);
  changedFields     : LargeString;
  ipAddress         : String(45);
}
