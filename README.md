# Turnitin Report Downloader Portal

This project is designed to act as a portal where instructors can upload Turnitin AI detection reports they have manually downloaded. Students can then log in to this application to download their specific reports. This system provides a way to distribute reports without direct Turnitin API integration.

## Features

- User authentication to ensure secure access.
- **Instructor Role:** Ability to upload report files (e.g., PDFs downloaded from Turnitin) and associate them with specific students.
- **Student Role:** Ability to view and download their assigned AI detection report.
- Secure storage and retrieval of report files.

## Revised Workflow

1.  **Instructor:** Manually downloads AI detection reports from the Turnitin website.
2.  **Instructor:** Logs into this application and uploads the downloaded report files, associating each with the respective student.
3.  **Student:** Logs into this application to view and download their report.

## Project Structure

```
turnitin-report-downloader
├── src
│   ├── app.ts                     # Entry point of the application
│   ├── controllers
│   │   └── report.controller.ts    # Handles report-related logic
│   ├── middleware
│   │   └── auth.middleware.ts      # Authentication middleware
│   ├── routes
│   │   └── report.routes.ts        # Defines report-related routes
│   ├── services
│   │   └── report-storage.service.ts     # Manages storage and retrieval of report files
│   └── types
│       └── index.ts               # Type definitions
├── public
│   ├── css
│   │   └── style.css              # Styles for the web application
│   ├── js
│   │   └── script.js              # Client-side JavaScript
│   └── index.html                 # Main HTML file
├── uploads                          # Directory for storing uploaded report files (ensure .gitignore)
├── .env.example                    # Example environment variables
├── package.json                    # npm configuration
├── tsconfig.json                   # TypeScript configuration
└── README.md                       # Project documentation
```

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/turnitin-report-downloader.git
   ```

2. Navigate to the project directory:
   ```
   cd turnitin-report-downloader
   ```

3. Install the dependencies:
   ```
   npm install
   ```

4. Create a `.env` file based on the `.env.example` file and fill in the required environment variables.
5. Ensure a directory named `uploads` (or as configured) exists in the project root for storing report files. Add `uploads/` to your `.gitignore` file.

## Usage

1. Start the application:
   ```
   npm start
   ```

2. **Instructor:** Access the application, authenticate, and use the upload functionality to add student reports.
3. **Student:** Access the application, authenticate, to view and download their Turnitin AI detection reports.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License

This project is licensed under the MIT License. See the LICENSE file for details.