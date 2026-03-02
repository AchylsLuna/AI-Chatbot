import axios from 'axios';

export const fetchBotResponse = async (userMessage) => {
    // Forward the request to your Python FastAPI server
    const pythonResponse = await axios.post('http://127.0.0.1:8000/api/chat', {
        message: userMessage
    });
    return pythonResponse.data.reply;
};