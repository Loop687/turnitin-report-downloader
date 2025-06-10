export interface Report {
    id: string; // Database ID for the report metadata
    studentId: string;
    uploaderInstructorId: string; // ID of the instructor who uploaded
    originalFilename: string;
    storedFilename: string; // Filename as stored on server
    filePath: string; // Path to the file on server
    mimeType: string;
    uploadDate: Date;
    // aiDetectionScore and similarityScore might be omitted
    // unless manually entered by instructor or parsed from report.
    // For simplicity, we assume they are within the PDF itself.
    createdAt: Date;
    updatedAt: Date;
}

export interface User {
    id: string;
    username: string;
    email: string;
    role: 'student' | 'instructor';
    createdAt: Date;
    updatedAt: Date;
}

import { Request } from 'express';

// Esta interfaz es para las solicitudes que han sido procesadas por tu middleware de autenticación
export interface AuthenticatedRequest extends Request {
    user?: { // Poblado por tu middleware de autenticación
        id: string;
        role: 'student' | 'instructor';
    };
    isAuthenticated?: () => boolean; // Método típicamente proporcionado por sistemas de autenticación como Passport.js
                                     // Lo hacemos opcional ya que no todas las solicitudes podrían tenerlo,
                                     // o se añade progresivamente.
                                     // Para la simulación (mock), nos aseguramos de que esté presente.
}