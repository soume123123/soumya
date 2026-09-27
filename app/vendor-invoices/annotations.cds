using VendorService from '../../srv/vendor-service';

annotate VendorService.Documents with @(
    UI: {
        SelectionFields: [ status_code, documentType_code, division_ID, documentDate, poNumber ],
        LineItem: [
            { Value: documentNumber },
            { Value: documentType_code },
            { Value: documentDate },
            { Value: division.divisionName, Label: 'Division' },
            { Value: poNumber },
            { Value: totalAmount },
            { Value: currency_code },
            { Value: status_code, Criticality: status.criticality },
            { Value: docAiConfidence },
            { Value: createdAt }
        ],
        PresentationVariant: {
            SortOrder: [{ Property: createdAt, Descending: true }]
        },
        HeaderInfo: {
            TypeName: 'Document',
            TypeNamePlural: 'Documents',
            Title: { Value: documentNumber }
        },
        Facets: [
            { $Type: 'UI.ReferenceFacet', ID: 'DocumentDetails', Label: 'Document Details', Target: '@UI.FieldGroup#DocumentDetails' },
            { $Type: 'UI.ReferenceFacet', ID: 'Financial', Label: 'Financial', Target: '@UI.FieldGroup#Financial' },
            { $Type: 'UI.ReferenceFacet', ID: 'GSTDetails', Label: 'GST Details', Target: '@UI.FieldGroup#GSTDetails' },
            { $Type: 'UI.ReferenceFacet', ID: 'SAPPosting', Label: 'SAP Posting', Target: '@UI.FieldGroup#SAPPosting' },
            { $Type: 'UI.ReferenceFacet', ID: 'LineItems', Label: 'Line Items', Target: 'items/@UI.LineItem' },
            { $Type: 'UI.ReferenceFacet', ID: 'Attachments', Label: 'Attachments', Target: 'attachments/@UI.LineItem' }
        ],
        FieldGroup#DocumentDetails: {
            Data: [
                { Value: documentNumber },
                { Value: documentDate },
                { Value: poNumber },
                { Value: vendorName_ext },
                { Value: buyerName },
                { Value: referenceDocument }
            ]
        },
        FieldGroup#Financial: {
            Data: [
                { Value: baseAmount },
                { Value: cgstAmount },
                { Value: sgstAmount },
                { Value: igstAmount },
                { Value: totalTaxAmount },
                { Value: totalAmount },
                { Value: withholdingTax },
                { Value: netPayable },
                { Value: currency_code }
            ]
        },
        FieldGroup#GSTDetails: {
            Data: [
                { Value: vendorGSTIN },
                { Value: buyerGSTIN },
                { Value: placeOfSupply },
                { Value: supplyType },
                { Value: reverseCharge },
                { Value: eWayBillNumber },
                { Value: irnNumber }
            ]
        },
        FieldGroup#SAPPosting: {
            Data: [
                { Value: sapDocNumber },
                { Value: sapFiscalYear },
                { Value: sapPostingDate },
                { Value: sapPostingStatus },
                { Value: sapPostingMessage }
            ]
        }
    }
);



annotate VendorService.DocumentItems with @(
    UI: {
        LineItem: [
            { Value: lineNumber },
            { Value: materialNumber },
            { Value: description },
            { Value: quantity },
            { Value: uom },
            { Value: unitPrice },
            { Value: totalAmount }
        ]
    }
);

annotate VendorService.DocumentAttachments with @(
    UI: {
        LineItem: [
            { Value: fileName },
            { Value: fileSize },
            { Value: attachmentType },
            { Value: mediaType },
            { Value: createdAt }
        ]
    }
);
