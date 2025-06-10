"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportStorageService = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const reportMetadatabase = [];
const UPLOAD_DIR = path_1.default.join(__dirname, '..', '..', 'uploads', 'reports');
if (!fs_1.default.existsSync(UPLOAD_DIR)) {
    fs_1.default.mkdirSync(UPLOAD_DIR, { recursive: true });
}
class ReportStorageService {
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
        return path_1.default.join(UPLOAD_DIR, storedFilename);
    }
}
exports.ReportStorageService = ReportStorageService;
