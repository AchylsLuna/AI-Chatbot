async function runConcurrencyTest() {
    const url = process.env.TEST_SOAP_URL || 'http://localhost:5000/api/doctor/appointments/<appointment-id>/soap-note';
    const token = String(process.env.TEST_BEARER_TOKEN || '').trim();

    if (!token || url.includes('<appointment-id>')) {
        console.error('Set TEST_BEARER_TOKEN and TEST_SOAP_URL before running this script.');
        process.exit(1);
    }

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

