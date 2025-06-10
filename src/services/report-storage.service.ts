import { Report } from '../types'; // Assuming Report type is updated
import fs from 'fs';
import path from 'path';

// Placeholder for database interactions
const reportMetadatabase: Report[] = []; 

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'reports'); // Ensure this directory exists and is writable

if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export class ReportStorageService {
    constructor() {
        // Initialize database connection or other setup if needed
    }

    async saveReportMetadata(reportDetails: Omit<Report, 'id' | 'createdAt' | 'updatedAt'>): Promise<Report> {
        // Placeholder: In a real app, save to a database and return the created record
        console.log('Saving report metadata:', reportDetails);
        const newReport: Report = {
            id: Date.now().toString(), // Temporary ID
            ...reportDetails,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        reportMetadatabase.push(newReport);
        console.log('Current reportMetadatabase contents:', JSON.stringify(reportMetadatabase, null, 2)); // Log para ver qué hay guardado
        return newReport;
    }

    async findReportForStudent(studentId: string): Promise<Report | null> {
        // Placeholder: In a real app, query the database for the student's report
        console.log(`Searching for report for student ID: ${studentId} in current database.`); // Log para ver qué se busca
        const report = reportMetadatabase.find(r => r.studentId === studentId);
        return report || null;
    }

    getReportFilePath(storedFilename: string): string {
        return path.join(UPLOAD_DIR, storedFilename);
    }
}
