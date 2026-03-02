import { fetchBotResponse } from '../Models/BotModel.js';

export const checkSymptoms = async (req, res) => {
    try {
        const userMessage = req.body.message;

        if (!userMessage) {
            return res.status(400).json({ error: "Message is required" });
        }

        // Call the model to get the data
        const reply = await fetchBotResponse(userMessage);

        // Send the bot's reply back to React
        res.json({ reply });

    } catch (error) {
        console.error("Error communicating with Python API:", error.message);
        
        // Handle the 400 error (character limit) from Python
        if (error.response && error.response.status === 400) {
            return res.status(400).json({ error: error.response.data.detail });
        }

        res.status(500).json({ error: "Medical bot service is currently unavailable." });
    }
};