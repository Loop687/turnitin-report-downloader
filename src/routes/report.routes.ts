import { Router } from 'express';
import { ReportController } from '../controllers/report.controller';
import { authMiddleware, instructorAuthMiddleware } from '../middleware/auth.middleware';
import { ReportStorageService } from '../services/report-storage.service'; // Import new service
import multer from 'multer';
import path from 'path';

// Configure Multer for file uploads
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'reports');
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOAD_DIR);
    },
    filename: function (req, file, cb) {
        // Ensure unique filenames, e.g., by prefixing with timestamp
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

const reportStorageService = new ReportStorageService(); // Instantiate the service
const reportController = new ReportController(reportStorageService); // Pass service to controller

// Note: The 'app' parameter in setRoutes is typically an Express app instance, not Router.
// For consistency with existing code, I'll keep 'app: Router', but usually it's 'app: express.Application'.
export function setRoutes(app: Router) { // Or app: express.Application
    // Route for instructors to upload reports
    // The 'reportFile' field name in upload.single() must match the name attribute of the file input in the HTML form
    app.post('/reports/upload', instructorAuthMiddleware, upload.single('reportFile'), reportController.uploadReport.bind(reportController));

    // Route for students to download their own report
    app.get('/reports/mine/download', authMiddleware, reportController.downloadStudentReport.bind(reportController));
    
    // Route to get specific report metadata (e.g., by its DB ID)
    // This might be used by an instructor or a student to view report details before downloading
    app.get('/reports/:id', authMiddleware, reportController.getReport.bind(reportController));

    // The old download route `/reports/:id/download` might be kept for instructors
    // or admins if they need to download by a specific report ID, but ensure proper authorization.
    // For students, `/reports/mine/download` is preferred.
}