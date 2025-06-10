"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setRoutes = void 0;
const report_controller_1 = require("../controllers/report.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const report_storage_service_1 = require("../services/report-storage.service"); // Import new service
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
// Configure Multer for file uploads
const UPLOAD_DIR = path_1.default.join(__dirname, '..', '..', 'uploads', 'reports');
const storage = multer_1.default.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOAD_DIR);
    },
    filename: function (req, file, cb) {
        // Ensure unique filenames, e.g., by prefixing with timestamp
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = (0, multer_1.default)({ storage: storage });
const reportStorageService = new report_storage_service_1.ReportStorageService(); // Instantiate the service
const reportController = new report_controller_1.ReportController(reportStorageService); // Pass service to controller
// Note: The 'app' parameter in setRoutes is typically an Express app instance, not Router.
// For consistency with existing code, I'll keep 'app: Router', but usually it's 'app: express.Application'.
function setRoutes(app) {
    // Route for instructors to upload reports
    // The 'reportFile' field name in upload.single() must match the name attribute of the file input in the HTML form
    app.post('/reports/upload', auth_middleware_1.instructorAuthMiddleware, upload.single('reportFile'), reportController.uploadReport.bind(reportController));
    // Route for students to download their own report
    app.get('/reports/mine/download', auth_middleware_1.authMiddleware, reportController.downloadStudentReport.bind(reportController));
    // Route to get specific report metadata (e.g., by its DB ID)
    // This might be used by an instructor or a student to view report details before downloading
    app.get('/reports/:id', auth_middleware_1.authMiddleware, reportController.getReport.bind(reportController));
    // The old download route `/reports/:id/download` might be kept for instructors
    // or admins if they need to download by a specific report ID, but ensure proper authorization.
    // For students, `/reports/mine/download` is preferred.
}
exports.setRoutes = setRoutes;
