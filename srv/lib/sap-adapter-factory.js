/**
 * SAP Adapter Factory
 * Resolves the correct OData service and BTP destination for a given
 * division + operation type. Supports configurable standard and custom
 * OData services per SAP system.
 */
const cds = require('@sap/cds');
const LOG = cds.log('sap-adapter');

/**
 * Get the SAP backend adapter for a specific division and operation.
 * @param {string} divisionId - Division UUID
 * @param {string} operationType - e.g. INVOICE_POST, PO_FETCH, GRN_FETCH, PAYMENT_STATUS, PAYMENT_RUN, GST_DATA
 * @returns {object} { backend, config, service, isStandard, buildUrl }
 */
async function getAdapter(divisionId, operationType) {
  const { SAPSystemConfigs, ODataServiceRegistry } = cds.entities('itc.vendor.portal');

  // Lookup configured SAP system for this division
  const config = await SELECT.one.from(SAPSystemConfigs)
    .where({ division_ID: divisionId, active: true });

  if (!config) {
    throw new Error(`No active SAP system configured for division ${divisionId}`);
  }

  // Lookup registered OData service for this operation
  const service = await SELECT.one.from(ODataServiceRegistry)
    .where({ sapSystem_ID: config.ID, operationType, active: true });

  if (!service) {
    throw new Error(`No OData service registered for operation '${operationType}' in system ${config.systemId}`);
  }

  // Connect via BTP Destination
  let backend;
  try {
    backend = await cds.connect.to(config.btpDestination);
  } catch (err) {
    throw new Error(`Failed to connect to destination '${config.btpDestination}': ${err.message}`);
  }

  // Parse additional config if present
  let additionalConfig = {};
  if (service.additionalConfig) {
    try {
      additionalConfig = JSON.parse(service.additionalConfig);
    } catch (e) {
      LOG.warn(`Invalid additionalConfig JSON for service ${service.ID}`);
    }
  }

  return {
    backend,
    config,
    service,
    additionalConfig,
    isStandard: service.serviceType === 'STANDARD',
    isV4: service.serviceVersion === 'V4',

    /**
     * Build the full OData URL for a request.
     * @param {string} [entitySet] - Override entity set (defaults to service.entitySet)
     * @param {string} [queryParams] - OData query parameters
     */
    buildUrl(entitySet, queryParams) {
      const es = entitySet || service.entitySet;
      const path = service.servicePath.replace(/\/$/, '');
      return `${path}/${es}${queryParams || ''}`;
    },

    /**
     * Execute a GET request.
     */
    async get(entitySet, queryParams) {
      const url = this.buildUrl(entitySet, queryParams);
      LOG.info(`SAP GET: ${url}`);
      return backend.get(url);
    },

    /**
     * Execute a POST request.
     */
    async post(entitySet, data) {
      const url = this.buildUrl(entitySet);
      LOG.info(`SAP POST: ${url}`);
      return backend.post(url, data);
    },

    /**
     * Execute an RFC/BAPI call (for ECC systems).
     */
    async callFunction(functionName, params) {
      LOG.info(`SAP RFC: ${functionName}`);
      return backend.send(functionName, params);
    }
  };
}

/**
 * Test connectivity to a SAP system.
 */
async function testSAPConnection(config) {
  try {
    const backend = await cds.connect.to(config.btpDestination);
    // Simple metadata request to verify connectivity
    await backend.get('/$metadata');
    return { success: true, message: 'Connection successful' };
  } catch (err) {
    return { success: false, message: `Connection failed: ${err.message}` };
  }
}

/**
 * Get the vendor's SAP vendor code for a specific division.
 */
async function getSAPVendorCode(vendorId, divisionId) {
  const { VendorDivisionMappings } = cds.entities('itc.vendor.portal');
  const mapping = await SELECT.one.from(VendorDivisionMappings)
    .where({ vendor_ID: vendorId, division_ID: divisionId, active: true });
  if (!mapping?.sapVendorCode) {
    throw new Error(`No SAP vendor code mapped for vendor ${vendorId} in division ${divisionId}`);
  }
  return mapping.sapVendorCode;
}

module.exports = { getAdapter, testSAPConnection, getSAPVendorCode };
