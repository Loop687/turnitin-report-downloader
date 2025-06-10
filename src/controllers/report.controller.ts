import { Response, Request as ExpressRequest } from 'express';
import { ReportStorageService } from '../services/report-storage.service';
import fs from 'fs';
import { AuthenticatedRequest } from '../types'; // Importar el tipo centralizado

export class ReportController {
    constructor(private reportStorageService: ReportStorageService) {}

    async uploadReport(req: ExpressRequest, res: Response) {
        const authReq = req as AuthenticatedRequest; // Cast a AuthenticatedRequest
        try {
            if (!authReq.file) { // req.file es añadido por multer
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
        } catch (error) {
            console.error('Error uploading report:', error);
            res.status(500).json({ message: 'Error uploading report', error: (error as Error).message });
        }
    }
    
    async getReport(req: ExpressRequest, res: Response) {
        const authReq = req as AuthenticatedRequest; // Cast a AuthenticatedRequest
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
        } catch (error) {
            res.status(500).json({ message: 'Error fetching report', error: (error as Error).message });
        }
    }

    async downloadStudentReport(req: ExpressRequest, res: Response) {
        const authReq = req as AuthenticatedRequest; // Cast a AuthenticatedRequest
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
            
            if (fs.existsSync(filePath)) {
                res.setHeader('Content-Disposition', `attachment; filename=${report.originalFilename}`);
                res.setHeader('Content-Type', report.mimeType);
                const fileStream = fs.createReadStream(filePath);
                fileStream.pipe(res);
            } else {
                res.status(404).json({ message: 'Report file not found on server.' });
            }
        } catch (error) {
            console.error('Error downloading report:', error);
            res.status(500).json({ message: 'Error downloading report', error: (error as Error).message });
        }
    }
}