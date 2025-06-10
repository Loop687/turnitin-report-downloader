"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportController = void 0;
const fs_1 = __importDefault(require("fs"));
class ReportController {
    constructor(reportStorageService) {
        this.reportStorageService = reportStorageService;
    }
    async uploadReport(req, res) {
        const authReq = req;
        try {
            if (!authReq.file) {
                return res.status(400).json({ message: 'No file uploaded.' });
            }
            if (!authReq.user || authReq.user.role !== 'instructor') {
                return res.status(403).json({ message: 'Forbidden. Instructor access required.' });
            }
            const { studentId } = authReq.body;
            if (!studentId) {
                return res.status(400).json({ message: 'Student ID is required.' });
            }
            const reportDetails = {
                studentId: studentId,
                uploaderInstructorId: authReq.user.id,
                originalFilename: authReq.file.originalname,
                storedFilename: authReq.file.filename,
                filePath: authReq.file.path,
                mimeType: authReq.file.mimetype,
                uploadDate: new Date(),
            };
            const savedReport = await this.reportStorageService.saveReportMetadata(reportDetails);
            res.status(201).json({ message: 'Report uploaded successfully', report: savedReport });
        }
        catch (error) {
            console.error('Error uploading report:', error);
            res.status(500).json({ message: 'Error uploading report', error: error.message });
        }
    }
    async getReport(req, res) {
        const authReq = req;
        try {
            const reportId = authReq.params.id;
            const report = await this.reportStorageService.findReportForStudent(reportId);
            if (!report) {
                return res.status(404).json({ message: 'Report not found' });
            }
            if (authReq.user?.role === 'student' && authReq.user?.id !== report.studentId) {
                return res.status(403).json({ message: 'Forbidden: You can only access your own report.' });
            }
            res.status(200).json(report);
        }
        catch (error) {
            res.status(500).json({ message: 'Error fetching report', error: error.message });
        }
    }
    async downloadStudentReport(req, res) {
        const authReq = req;
        try {
            if (!authReq.user || authReq.user.role !== 'student') {
                return res.status(403).json({ message: 'Forbidden. Student access required for this route.' });
            }
            const studentId = authReq.user.id;
            const report = await this.reportStorageService.findReportForStudent(studentId);
            if (!report) {
                return res.status(404).json({ message: 'Report not found for your account.' });
            }
            const filePath = this.reportStorageService.getReportFilePath(report.storedFilename);
            if (fs_1.default.existsSync(filePath)) {
                res.setHeader('Content-Disposition', `attachment; filename=${report.originalFilename}`);
                res.setHeader('Content-Type', report.mimeType);
                const fileStream = fs_1.default.createReadStream(filePath);
                fileStream.pipe(res);
            }
            else {
                res.status(404).json({ message: 'Report file not found on server.' });
            }
        }
        catch (error) {
            console.error('Error downloading report:', error);
            res.status(500).json({ message: 'Error downloading report', error: error.message });
        }
    }
}
exports.ReportController = ReportController;
