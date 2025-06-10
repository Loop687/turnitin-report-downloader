document.addEventListener('DOMContentLoaded', function() {
    // This script assumes the student is already authenticated.
    // The reportForm and studentId input might be for an instructor view or a different flow.
    // For student download, we'll focus on a direct "Download My Report" button.

    const studentDownloadButton = document.getElementById('downloadMyReportButton'); // Assume you add this button to index.html for students
    const reportSection = document.getElementById('reportSection');
    const reportContent = document.getElementById('reportContent'); // To display messages

    if (studentDownloadButton) {
        studentDownloadButton.addEventListener('click', function() {
            reportContent.textContent = 'Fetching your report...';
            reportSection.style.display = 'block';

            // Assumes student is authenticated and backend uses session/token to identify them.
            // The JWT token should be sent in the Authorization header.
            // localStorage.getItem('token') is a common way to store JWTs.
            fetch(`/reports/mine/download`, { // Updated endpoint
                method: 'GET',
                headers: {
                    // 'Authorization': `Bearer ${localStorage.getItem('token')}` // Uncomment if using JWT
                }
            })
            .then(response => {
                if (!response.ok) {
                    if (response.status === 401) {
                        throw new Error('Unauthorized. Please log in.');
                    } else if (response.status === 404) {
                        throw new Error('Report not found for your account.');
                    }
                    throw new Error(`Network response was not ok: ${response.statusText}`);
                }
                // Get filename from Content-Disposition header
                const contentDisposition = response.headers.get('Content-Disposition');
                let filename = 'student-report.pdf'; // Default filename
                if (contentDisposition) {
                    const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i);
                    if (filenameMatch && filenameMatch.length > 1) {
                        filename = filenameMatch[1];
                    }
                }
                return response.blob().then(blob => ({ blob, filename }));
            })
            .then(({ blob, filename }) => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                reportContent.textContent = `Report "${filename}" downloaded successfully.`;
            })
            .catch(error => {
                console.error('There was a problem with the fetch operation:', error);
                reportContent.textContent = `Error: ${error.message}`;
            });
        });
    }

    // Keep existing form logic if it's intended for another purpose (e.g., instructor searching by studentId)
    // The original form submission logic:
    const reportForm = document.getElementById('reportForm');
    if (reportForm) {
        reportForm.addEventListener('submit', function(event) {
            event.preventDefault();
            const studentIdEl = document.getElementById('studentId');
            if (!studentIdEl) {
                alert('Student ID input element not found.');
                return;
            }
            const studentId = studentIdEl.value;
            if (studentId) {
                // This part of the script would be for an instructor or admin
                // to fetch a report by student ID. It's different from a student downloading their own.
                // You would need a different endpoint, e.g., /reports/student/${studentId}/details
                // and appropriate authorization.
                reportContent.textContent = `Fetching report for student ID: ${studentId}... (This feature might require instructor login and a different endpoint)`;
                reportSection.style.display = 'block';
                // Example: fetch(`/reports/student/${studentId}/details` or similar)
                // .then(handle response)
                // .catch(handle error)
            } else {
                alert('Please enter a Student ID.');
            }
        });
    }
});