"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportStorageService = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// Placeholder for database interactions
const reportMetadatabase = [];
const UPLOAD_DIR = path_1.default.join(__dirname, '..', '..', 'uploads', 'reports'); // Ensure this directory exists and is writable
if (!fs_1.default.existsSync(UPLOAD_DIR)) {
    fs_1.default.mkdirSync(UPLOAD_DIR, { recursive: true });
}
class ReportStorageService {
    constructor() {
        // Initialize database connection or other setup if needed
    }
    async saveReportMetadata(reportDetails) {
        // Placeholder: In a real app, save to a database and return the created record
        console.log('Saving report metadata:', reportDetails);
        const newReport = {
            id: Date.now().toString(),
            ...reportDetails,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        reportMetadatabase.push(newReport);
        console.log('Current reportMetadatabase contents:', JSON.stringify(reportMetadatabase, null, 2)); // Log para ver qué hay guardado
        return newReport;
    }
    async findReportForStudent(studentId) {
        // Placeholder: In a real app, query the database for the student's report
        console.log(`Searching for report for student ID: ${studentId} in current database.`); // Log para ver qué se busca
        const report = reportMetadatabase.find(r => r.studentId === studentId);
        return report || null;
    }
    getReportFilePath(storedFilename) {
        return path_1.default.join(UPLOAD_DIR, storedFilename);
    }
}
exports.ReportStorageService = ReportStorageService;
