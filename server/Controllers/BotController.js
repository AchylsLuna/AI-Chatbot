import { fetchBotResponse } from '../Models/BotModel.js';

export const checkSymptoms = async (req, res) => {
    try {
        const userMessage = String(req.body.message || '').trim();
        const context = {
            isIdentified: req.body.isIdentified === true,
            userRole: req.body.userRole ? String(req.body.userRole).trim() : null,
        }

        if (!userMessage) {
            return res.status(400).json({ error: "Message is required" });
        }

        // Call FastAPI chatbot + dataset-grounded model flow.
        const result = await fetchBotResponse(userMessage, context);

        // Send the bot's reply and metadata back to React.
        res.json(result);

    } catch (error) {
        console.error("Error in chatbot service:", error.message);
        
        res.status(500).json({ error: "Medical bot service is currently unavailable." });
    }
};
