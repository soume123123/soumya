/**
 * Fetch Purchase Orders and GRN data from SAP backends.
 */
const cds = require('@sap/cds');
const LOG = cds.log('sap-po');
const { getAdapter, getSAPVendorCode } = require('./sap-adapter-factory');

/**
 * Fetch purchase orders for a vendor from a specific division's SAP system.
 */
async function fetchPurchaseOrders(divisionId, vendorId) {
  const adapter = await getAdapter(divisionId, 'PO_FETCH');
  const sapVendorCode = await getSAPVendorCode(vendorId, divisionId);

  LOG.info(`Fetching POs for vendor ${sapVendorCode} from ${adapter.config.systemId}`);

  try {
    if (adapter.isStandard && adapter.config.systemType === 'S4HANA') {
      // S/4HANA Standard: API_PURCHASEORDER_PROCESS_SRV
      const filter = `Supplier eq '${sapVendorCode}' and PurchaseOrderType eq 'NB'`;
      const result = await adapter.get(
        'A_PurchaseOrder',
        `?$filter=${encodeURIComponent(filter)}&$expand=to_PurchaseOrderItem&$top=100&$orderby=CreationDate desc`
      );

      const orders = (result?.data?.results || result?.value || []);
      return orders.map(po => ({
        poNumber: po.PurchaseOrder,
        poDate: po.PurchaseOrderDate || po.CreationDate,
        vendor: po.Supplier,
        totalValue: parseFloat(po.PurchasingDocumentOrderAmount) || 0,
        currency: po.DocumentCurrency,
        status: po.PurchasingDocumentDeletionCode ? 'DELETED' : 'ACTIVE',
        items: (po.to_PurchaseOrderItem?.results || po.to_PurchaseOrderItem || []).map(item => ({
          itemNumber: item.PurchaseOrderItem,
          material: item.Material,
          description: item.PurchaseOrderItemText,
          quantity: parseFloat(item.OrderQuantity) || 0,
          uom: item.PurchaseOrderQuantityUnit,
          unitPrice: parseFloat(item.NetPriceAmount) || 0,
          deliveryDate: item.ScheduleLineDeliveryDate,
          grnQuantity: 0, // Will be enriched from GRN data
          grnStatus: 'PENDING'
        }))
      }));

    } else {
      // ECC or Custom OData
      const filter = `VendorCode eq '${sapVendorCode}'`;
      const result = await adapter.get(null, `?$filter=${encodeURIComponent(filter)}&$top=100`);
      const orders = result?.data?.results || result?.value || result?.data || [];
      return Array.isArray(orders) ? orders : [orders];
    }
  } catch (err) {
    LOG.error('PO fetch failed:', err.message);
    throw new Error(`Failed to fetch POs from SAP: ${err.message}`);
  }
}

/**
 * Fetch GRN (Goods Receipt) status for a PO.
 */
async function fetchGRNStatus(divisionId, poNumber) {
  const adapter = await getAdapter(divisionId, 'GRN_FETCH');

  LOG.info(`Fetching GRN for PO ${poNumber} from ${adapter.config.systemId}`);

  try {
    if (adapter.isStandard && adapter.config.systemType === 'S4HANA') {
      // S/4HANA: API_MATERIAL_DOCUMENT_SRV
      const filter = `PurchaseOrder eq '${poNumber}' and GoodsMovementType eq '101'`;
      const result = await adapter.get(
        'A_MaterialDocumentItem',
        `?$filter=${encodeURIComponent(filter)}&$orderby=PostingDate desc`
      );

      return (result?.data?.results || result?.value || []).map(grn => ({
        grnDocNumber: grn.MaterialDocument,
        grnDate: grn.PostingDate || grn.DocumentDate,
        poItem: grn.PurchaseOrderItem,
        material: grn.Material,
        quantity: parseFloat(grn.QuantityInEntryUnit) || 0,
        uom: grn.EntryUnit,
        plant: grn.Plant,
        movementType: grn.GoodsMovementType
      }));

    } else {
      const filter = `PONumber eq '${poNumber}'`;
      const result = await adapter.get(null, `?$filter=${encodeURIComponent(filter)}`);
      const items = result?.data?.results || result?.value || result?.data || [];
      return Array.isArray(items) ? items : [items];
    }
  } catch (err) {
    LOG.error('GRN fetch failed:', err.message);
    throw new Error(`Failed to fetch GRN from SAP: ${err.message}`);
  }
}

module.exports = { fetchPurchaseOrders, fetchGRNStatus };
