const axios = require('axios');

async function simulateApproval() {
    console.log('--- ITC Vendor Portal Workflow Simulator ---');
    console.log('Connecting to local CAP service...');
    
    // 1. Get a document pending approval
    try {
        const docsUrl = 'http://localhost:4004/api/admin/Documents?$filter=status_code eq \'SUBMITTED\'';
        const config = {
            auth: { username: 'admin1', password: 'admin1' }
        };
        
        const response = await axios.get(docsUrl, config);
        const docs = response.data.value;
        
        if (!docs || docs.length === 0) {
            console.log('No documents pending approval (SUBMITTED status).');
            console.log('Please log in as vendor1 and submit an invoice first.');
            return;
        }
        
        const doc = docs[0];
        console.log(`Found pending document: ${doc.documentNumber} (${doc.ID})`);
        console.log(`Workflow Instance ID: ${doc.workflowInstanceId}`);
        
        if (!doc.workflowInstanceId) {
            console.log('Warning: Document does not have a workflow instance ID.');
            return;
        }
        
        // 2. Trigger the callback webhook
        console.log('\nSimulating BPA Workflow Callback (Approving)...');
        const webhookUrl = 'http://localhost:4004/api/integration/workflowCallback';
        const payload = {
            workflowInstanceId: doc.workflowInstanceId,
            decision: "approve",
            comment: "Approved automatically via local simulator",
            approverEmail: "finance.manager@itc.in"
        };
        
        const callbackResponse = await axios.post(webhookUrl, payload);
        
        console.log('Callback Response:', callbackResponse.data);
        console.log(`\nSuccess! Document ${doc.documentNumber} is now ${callbackResponse.data.newStatus}.`);
        console.log('If SAP mocking is enabled, it may have also attempted to auto-post to SAP.');
        
    } catch (err) {
        console.error('Error simulating workflow:');
        if (err.response) {
            console.error(err.response.data);
        } else {
            console.error(err.message);
        }
    }
}

simulateApproval();
