namespace itc.vendor.portal;

using { cuid, managed } from '@sap/cds/common';
using { itc.vendor.portal.Vendors, itc.vendor.portal.Divisions } from './master-data';

// ═══════════════════════════════════════════
//  VENDOR QUERIES (Ticket System)
// ═══════════════════════════════════════════
entity VendorQueries : cuid, managed {
  vendor            : Association to Vendors;
  division          : Association to Divisions;
  queryNumber       : String(20);
  subject           : String(500);
  category          : String(50);    // INVOICE, PAYMENT, PO, DELIVERY, GST, OTHER
  priority          : String(10);    // LOW, MEDIUM, HIGH
  status            : String(20) default 'OPEN';
  description       : LargeString;
  referenceDocument : String(50);
  assignedTo        : String(200);
  resolutionDate    : DateTime;
  resolutionNotes   : LargeString;

  messages          : Composition of many QueryMessages
                        on messages.query = $self;
  attachments       : Composition of many QueryAttachments
                        on attachments.query = $self;
}

entity QueryMessages : cuid, managed {
  query             : Association to VendorQueries;
  senderType        : String(10);    // VENDOR or ITC
  senderName        : String(200);
  message           : LargeString;
}

entity QueryAttachments : cuid, managed {
  query             : Association to VendorQueries;
  file              : LargeBinary @Core.MediaType: mediaType;
  mediaType         : String(100);
  fileName          : String(500);
}

// ═══════════════════════════════════════════
//  BUSINESS ANNOUNCEMENTS
// ═══════════════════════════════════════════
entity Announcements : cuid, managed {
  title             : String(500);
  content           : LargeString;
  category          : String(50);
  priority          : String(10);
  publishDate       : DateTime;
  expiryDate        : Date;
  targetDivisions   : String(200);
  isPublished       : Boolean default false;
  publishedBy       : String(200);

  readReceipts      : Composition of many AnnouncementReadReceipts
                        on readReceipts.announcement = $self;
}

entity AnnouncementReadReceipts : cuid {
  announcement      : Association to Announcements;
  vendor            : Association to Vendors;
  readAt            : DateTime;
}
