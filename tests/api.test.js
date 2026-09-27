const cds = require('@sap/cds/lib');
const { expect } = require('chai');
const { GET, POST, axios } = cds.test(__dirname + '/../');

describe('ITC Vendor Portal APIs', () => {

    it('should serve vendor metadata', async () => {
        const { data } = await GET('/api/vendor/$metadata', {
            auth: { username: 'vendor1', password: 'vendor1' }
        });
        expect(data).to.match(/VendorService/);
    });

    it('should allow vendor to fetch their profile', async () => {
        const { data } = await GET('/api/vendor/MyProfile', {
            auth: { username: 'vendor1', password: 'vendor1' }
        });
        expect(data.value).to.be.an('array');
        // Because of the mock data and row-level security, vendor1 should only see their own profile
    });

    it('should reject unauthorized access', async () => {
        try {
            await GET('/api/admin/Vendors');
            throw new Error('Should have failed');
        } catch (err) {
            expect(err.response.status).to.equal(401);
        }
    });

    it('should allow admin to fetch all vendors', async () => {
        const { data } = await GET('/api/admin/Vendors', {
            auth: { username: 'admin1', password: 'admin1' }
        });
        expect(data.value).to.be.an('array');
        expect(data.value.length).to.be.greaterThan(0);
    });
});
