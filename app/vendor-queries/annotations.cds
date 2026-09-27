using VendorService from '../../srv/vendor-service';

annotate VendorService.VendorQueries with @(
    UI: {
        SelectionFields: [ status, category, priority ],
        LineItem: [
            { Value: queryNumber },
            { Value: subject },
            { Value: category },
            { Value: priority },
            { Value: status },
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
                { Value: category },
                { Value: priority },
                { Value: status },
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
            { Value: category },
            { Value: priority },
            { Value: publishDate },
            { Value: expiryDate }
        ]
    }
);

annotate VendorService.QueryMessages with @(
    UI: {
        LineItem: [
            { Value: message },
            { Value: isFromVendor },
            { Value: createdAt }
        ]
    }
);

annotate VendorService.QueryAttachments with @(
    UI: {
        LineItem: [
            { Value: fileName },
            { Value: mediaType },
            { Value: createdAt }
        ]
    }
);
