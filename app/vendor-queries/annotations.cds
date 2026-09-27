using VendorService from '../../srv/vendor-service';

annotate VendorService.VendorQueries with @(
    UI: {
        SelectionFields: [ status_code, category_code, priority_code ],
        LineItem: [
            { Value: queryNumber },
            { Value: subject },
            { Value: category_code },
            { Value: priority_code },
            { Value: status_code },
            { Value: assignedTo },
            { Value: createdAt }
        ],
        HeaderInfo: {
            TypeName: 'Query',
            TypeNamePlural: 'Queries',
            Title: { Value: queryNumber }
        },
        Facets: [
            { $Type: 'UI.ReferenceFacet', ID: 'QueryDetails', Label: 'Query Details', Target: '@UI.FieldGroup#QueryDetails' },
            { $Type: 'UI.ReferenceFacet', ID: 'Messages', Label: 'Messages', Target: 'messages/@UI.LineItem' },
            { $Type: 'UI.ReferenceFacet', ID: 'Attachments', Label: 'Attachments', Target: 'attachments/@UI.LineItem' }
        ],
        FieldGroup#QueryDetails: {
            Data: [
                { Value: queryNumber },
                { Value: subject },
                { Value: category_code },
                { Value: priority_code },
                { Value: status_code },
                { Value: assignedTo },
                { Value: createdAt }
            ]
        }
    }
);

annotate VendorService.Announcements with @(
    UI: {
        LineItem: [
            { Value: title },
            { Value: category_code },
            { Value: priority_code },
            { Value: publishDate },
            { Value: expiryDate }
        ]
    }
);

annotate VendorService.QueryMessages with @(
    UI: {
        LineItem: [
            { Value: messageText },
            { Value: isFromVendor },
            { Value: createdAt }
        ]
    }
);

annotate VendorService.QueryAttachments with @(
    UI: {
        LineItem: [
            { Value: fileName },
            { Value: attachmentType },
            { Value: createdAt }
        ]
    }
);
