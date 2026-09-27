namespace itc.vendor.portal;

using { cuid, managed, Country, Currency } from '@sap/cds/common';

// ═══════════════════════════════════════════
//  VENDOR REGISTRY
// ═══════════════════════════════════════════
entity Vendors : cuid, managed {
  panNumber         : String(10) @mandatory;
  vendorName        : String(200);
  email             : String(200);
  phone             : String(15);
  contactPerson     : String(200);
  gstRegistrations  : Composition of many VendorGSTRegistrations
                        on gstRegistrations.vendor = $self;
  address           : String(500);
  city              : String(100);
  state             : String(100);
  pincode           : String(6);
  country           : Country;
  bankAccountNo     : String(20);
  bankIFSC          : String(11);
  bankName          : String(200);
  status            : String(20) default 'ACTIVE';  // ACTIVE, BLOCKED, PENDING
  divisions         : Composition of many VendorDivisionMappings
                        on divisions.vendor = $self;
}

entity VendorGSTRegistrations : cuid {
  vendor            : Association to Vendors;
  gstin             : String(15) @mandatory;
  gstState          : String(100);
  gstStateCode      : String(2);
  isPrimary         : Boolean default false;
}

entity VendorDivisionMappings : cuid {
  vendor            : Association to Vendors;
  division          : Association to Divisions;
  sapVendorCode     : String(10);     // Vendor number in that SAP system
  reconciliationAcc : String(10);
  paymentTerms      : String(4);
  active            : Boolean default true;
}

// ═══════════════════════════════════════════
//  ITC DIVISIONS (SAP SYSTEM REGISTRY)
// ═══════════════════════════════════════════
entity Divisions : cuid, managed {
  divisionCode      : String(10) @mandatory;
  divisionName      : String(200);
  sapSystemType     : String(10);      // ECC or S4HANA
  sapSystemId       : String(3);
  companyCode       : String(4);
  purchaseOrg       : String(4);
  plantCodes        : String(200);
  currency          : Currency;
  gstinBuyer        : String(15);
  active            : Boolean default true;
  approvers         : Composition of many DivisionApprovers
                        on approvers.division = $self;
  sapConfig         : Composition of many SAPSystemConfigs
                        on sapConfig.division = $self;
}

entity DivisionApprovers : cuid {
  division          : Association to Divisions;
  approverEmail     : String(200);
  approverName      : String(200);
  approverRole      : String(50);     // L1_APPROVER, L2_APPROVER, FINANCE_HEAD
  amountThreshold   : Decimal(15,2);
  documentTypes     : String(100);    // INVOICE,CN,DN,PAYMENT comma separated
  active            : Boolean default true;
}

// ═══════════════════════════════════════════
//  CONFIGURABLE SAP CONNECTIONS
// ═══════════════════════════════════════════
entity SAPSystemConfigs : cuid, managed {
  division          : Association to Divisions;
  systemId          : String(3);
  systemType        : String(10);     // ECC, S4HANA
  btpDestination    : String(100);    // BTP Destination name
  client            : String(3);
  language          : String(2) default 'EN';
  companyCode       : String(4);
  purchaseOrg       : String(4);
  active            : Boolean default true;
  lastTestedAt      : DateTime;
  lastTestResult    : String(20);     // OK, FAILED
  lastTestMessage   : String(500);
  services          : Composition of many ODataServiceRegistry
                        on services.sapSystem = $self;
}

entity ODataServiceRegistry : cuid {
  sapSystem         : Association to SAPSystemConfigs;
  operationType     : String(30);     // INVOICE_POST, PO_FETCH, GRN_FETCH, PAYMENT_STATUS, PAYMENT_RUN, GST_DATA
  serviceType       : String(10);     // STANDARD or CUSTOM
  servicePath       : String(500);
  serviceVersion    : String(5);      // V2 or V4
  entitySet         : String(200);
  additionalConfig  : LargeString;    // JSON for custom field mappings
  active            : Boolean default true;
}

// ═══════════════════════════════════════════
//  VENDOR SELF-REGISTRATION
// ═══════════════════════════════════════════
entity VendorRegistrations : cuid, managed {
  panNumber         : String(10) @mandatory;
  vendorName        : String(200);
  email             : String(200);
  phone             : String(15);
  gstin             : String(15);
  address           : String(500);
  city              : String(100);
  state             : String(100);
  pincode           : String(6);
  bankAccountNo     : String(20);
  bankIFSC          : String(11);
  bankName          : String(200);
  requestedDivisions : String(500);   // Comma-separated division codes
  supportingDoc     : LargeBinary @Core.MediaType: supportingDocMediaType;
  supportingDocMediaType : String(100);
  supportingDocName : String(500);
  status            : String(20) default 'PENDING'; // PENDING, APPROVED, REJECTED
  reviewedBy        : String(200);
  reviewComment     : String(1000);
  reviewedAt        : DateTime;
  createdVendor     : Association to Vendors;
}
