# ITC Vendor Collaboration Portal - SAP BTP Production Deployment Guide

This guide covers the deployment of the **ITC Vendor Collaboration Portal** on **SAP Business Technology Platform (BTP)** Cloud Foundry runtime using **SAP HANA Cloud**, **SAP Document Information Extraction (DOX)**, **SAP Build Process Automation (BPA)**, and **SAP Cloud Connector** integration with multi-division ECC and S/4HANA instances.

---

## 1. Prerequisites & BTP Entitlements

Ensure the target BTP subaccount has the following entitlements assigned:

| Service | Plan | Quota / Type | Purpose |
|---------|------|--------------|---------|
| **SAP HANA Cloud** | `hana` / `hdi-shared` | 1 HDI container | Application database storage & audit trail |
| **Cloud Foundry Runtime** | `standard` | >= 2 GB memory | Running Node.js backend & Approuter |
| **Authorization and Trust (XSUAA)** | `application` | 1 instance | Role-based access control (Vendor / Admin / Finance) |
| **Destination Service** | `lite` | 1 instance | Multi-division ERP routing, DOX, and Workflow API calls |
| **Connectivity Service** | `lite` | 1 instance | Secure tunnel to on-premise ECC/S4 via Cloud Connector |
| **Document Information Extraction** | `blocks_100` / `standard` | 1 instance | AI OCR and automatic invoice field extraction |
| **SAP Build Process Automation** | `standard` | 1 instance | Multi-level approval workflows |

---

## 2. Multi-Division SAP System Architecture

```
                  ┌───────────────────────────────────────────────┐
                  │               SAP BTP Subaccount              │
                  │                                               │
                  │   ┌───────────────────────────────────────┐   │
                  │   │      Standalone Approuter (UI)        │   │
                  │   └───────────────────┬───────────────────┘   │
                  │                       │                       │
                  │   ┌───────────────────▼───────────────────┐   │
                  │   │       CAP Node.js Service (srv)       │   │
                  │   └───┬───────────────┬───────────────┬───┘   │
                  │       │               │               │       │
                  └───────┼───────────────┼───────────────┼───────┘
                          │               │               │
        ┌─────────────────┼───────────────┼───────────────┼─────────────────┐
        │ Cloud Connector │               │ OAuth2        │ OAuth2          │
        ▼                 ▼               ▼               ▼                 ▼
 ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
 │   ITC FMCG   │  │ ITC Hotels   │  │ ITC Paper    │  │    SAP       │  │  SAP Build   │
 │   S/4HANA    │  │   S/4HANA    │  │   ECC 6.0    │  │ Document AI  │  │   Process    │
 │ (Dest: S4F)  │  │ (Dest: S4H)  │  │ (Dest: ECR)  │  │ (itc-dox-api)│  │ (SPA_Workflow│
 └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
```

---

## 3. Configuring BTP Destinations

Import or configure the following destinations in **BTP Cockpit > Connectivity > Destinations** (a ready-to-use template is in `deploy/destinations-template.json`):

### 3.1 Document AI Destination (`itc-dox-api`)
- **Type**: `HTTP`
- **URL**: Service key `url` from the DOX instance (e.g. `https://aiservices-dox.cfapps.<region>.hana.ondemand.com`)
- **Authentication**: `OAuth2ClientCredentials`
- **Client ID**: Service key `clientid`
- **Client Secret**: Service key `clientsecret`
- **Token Service URL**: Service key `url` + `/oauth/token`

### 3.2 Workflow Destination (`SPA_Workflow`)
- **Type**: `HTTP`
- **URL**: API URL from the SAP Build Process Automation service key
- **Authentication**: `OAuth2ClientCredentials`
- **Token Service URL**: Authentication URL + `/oauth/token`

### 3.3 Division ERP Destinations (via Cloud Connector)
For each division, configure an on-premise destination pointing to the virtual host in Cloud Connector:
- **`S4F`** (FMCG S/4HANA): `ProxyType: OnPremise`, `URL: http://s4f-virtual:44300`, `sap-client: 100`
- **`S4H`** (Hotels S/4HANA): `ProxyType: OnPremise`, `URL: http://s4h-virtual:44300`, `sap-client: 200`
- **`ECR`** (Paperboards ECC): `ProxyType: OnPremise`, `URL: http://ecr-virtual:8000`, `sap-client: 300`
- **`ECA`** (Agri ECC): `ProxyType: OnPremise`, `URL: http://eca-virtual:8000`, `sap-client: 400`

---

## 4. Deployment Methods

### Option A: Automated PowerShell Deployment (Direct Cloud Foundry)
Ensure you are logged in to Cloud Foundry CLI:
```powershell
cf login -a https://api.cf.<region>.hana.ondemand.com -o <ORG> -s <SPACE>
```

Run the deployment script:
```powershell
cd C:\Users\soume\.gemini\antigravity\scratch\itc-vendor-portal
.\deploy\deploy-cf.ps1
```

This script automatically:
1. Provisions `itc-vendor-portal-auth` (XSUAA with scopes/role collections).
2. Provisions `itc-vendor-portal-db` (HANA HDI container).
3. Provisions `itc-vendor-portal-dest` & `itc-vendor-portal-conn`.
4. Compiles CAP models to `gen/srv` and `gen/db`.
5. Deploys the database container to create all 102 HANA tables and views.
6. Pushes the CAP backend and Standalone Approuter.

---

### Option B: MTA Deployment via Cloud MTA Build Tool (`mbt`)

If building on a Linux runner, Docker container, or SAP Business Application Studio:
```bash
# 1. Install dependencies
npm ci
npm install --prefix app

# 2. Build production artifacts & MTA archive
npx cds build --production
mbt build -t ./gen --mtar itc-vendor-portal.mtar

# 3. Deploy via CF Deploy plugin
cf deploy gen/itc-vendor-portal.mtar
```

---

## 5. Security & Identity Setup (PAN-based Vendor Authentication)

### 5.1 Role Collections Configured in `xs-security.json`
- **`ITCVendorUser`**: Access to Vendor Invoices, ASN, Payments, Queries (restricted by vendor's own PAN/ID).
- **`ITCAdmin`**: Full portal administration, division setup, ERP connectivity testing.
- **`ITCApprover`**: Level-1 / Level-2 document and invoice approval inbox.
- **`ITCFinance`**: Payment run approvals, exception handling, and posting triggers.

### 5.2 SAP Cloud Identity Services (IAS) Integration
1. In SAP BTP Cockpit, navigate to **Security > Trust Configuration**.
2. Establish trust with your **SAP Cloud Identity Services (IAS)** tenant.
3. Configure **Attribute Mapping**:
   - Map SAML / OpenID attribute `panNumber` -> XSUAA user attribute `panNumber`.
   - Map `vendorId` -> XSUAA user attribute `vendorId`.
4. When vendors authenticate via IAS OTP/credentials, their PAN number is injected into the JWT token. The CAP row-level security policy (`VendorService.js`) automatically enforces that vendors only see data matching their assigned vendor ID and authorized divisions.

---

## 6. Verification and Health Check

Once deployed, verify the endpoints:
1. **Approuter Landing Page**: `https://itc-vendor-portal-app.<region>.cfapps.hana.ondemand.com`
2. **Backend Health Check**: `https://itc-vendor-portal-srv.<region>.cfapps.hana.ondemand.com/api/vendor/$metadata`
3. **Connectivity Self-Test**: 
   Call `AdminService.testDivisionConnectivity(divisionId)` from the Admin Portal to run an automated handshake against each division's ERP destination.
