export class TurnitinService {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://api.turnitin.com';
    }
    async fetchReport(reportId) {
        const response = await fetch(`${this.baseUrl}/reports/${reportId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            }
        });
        if (!response.ok) {
            throw new Error('Failed to fetch report');
        }
        return await response.json();
    }
    async downloadReport(reportId) {
        const response = await fetch(`${this.baseUrl}/reports/${reportId}/download`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            }
        });
        if (!response.ok) {
            throw new Error('Failed to download report');
        }
        return await response.blob();
    }
}
