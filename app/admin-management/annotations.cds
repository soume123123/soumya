using AdminService from '../../srv/admin-service';

annotate AdminService.Vendors with @(
    UI: {
        LineItem: [
            { Value: vendorName },
            { Value: panNumber },
            { Value: email },
            { Value: phone },
            { Value: status_code },
            { Value: city },
            { Value: state }
        ],
        HeaderInfo: {
            TypeName: 'Vendor',
            TypeNamePlural: 'Vendors',
            Title: { Value: vendorName }
        },
        Facets: [
            { $Type: 'UI.ReferenceFacet', ID: 'VendorDetails', Label: 'Vendor Details', Target: '@UI.FieldGroup#VendorDetails' }
        ],
        FieldGroup#VendorDetails: {
            Data: [
                { Value: vendorName },
                { Value: panNumber },
                { Value: email },
                { Value: phone },
                { Value: status_code },
                { Value: city },
                { Value: state }
            ]
        }
    }
);

annotate AdminService.Divisions with @(
    UI: {
        LineItem: [
            { Value: divisionCode },
            { Value: divisionName },
            { Value: sapSystemType },
            { Value: companyCode },
            { Value: active }
        ],
        HeaderInfo: {
            TypeName: 'Division',
            TypeNamePlural: 'Divisions',
            Title: { Value: divisionName }
        },
        Facets: [
            { $Type: 'UI.ReferenceFacet', ID: 'DivisionDetails', Label: 'Division Details', Target: '@UI.FieldGroup#DivisionDetails' }
        ],
        FieldGroup#DivisionDetails: {
            Data: [
                { Value: divisionCode },
                { Value: divisionName },
                { Value: sapSystemType },
                { Value: companyCode },
                { Value: active }
            ]
        }
    }
);

annotate AdminService.SAPSystemConfigs with @(
    UI: {
        LineItem: [
            { Value: systemId },
            { Value: systemType },
            { Value: btpDestination },
            { Value: client },
            { Value: active },
            { Value: lastTestResult }
        ],
        HeaderInfo: {
            TypeName: 'SAP System Config',
            TypeNamePlural: 'SAP System Configs',
            Title: { Value: systemId }
        },
        Facets: [
            { $Type: 'UI.ReferenceFacet', ID: 'ConfigDetails', Label: 'Config Details', Target: '@UI.FieldGroup#ConfigDetails' }
        ],
        FieldGroup#ConfigDetails: {
            Data: [
                { Value: systemId },
                { Value: systemType },
                { Value: btpDestination },
                { Value: client },
                { Value: active },
                { Value: lastTestResult }
            ]
        }
    }
);

annotate AdminService.VendorRegistrations with @(
    UI: {
        SelectionFields: [ status ],
        LineItem: [
            { Value: registrationId },
            { Value: vendorName },
            { Value: email },
            { Value: status }
        ]
    }
);

annotate AdminService.PaymentRuns with @(
    UI: {
        LineItem: [
            { Value: runId },
            { Value: runDate },
            { Value: status }
        ],
        HeaderInfo: {
            TypeName: 'Payment Run',
            TypeNamePlural: 'Payment Runs',
            Title: { Value: runId }
        },
        Facets: [
            { $Type: 'UI.ReferenceFacet', ID: 'RunDetails', Label: 'Run Details', Target: '@UI.FieldGroup#RunDetails' }
        ],
        FieldGroup#RunDetails: {
            Data: [
                { Value: runId },
                { Value: runDate },
                { Value: status }
            ]
        }
    }
);
