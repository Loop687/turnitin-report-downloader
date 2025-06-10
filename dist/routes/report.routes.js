"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setRoutes = void 0;
const report_controller_1 = require("../controllers/report.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const report_storage_service_1 = require("../services/report-storage.service");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const UPLOAD_DIR = path_1.default.join(__dirname, '..', '..', 'uploads', 'reports');
const storage = multer_1.default.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOAD_DIR);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = (0, multer_1.default)({ storage: storage });
const reportStorageService = new report_storage_service_1.ReportStorageService();
const reportController = new report_controller_1.ReportController(reportStorageService);
function setRoutes(app) {
    app.post('/reports/upload', auth_middleware_1.instructorAuthMiddleware, upload.single('reportFile'), reportController.uploadReport.bind(reportController));
    app.get('/reports/mine/download', auth_middleware_1.authMiddleware, reportController.downloadStudentReport.bind(reportController));
    app.get('/reports/:id', auth_middleware_1.authMiddleware, reportController.getReport.bind(reportController));
}
exports.setRoutes = setRoutes;
