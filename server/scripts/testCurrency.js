async function runConcurrencyTest() {
    const url = 'http://localhost:5001/api/doctor/appointments/69aece9bc7e76f8567a9e4ad/soap-note';
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5YTgwMGU1YzJmZTBhODZjNjVhZDRhNSIsInJvbGUiOiJkb2N0b3IiLCJlbWFpbCI6ImZyb3N0aW52b2tlcjcyMEBnbWFpbC5jb20iLCJpYXQiOjE3NzMyMDA1ODMsImV4cCI6MTc3MzgwNTM4M30.NW3VYAaAsD6yvAiAQZcJ2e5E_hQoExm9JllQbz7MYwo'; // Keep your token here

    console.log("Sending 50 concurrent requests...");

    const requests = Array.from({ length: 50 }).map(async (_, index) => {
        try {
            const response = await fetch(url, {
                method: 'PUT',
                headers: { 
                    'Authorization': `Bearer ${token}`, 
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify({ subjective: `Concurrency Test ${index}` })
            });
            return { status: response.status };
        } catch (error) {
            return { status: 'FAILED', error: error.message };
        }
    });

    const results = await Promise.all(requests);
    
    // Tally the results
    const summary = results.reduce((acc, curr) => {
        acc[curr.status] = (acc[curr.status] || 0) + 1;
        return acc;
    }, {});

    console.log("Test Complete. Results Summary:");
    console.table(summary);
}

runConcurrencyTest();
