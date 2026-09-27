# ==============================================================================
# ITC Vendor Collaboration Portal - Automated BTP Cloud Foundry Deployment
# ==============================================================================

param (
    [switch]$SkipBuild = $false,
    [switch]$DeployDBOnly = $false
)

$ErrorActionPreference = "Stop"

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "  ITC VENDOR PORTAL - SAP BTP DEPLOYMENT SCRIPT" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

# 1. Verify CF CLI session
Write-Host "`n[1/5] Checking Cloud Foundry login status..." -ForegroundColor Yellow
try {
    $target = cf target
    Write-Host $target
} catch {
    Write-Error "Not logged in to Cloud Foundry CLI. Run 'cf login' first."
}

# 2. Provision / Check BTP Backing Services
Write-Host "`n[2/5] Verifying BTP Managed Services..." -ForegroundColor Yellow

function Ensure-Service($name, $service, $plan, $extraArgs = "") {
    $existing = cf service $name 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  Creating service '$name' ($service / $plan)..." -ForegroundColor Green
        if ($extraArgs) {
            Invoke-Expression "cf create-service $service $plan $name $extraArgs"
        } else {
            cf create-service $service $plan $name
        }
    } else {
        Write-Host "  Service '$name' already exists." -ForegroundColor Gray
    }
}

# XSUAA Security
Ensure-Service "itc-vendor-portal-auth" "xsuaa" "application" "-c xs-security.json"

# HANA HDI Container
Ensure-Service "itc-vendor-portal-db" "hana" "hdi-shared"

# Destination Service
Ensure-Service "itc-vendor-portal-dest" "destination" "lite"

# Connectivity Service
Ensure-Service "itc-vendor-portal-conn" "connectivity" "lite"

# 3. Production Build
if (-not $SkipBuild) {
    Write-Host "`n[3/5] Building CAP production artifacts (gen/db, gen/srv)..." -ForegroundColor Yellow
    npx cds build --production
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Production build failed."
    }
} else {
    Write-Host "`n[3/5] Skipping build as requested." -ForegroundColor Gray
}

# 4. Deploy HANA Cloud Database Schema
Write-Host "`n[4/5] Deploying database artifacts to HANA Cloud..." -ForegroundColor Yellow
cf push itc-vendor-portal-db-deployer -f manifest.yml

# 5. Deploy Backend Service & Approuter
if (-not $DeployDBOnly) {
    Write-Host "`n[5/5] Deploying Backend Service & Approuter UI..." -ForegroundColor Yellow
    cf push itc-vendor-portal-srv -f manifest.yml
    cf push itc-vendor-portal-app -f manifest.yml
    
    Write-Host "`n=================================================================" -ForegroundColor Green
    Write-Host "  DEPLOYMENT COMPLETE!" -ForegroundColor Green
    Write-Host "=================================================================" -ForegroundColor Green
    cf apps | Select-String "itc-vendor-portal"
}
