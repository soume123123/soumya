const express = require('express');

const app = express();
app.use(express.json());

// DOX API Mock Data
const MOCK_EXTRACTION = {
  id: "mock-job-12345",
  status: "DONE",
  extraction: {
    headerFields: [
      { name: "documentNumber", value: "INV-2023-001", confidence: 0.98 },
      { name: "documentDate", value: "2023-10-15", confidence: 0.99 },
      { name: "purchaseOrderNumber", value: "4500001234", confidence: 0.95 },
      { name: "senderName", value: "Acme Suppliers Pvt Ltd", confidence: 0.97 },
      { name: "grossAmount", value: "11800.00", confidence: 0.99 },
      { name: "netAmount", value: "10000.00", confidence: 0.98 },
      { name: "taxAmount", value: "1800.00", confidence: 0.96 },
      { name: "senderGstin", value: "27AABCI1234F1ZP", confidence: 0.94 },
      { name: "currencyCode", value: "INR", confidence: 0.99 }
    ],
    lineItems: [
      {
        description: "Industrial Widgets (Box of 50)",
        quantity: 10,
        unitPrice: 500.00,
        netAmount: 5000.00,
        hsnSacCode: "8479",
        taxRate: 18,
        taxAmount: 900.00
      },
      {
        description: "Heavy Duty Bearings",
        quantity: 5,
        unitPrice: 1000.00,
        netAmount: 5000.00,
        hsnSacCode: "8482",
        taxRate: 18,
        taxAmount: 900.00
      }
    ]
  }
};

// 1. Upload Document endpoint
app.post('/document/jobs', (req, res) => {
  console.log('[Mock DOX] Received document upload request');
  // Simulate delay
  setTimeout(() => {
    res.status(202).json({ id: "mock-job-12345", status: "PENDING" });
  }, 1000);
});

// 2. Poll Status endpoint
app.get('/document/jobs/:jobId', (req, res) => {
  console.log(`[Mock DOX] Polling status for job ${req.params.jobId}`);
  // Instantly return DONE for local testing
  res.status(200).json(MOCK_EXTRACTION);
});

const PORT = 8081;
app.listen(PORT, () => {
  console.log(`[Mock DOX] Server running on http://localhost:${PORT}`);
});
