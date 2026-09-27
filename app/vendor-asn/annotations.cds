using VendorService from '../../srv/vendor-service';

annotate VendorService.ShippingNotifications with @(
    UI: {
        SelectionFields: [ status, poNumber, division_ID ],
        LineItem: [
            { Value: asnNumber },
            { Value: poNumber },
            { Value: division.divisionName, Label: 'Division' },
            { Value: shipmentDate },
            { Value: expectedDelivery },
            { Value: carrierName },
            { Value: vehicleNumber },
            { Value: status },
            { Value: createdAt }
        ],
        HeaderInfo: {
            TypeName: 'ASN',
            TypeNamePlural: 'ASNs',
            Title: { Value: asnNumber }
        },
        Facets: [
            { $Type: 'UI.ReferenceFacet', ID: 'ShipmentDetails', Label: 'Shipment Details', Target: '@UI.FieldGroup#ShipmentDetails' },
            { $Type: 'UI.ReferenceFacet', ID: 'Delivery', Label: 'Delivery', Target: '@UI.FieldGroup#Delivery' },
            { $Type: 'UI.ReferenceFacet', ID: 'ASNItems', Label: 'ASN Items', Target: 'items/@UI.LineItem' }
        ],
        FieldGroup#ShipmentDetails: {
            Data: [
                { Value: asnNumber },
                { Value: poNumber },
                { Value: shipmentDate },
                { Value: expectedDelivery },
                { Value: carrierName },
                { Value: trackingNumber },
                { Value: vehicleNumber },
                { Value: lrNumber },
                { Value: lrDate }
            ]
        },
        FieldGroup#Delivery: {
            Data: [
                { Value: dispatchFrom },
                { Value: deliveryPlant },
                { Value: deliveryAddress },
                { Value: totalPackages },
                { Value: totalWeight },
                { Value: weightUnit }
            ]
        }
    }
);

annotate VendorService.ASNItems with @(
    UI: {
        LineItem: [
            { Value: lineNumber },
            { Value: poItemNumber },
            { Value: materialNumber },
            { Value: description },
            { Value: quantity },
            { Value: uom }
        ]
    }
);
