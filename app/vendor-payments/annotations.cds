using VendorService from '../../srv/vendor-service';

annotate VendorService.PaymentItems with @(
    UI: {
        SelectionFields: [ paymentStatus_code, division_ID, ageingBucket, dueDate ],
        LineItem: [
            { Value: sapDocNumber },
            { Value: documentType_code },
            { Value: documentDate },
            { Value: dueDate },
            { Value: currency_code },
            { Value: originalAmount },
            { Value: openAmount },
            { Value: paymentStatus_code },
            { Value: paymentRef },
            { Value: ageingBucket },
            { Value: daysOverdue }
        ],
        PresentationVariant: {
            SortOrder: [{ Property: dueDate, Descending: false }]
        },
        HeaderInfo: {
            TypeName: 'Payment',
            TypeNamePlural: 'Payments',
            Title: { Value: sapDocNumber }
        },
        Facets: [
            { $Type: 'UI.ReferenceFacet', ID: 'PaymentDetails', Label: 'Payment Details', Target: '@UI.FieldGroup#PaymentDetails' }
        ],
        FieldGroup#PaymentDetails: {
            Data: [
                { Value: sapDocNumber },
                { Value: documentType_code },
                { Value: documentDate },
                { Value: dueDate },
                { Value: currency_code },
                { Value: originalAmount },
                { Value: openAmount },
                { Value: paymentStatus_code },
                { Value: paymentRef },
                { Value: ageingBucket },
                { Value: daysOverdue },
                { Value: division_ID }
            ]
        }
    }
);
