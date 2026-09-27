namespace itc.vendor.portal;

using { cuid, managed } from '@sap/cds/common';
using { itc.vendor.portal.Vendors, itc.vendor.portal.Divisions } from './master-data';

// ═══════════════════════════════════════════
//  ADVANCED SHIPPING NOTIFICATION
// ═══════════════════════════════════════════
entity ShippingNotifications : cuid, managed {
  vendor            : Association to Vendors;
  division          : Association to Divisions;
  asnNumber         : String(20);
  poNumber          : String(20) @mandatory;
  poDate            : Date;
  shipmentDate      : Date;
  expectedDelivery  : Date;
  carrierName       : String(200);
  trackingNumber    : String(100);
  vehicleNumber     : String(20);
  lrNumber          : String(50);
  lrDate            : Date;
  dispatchFrom      : String(200);
  deliveryPlant     : String(4);
  deliveryAddress   : String(500);
  totalPackages     : Integer;
  totalWeight       : Decimal(13,3);
  weightUnit        : String(3) default 'KG';
  status            : String(20) default 'CREATED';
  remarks           : String(1000);
  notifiedToITC     : Boolean default false;
  notificationDate  : DateTime;

  items             : Composition of many ASNItems
                        on items.asn = $self;
}

entity ASNItems : cuid {
  asn               : Association to ShippingNotifications;
  lineNumber        : Integer;
  poItemNumber      : String(6);
  materialNumber    : String(40);
  description       : String(500);
  shippedQuantity   : Decimal(13,3);
  uom               : String(3);
  batchNumber       : String(10);
  manufacturingDate : Date;
  expiryDate        : Date;
  hsnCode           : String(8);
}
