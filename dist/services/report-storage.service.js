import fs from 'fs';
import path from 'path';
const reportMetadatabase = [];
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'reports');
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
export class ReportStorageService {
    constructor() {
    }
    async saveReportMetadata(reportDetails) {
        console.log('Saving report metadata:', reportDetails);
        const newReport = {
            id: Date.now().toString(),
            ...reportDetails,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        reportMetadatabase.push(newReport);
        console.log('Current reportMetadatabase contents:', JSON.stringify(reportMetadatabase, null, 2));
        return newReport;
    }
    async findReportForStudent(studentId) {
        console.log(`Searching for report for student ID: ${studentId} in current database.`);
        const report = reportMetadatabase.find(r => r.studentId === studentId);
        return report || null;
    }
    getReportFilePath(storedFilename) {
        return path.join(UPLOAD_DIR, storedFilename);
    }
}
