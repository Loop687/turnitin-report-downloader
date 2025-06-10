export class TurnitinService {
    private apiKey: string;
    private baseUrl: string;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://api.turnitin.com'; // Replace with actual Turnitin API base URL
    }

    async fetchReport(reportId: string): Promise<any> {
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

    async downloadReport(reportId: string): Promise<Blob> {
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