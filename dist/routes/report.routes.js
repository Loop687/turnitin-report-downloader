import { ReportController } from '../controllers/report.controller';
import { authMiddleware, instructorAuthMiddleware } from '../middleware/auth.middleware';
import { ReportStorageService } from '../services/report-storage.service';
import multer from 'multer';
import path from 'path';
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'reports');
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOAD_DIR);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });
const reportStorageService = new ReportStorageService();
const reportController = new ReportController(reportStorageService);
export function setRoutes(app) {
    app.post('/reports/upload', instructorAuthMiddleware, upload.single('reportFile'), reportController.uploadReport.bind(reportController));
    app.get('/reports/mine/download', authMiddleware, reportController.downloadStudentReport.bind(reportController));
    app.get('/reports/:id', authMiddleware, reportController.getReport.bind(reportController));
}
